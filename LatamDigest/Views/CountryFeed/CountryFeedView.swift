import SwiftUI
import SafariServices

/// Displays a feed of articles for a specific country.  Allows the user
/// to choose between top headlines, latest headlines or various
/// categories via a horizontal feed picker. Articles are loaded using
/// `CountryFeedViewModel`.
struct CountryFeedView: View {
    let country: Country
    @AppStorage("preferredLanguage") private var preferredLanguage: String = AppEdition.defaultLanguage
    @EnvironmentObject private var library: ReadingLibrary
    @StateObject private var viewModel = CountryFeedViewModel()
    @State private var selectedFeed: CountryFeedViewModel.FeedType = .top
    @State private var presentingSafariURL: URL?
    @State private var selectedArticle: Article?
    @State private var searchText = ""

    private var filteredArticles: [Article] {
        ArticleSearch.filter(viewModel.articles, query: searchText)
    }

    private var briefingCard: BriefingCard? {
        BriefingComposer.countryBriefing(country: country, articles: viewModel.articles, languageCode: preferredLanguage)
    }

    var body: some View {
        List {
            feedPickerRow
            .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 4, trailing: 0))
            .listRowBackground(Color.clear)

            if let result = viewModel.feedResult {
                FeedStatusView(result: result, languageCode: preferredLanguage)
            }
            if let briefingCard {
                briefingSection(briefingCard)
            }

            if viewModel.isLoading {
                loadingSection
            } else if let errorMessage = viewModel.errorMessage {
                errorSection(errorMessage)
            } else {
                articleRows
            }
        }
        .navigationTitle(country.localizedName(languageCode: preferredLanguage))
        .searchable(text: $searchText, prompt: AppLanguage.localized("news_search", languageCode: preferredLanguage))
        .task(id: selectedFeed) {
            await viewModel.loadArticles(for: country.id, feed: selectedFeed)
        }
        .refreshable {
            await viewModel.loadArticles(for: country.id, feed: selectedFeed)
        }
        .navigationDestination(item: $selectedArticle) { article in
            ArticleDetailView(article: article, countryName: country.localizedName(languageCode: preferredLanguage))
        }
        .sheet(item: $presentingSafariURL) { url in
            SafariView(url: url)
        }
    }

    private var visibleFeeds: [CountryFeedViewModel.FeedType] {
        CountryFeedViewModel.FeedType.allCases.filter { $0 != .other }
    }

    private var feedPickerRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(visibleFeeds, id: \.self) { feed in
                    feedButton(for: feed)
                }
            }
            .padding(8)
        }
    }

    private func feedButton(for feed: CountryFeedViewModel.FeedType) -> some View {
        Button {
            selectedFeed = feed
        } label: {
            Text(AppLanguage.localized(feed.localizationKey, languageCode: preferredLanguage))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(selectedFeed == feed ? Color.primary : Color.secondary)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(feedBackground(isSelected: selectedFeed == feed))
                .overlay(feedBorder(isSelected: selectedFeed == feed))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selectedFeed == feed ? .isSelected : [])
    }

    private func feedBackground(isSelected: Bool) -> some View {
        Capsule()
            .fill(isSelected ? Color(.secondarySystemBackground) : Color.clear)
    }

    private func feedBorder(isSelected: Bool) -> some View {
        Capsule()
            .stroke(
                isSelected ? Color.gray.opacity(0.18) : Color.gray.opacity(0.1),
                lineWidth: 1
            )
    }

    private func briefingSection(_ briefingCard: BriefingCard) -> some View {
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

    private var loadingSection: some View {
        ProgressView()
            .frame(maxWidth: .infinity)
    }

    private func errorSection(_ errorMessage: String) -> some View {
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
    }

    @ViewBuilder
    private var articleRows: some View {
        if filteredArticles.isEmpty {
            ContentUnavailableView(
                AppLanguage.localized(searchText.isEmpty ? "news_empty" : "news_no_matches", languageCode: preferredLanguage),
                systemImage: "newspaper"
            )
        }
        ForEach(filteredArticles) { article in
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
