import SwiftUI

struct ArticleDetailView: View {
    let article: Article
    let countryName: String

    @AppStorage("preferredLanguage") private var preferredLanguage: String = Locale.current.language.languageCode?.identifier ?? "es"
    @EnvironmentObject private var library: ReadingLibrary
    @State private var presentingSafariURL: URL?

    private var relativeDate: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
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
                        Label(countryName, systemImage: "globe.americas")
                    }
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                }

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
