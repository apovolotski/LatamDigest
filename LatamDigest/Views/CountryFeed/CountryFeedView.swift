import SwiftUI
import SafariServices

/// Displays a feed of articles for a specific country.  Allows the user
/// to choose between top headlines, latest headlines or various
/// categories via a horizontal feed picker. Articles are loaded using
/// `CountryFeedViewModel`.
struct CountryFeedView: View {
    let country: Country
    @AppStorage("preferredLanguage") private var preferredLanguage: String = Locale.current.language.languageCode?.identifier ?? "es"
    @EnvironmentObject private var library: ReadingLibrary
    @StateObject private var viewModel = CountryFeedViewModel()
    @State private var selectedFeed: CountryFeedViewModel.FeedType = .top
    @State private var presentingSafariURL: URL?
    @State private var selectedArticle: Article?

    private var briefingCard: BriefingCard? {
        BriefingComposer.countryBriefing(country: country, articles: viewModel.articles, languageCode: preferredLanguage)
    }

    var body: some View {
        List {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(CountryFeedViewModel.FeedType.allCases, id: \.self) { feed in
                        if feed != .other {
                            Button {
                                selectedFeed = feed
                            } label: {
                                Text(AppLanguage.localized(feed.localizationKey, languageCode: preferredLanguage))
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(selectedFeed == feed ? Color.primary : Color.secondary)
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 10)
                                    .background(
                                        Capsule()
                                            .fill(selectedFeed == feed ? Color.white : Color.clear)
                                    )
                                    .overlay(
                                        Capsule()
                                            .stroke(
                                                selectedFeed == feed
                                                    ? Color.gray.opacity(0.18)
                                                    : Color.gray.opacity(0.1),
                                                lineWidth: 1
                                            )
                                    )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(8)
            }
            .onChange(of: selectedFeed) { _ in
                Task {
                    await viewModel.loadArticles(for: country.id, feed: selectedFeed)
                }
            }
            .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 4, trailing: 0))
            .listRowBackground(Color.clear)

            if let briefingCard {
                VStack(alignment: .leading, spacing: 12) {
                    Text(briefingCard.title)
                        .font(.headline)
                    Text(briefingCard.summary)
                        .foregroundStyle(.secondary)
                    themeRow(themes: briefingCard.themes)
                    Text(briefingCard.whyItMatters)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 8)
            }

            if viewModel.isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity)
            } else if let errorMessage = viewModel.errorMessage {
                VStack(alignment: .leading, spacing: 8) {
                    Text(AppLanguage.localized("feed_digest_unavailable", languageCode: preferredLanguage))
                        .font(.headline)
                    Text(errorMessage)
                        .foregroundColor(.secondary)
                    Button(AppLanguage.localized("feed_try_again", languageCode: preferredLanguage)) {
                        Task {
                            await viewModel.loadArticles(for: country.id, feed: selectedFeed)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                }
                .padding(.vertical, 12)
            } else {
                ForEach(viewModel.articles) { article in
                    ArticleRowView(
                        article: article,
                        isSaved: library.isSaved(article),
                        onToggleSave: {
                            library.toggleSaved(article)
                        }
                    )
                    .contentShape(Rectangle())
                    .onTapGesture {
                        selectedArticle = article
                        library.markAsRead(article)
                        }
                }
            }
        }
        .navigationTitle(country.localizedName(languageCode: preferredLanguage))
        .onAppear {
            Task {
                await viewModel.loadArticles(for: country.id, feed: selectedFeed)
            }
        }
        .navigationDestination(item: $selectedArticle) { article in
            ArticleDetailView(article: article, countryName: country.localizedName(languageCode: preferredLanguage))
        }
        .sheet(item: $presentingSafariURL) { url in
            SafariView(url: url)
        }
    }

    private func themeRow(themes: [String]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(themes, id: \.self) { theme in
                    Text(theme)
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(
                            Capsule()
                                .fill(Color(.secondarySystemBackground))
                        )
                }
            }
        }
    }
}
