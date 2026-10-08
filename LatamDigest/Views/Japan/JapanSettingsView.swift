#if JAPAN_EDITION
import SwiftUI

struct JapanOnboardingView: View {
    @AppStorage("preferredLanguage") private var language = "ja"
    @AppStorage("selectedCountries") private var sources = JapanSource.defaultSelection
    @AppStorage("hasCompletedOnboarding") private var completed = false
    @AppStorage("dailyRemindersEnabled") private var reminders = false
    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 14) {
                        Image(systemName: "book.closed.fill").font(.system(size: 42)).foregroundStyle(Color.accentColor)
                        Text("日本ニュース手帖").font(.largeTitle.weight(.bold))
                        Text("日本のニュースを、自分の手帖に。")
                            .font(.title3.weight(.semibold))
                        Text("配信元を選び、気になる見出しを保存。テーマごとに記事を読み比べ、手帖にメモを残せます。")
                            .foregroundStyle(.secondary)
                    }.padding(.vertical)
                }
                Section("読みたい配信元") { JapanSourceSelection(selection: $sources) }
                Section {
                    Text("見出しは日本語の公開フィードから取得します。記事本文は配信元で開きます。日々の通知は設定から任意で有効にできます。")
                        .font(.footnote).foregroundStyle(.secondary)

                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("ようこそ")
            .safeAreaInset(edge: .bottom) {
                    Button {
                        language = "ja"
                        // Notifications are an explicit opt-in in Settings after onboarding.
                        reminders = false
                        completed = true
                    } label: {
                        Text("はじめる").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 8)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(sources.isEmpty)
                    .accessibilityIdentifier("japan-start")
                    .padding()
                    .background(.bar)
            }
        }
    }
}

struct JapanSettingsView: View {
    @AppStorage("selectedCountries") private var sources = JapanSource.defaultSelection
    @AppStorage("dailyRemindersEnabled") private var reminders = false
    @AppStorage("dailyDigestTimeInterval") private var reminderTime = (Calendar.current.date(bySettingHour: 7, minute: 30, second: 0, of: Date()) ?? Date()).timeIntervalSince1970
    @EnvironmentObject private var library: ReadingLibrary
    @State private var showingClear = false
    @State private var authorizationDenied = false

    var body: some View {
        Form {
            Section("配信元") { JapanSourceSelection(selection: $sources) }
            Section("毎日のリマインダー") {
                Toggle("毎日の通知", isOn: $reminders)
                if reminders {
                    DatePicker("通知する時刻", selection: Binding(get: { Date(timeIntervalSince1970: reminderTime) }, set: { reminderTime = $0.timeIntervalSince1970 }), displayedComponents: .hourAndMinute)
                    if authorizationDenied {
                        Text("通知が許可されていません。iOSの設定から許可してください。").font(.footnote)
                    }
                }
                Text("新着ニュースを読むための通知です。最新の見出しはアプリを開いたときに更新されます。")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            Section("言語") { LabeledContent("表示言語", value: "日本語") }
            Section("プライバシー") {
                Button("閲覧履歴を消去", role: .destructive) { showingClear = true }
                    .disabled(library.readingHistory.isEmpty)
                Text("保存した記事、手帖、閲覧履歴はこの端末に保存されます。アカウント登録は不要です。")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            Section("ニュースの配信について") {
                Text("Google ニュースの公開RSSから、選択した日本の媒体の見出し・配信元・リンク・公開日時を取得します。本文や写真の転載、AIによる翻訳・要約は行いません。")
                Text("記事を開くとGoogle ニュース経由で配信元へ移動します。配信元によって購読やログインが必要です。各媒体との提携や公認を示すものではありません。")
                Text("ニュースの取得時にはGoogleに通常の接続情報（IPアドレスなど）が送信されます。記事を開いた先では各サイトのプライバシーポリシーが適用されます。")
            }
            Section("アプリについて") { LabeledContent("日本ニュース手帖", value: "1.0") }
        }
        .navigationTitle("設定")
        .confirmationDialog("この端末の閲覧履歴を消去します。保存した記事は残ります。", isPresented: $showingClear, titleVisibility: .visible) {
            Button("閲覧履歴を消去", role: .destructive) { library.clearHistory() }
            Button("キャンセル", role: .cancel) {}
        }
        .task(id: "\(reminders)-\(reminderTime)-\(sources)") {
            await NotificationManager.shared.scheduleDailyDigest(for: sources.split(separator: ",").map(String.init), at: Date(timeIntervalSince1970: reminderTime), languageCode: "ja")
            authorizationDenied = await NotificationManager.shared.notificationsDenied()
        }
    }
}

private struct JapanSourceSelection: View {
    @Binding var selection: String
    private var codes: [String] { selection.split(separator: ",").map(String.init) }
    var body: some View {
        ForEach(JapanSource.all) { source in
            Toggle(source.name, isOn: Binding(get: { codes.contains(source.id) }, set: { enabled in
                var selected = Set(codes)
                if enabled { selected.insert(source.id) } else { selected.remove(source.id) }
                selection = JapanSource.all.filter { selected.contains($0.id) }.map(\.id).joined(separator: ",")
            }))
        }
    }
}
#endif
