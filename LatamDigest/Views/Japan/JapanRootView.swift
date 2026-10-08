#if JAPAN_EDITION
import SwiftUI

struct JapanRootView: View {
    @AppStorage("selectedCountries") private var selection = JapanSource.defaultSelection
    @StateObject private var news = MonitoringWorkspaceViewModel()
    @EnvironmentObject private var library: ReadingLibrary
    @State private var search = ""
    @State private var sourceFilter = ""
    @State private var selectedArticle: Article?

    private var codes: [String] { selection.split(separator: ",").map(String.init) }
    private var countries: [Country] { CountryCatalog.loadCountries().filter { codes.contains($0.id) } }
    private var articles: [Article] {
        var seen = Set<String>()
        return news.allEvidence(for: sourceFilter.isEmpty ? codes : [sourceFilter]).filter { seen.insert($0.storageKey).inserted }
    }

    var body: some View {
        TabView {
            NavigationStack {
                List {
                    Section {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(Date.now, format: .dateTime.month().day().weekday())
                                .font(.subheadline).foregroundStyle(.secondary)
                            Text("日本のニュースを、自分の手帖に。")
                                .font(.title3.weight(.bold))
                            Text("気になる見出しを読み、保存し、考えを残す。")
                                .font(.subheadline).foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 8)
                        .listRowBackground(Color.clear)
                        sourcePicker
                        status
                    }
                    Section("新着の見出し") {
                        let filtered = ArticleSearch.filter(articles, query: search)
                        if news.isLoading && articles.isEmpty { ProgressView("ニュースを取得中…") }
                        else if codes.isEmpty {
                            ContentUnavailableView("配信元を選んでください", systemImage: "newspaper", description: Text("右上の設定から、読みたい配信元を選べます。"))
                        } else if filtered.isEmpty {
                            ContentUnavailableView(search.isEmpty ? "ニュースがありません" : "一致する記事がありません", systemImage: "magnifyingglass", description: Text("接続を確認して、下に引いて更新してください。"))
                        }
                        ForEach(filtered) { article in
                            JapanHeadlineRow(article: article) { selectedArticle = article }
                        }
                    }
                    Section {
                        Text("Google ニュースの公開フィードを通じて見出しを取得しています。本文・写真は配信元でご覧ください。各媒体とは提携していません。")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
                .listStyle(.insetGrouped)
                .navigationTitle("日本ニュース手帖")
                .searchable(text: $search, prompt: "見出し・配信元を検索")
                .refreshable { await news.load(countryCodes: codes) }
                .navigationDestination(item: $selectedArticle) { ArticleDetailView(article: $0, countryName: "") }
                .toolbar {
                    NavigationLink { JapanSettingsView() } label: { Image(systemName: "gearshape") }
                        .accessibilityLabel("設定").accessibilityIdentifier("japan-settings")
                }
            }
            .tabItem { Label("新着", systemImage: "newspaper") }

            NavigationStack {
                List {
                    Section {
                        Text("日本語の見出しから、気になるテーマを探しましょう。テーマの分類はキーワードによる目安です。")
                            .font(.subheadline).foregroundStyle(.secondary)
                    }
                    ForEach(WatchTopic.allCases) { topic in
                        let matching = SignalEngine.relevantArticles(for: topic, in: news.allEvidence(for: codes))
                        NavigationLink {
                            JapanTopicView(topic: topic, articles: matching)
                        } label: {
                            HStack {
                                Label(AppLanguage.localized(topic.localizationKey, languageCode: "ja"), systemImage: topic.icon)
                                Spacer()
                                Text("\(matching.count)件").font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                .navigationTitle("テーマ")
            }
            .tabItem { Label("テーマ", systemImage: "square.grid.2x2") }

            NavigationStack { ReadingLibraryView() }
                .tabItem { Label("ライブラリ", systemImage: "books.vertical") }

            NavigationStack { DossiersView(countries: countries, languageCode: "ja") }
                .tabItem { Label("手帖", systemImage: "book.closed") }
        }
        .task(id: selection) {
            if !sourceFilter.isEmpty && !codes.contains(sourceFilter) { sourceFilter = "" }
            await news.load(countryCodes: codes)
        }
    }

    private var sourcePicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                filterButton("すべて", code: "")
                ForEach(JapanSource.all.filter { codes.contains($0.id) }) { source in
                    filterButton(source.name, code: source.id)
                }
            }
            .padding(.vertical, 4)
        }
        .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
    }

    private func filterButton(_ title: String, code: String) -> some View {
        Button { sourceFilter = code } label: {
            Text(title).font(.subheadline.weight(.medium))
                .padding(.horizontal, 12).padding(.vertical, 8)
                .foregroundStyle(sourceFilter == code ? Color.white : Color.primary)
                .background(sourceFilter == code ? Color.accentColor : Color(.tertiarySystemFill), in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(sourceFilter == code ? .isSelected : [])
    }

    @ViewBuilder private var status: some View {
        if let date = news.lastUpdated {
            FeedStatusView(result: FeedResult(articles: [], fetchedAt: date, isCached: !news.cachedCountryCodes.isEmpty), languageCode: "ja")
        }
        if !news.unavailableCountryCodes.isEmpty {
            Label("取得できない配信元：" + names(for: news.unavailableCountryCodes), systemImage: "exclamationmark.triangle")
                .font(.caption).foregroundStyle(.secondary)
        }
        if !news.cachedCountryCodes.isEmpty {
            Text("保存済みの見出し：" + names(for: news.cachedCountryCodes)).font(.caption).foregroundStyle(.secondary)
        }
    }

    private func names(for codes: [String]) -> String {
        JapanSource.all.filter { codes.contains($0.id) }.map(\.name).joined(separator: "、")
    }
}

private struct JapanTopicView: View {
    let topic: WatchTopic
    let articles: [Article]
    @State private var search = ""
    @State private var selectedArticle: Article?
    var body: some View {
        List {
            let filtered = ArticleSearch.filter(articles, query: search)
            if filtered.isEmpty {
                ContentUnavailableView("関連する記事がありません", systemImage: topic.icon, description: Text("新着画面でニュースを更新すると、このテーマに一致する見出しが表示されます。"))
            }
            ForEach(filtered) { article in
                JapanHeadlineRow(article: article) { selectedArticle = article }
            }
        }
        .navigationTitle(AppLanguage.localized(topic.localizationKey, languageCode: "ja"))
        .searchable(text: $search, prompt: "見出し・配信元を検索")
        .navigationDestination(item: $selectedArticle) { ArticleDetailView(article: $0, countryName: "") }
    }
}

private struct JapanHeadlineRow: View {
    let article: Article
    let open: () -> Void
    @EnvironmentObject private var library: ReadingLibrary
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(article.sourceName).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                Spacer()
                Button { library.toggleSaved(article) } label: {
                    Image(systemName: library.isSaved(article) ? "bookmark.fill" : "bookmark")
                }
                .buttonStyle(.borderless)
                .accessibilityLabel(library.isSaved(article) ? "保存を解除" : "記事を保存")
            }
            Button(action: open) {
                Text(article.title).font(.headline).multilineTextAlignment(.leading).foregroundStyle(.primary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
            Text(article.publishedAt, format: .dateTime.month().day().hour().minute())
                .font(.caption).foregroundStyle(.secondary)
        }
        .padding(.vertical, 6)
    }
}

struct JapanNotebookPicker: View {
    let article: Article
    @EnvironmentObject private var workspace: WorkspaceStore
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    var body: some View {
        NavigationStack {
            List {
                Section("新しい手帖") {
                    TextField("手帖の名前", text: $name)
                    Button("作成して記事を追加") {
                        let notebook = workspace.createDossier(title: name.trimmingCharacters(in: .whitespacesAndNewlines), note: "", topic: nil, countryCode: nil)
                        workspace.addArticle(article, to: notebook)
                        dismiss()
                    }
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                Section("既存の手帖") {
                    ForEach(workspace.dossiers) { notebook in
                        Button(notebook.title) { workspace.addArticle(article, to: notebook); dismiss() }
                    }
                }
            }
            .navigationTitle("手帖に追加")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("閉じる") { dismiss() } } }
        }
    }
}
#endif
