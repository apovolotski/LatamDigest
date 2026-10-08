import SwiftUI

struct ArticleDetailView: View {
    let article: Article
    let countryName: String

    @AppStorage("preferredLanguage") private var preferredLanguage: String = AppEdition.defaultLanguage
    @EnvironmentObject private var library: ReadingLibrary
    #if JAPAN_EDITION
    @State private var notebookArticle: Article?
    #endif
    @State private var presentingSafariURL: URL?

    private var relativeDate: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        formatter.locale = Locale(identifier: AppLanguage.supportedLanguageCode(from: preferredLanguage))
        return formatter.localizedString(for: article.publishedAt, relativeTo: Date())
    }

    private var keyPoints: [String] {
        BriefingComposer.keyPoints(for: article)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(article.sourceName.uppercased())
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)

                    Text(article.title)
                        .font(.largeTitle.weight(.bold))

                    HStack(spacing: 12) {
                        Label(relativeDate, systemImage: "clock")
                        Label(countryName, systemImage: AppEdition.globeSymbol)
                    }
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                }

                #if JAPAN_EDITION
                nativeCard(title: "記事について", body: "この記事の見出しは公開ニュースフィードから取得しています。本文は配信元のサイトでお読みください。購読やログインが必要な場合があります。")
                #else
                nativeCard(
                    title: AppLanguage.localized("detail_native_summary_title", languageCode: preferredLanguage),
                    body: article.snippet
                )

                nativeCard(
                    title: AppLanguage.localized("detail_why_it_matters_title", languageCode: preferredLanguage),
                    body: BriefingComposer.articleContext(for: article, countryName: countryName, languageCode: preferredLanguage)
                )

                VStack(alignment: .leading, spacing: 12) {
                    Text(AppLanguage.localized("detail_key_points_title", languageCode: preferredLanguage))
                        .font(.headline)

                    ForEach(keyPoints, id: \.self) { point in
                        HStack(alignment: .top, spacing: 10) {
                            Image(systemName: "circle.fill")
                                .font(.system(size: 7))
                                .foregroundStyle(.secondary)
                                .padding(.top, 6)
                            Text(point)
                                .foregroundStyle(.primary)
                        }
                    }
                }

                #endif
                #if JAPAN_EDITION
                Button { notebookArticle = article } label: { Label("手帖に追加", systemImage: "book.closed") }
                    .buttonStyle(.bordered)
                #endif
                HStack(spacing: 12) {
                    Button {
                        library.toggleSaved(article)
                    } label: {
                        Label(
                            library.isSaved(article)
                                ? AppLanguage.localized("detail_saved_button", languageCode: preferredLanguage)
                                : AppLanguage.localized("detail_save_button", languageCode: preferredLanguage),
                            systemImage: library.isSaved(article) ? "bookmark.fill" : "bookmark"
                        )
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)

                    Button {
                        presentingSafariURL = article.url
                    } label: {
                        Label(
                            AppLanguage.localized("detail_open_source_button", languageCode: preferredLanguage),
                            systemImage: "safari"
                        )
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
            .padding()
        }
        .navigationTitle(AppLanguage.localized("detail_screen_title", languageCode: preferredLanguage))
        .navigationBarTitleDisplayMode(.inline)
        #if JAPAN_EDITION
        .sheet(item: $notebookArticle) { JapanNotebookPicker(article: $0) }
        #endif
        .onAppear {
            library.markAsRead(article)
        }
        .sheet(item: $presentingSafariURL) { url in
            SafariView(url: url)
        }
    }

    private func nativeCard(title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
            Text(body)
                .font(.body)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(.secondarySystemBackground))
        )
    }
}
