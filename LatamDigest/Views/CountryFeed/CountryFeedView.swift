import SwiftUI
import SafariServices

/// Displays a feed of articles for a specific country.  Allows the user
/// to choose between top headlines, latest headlines or various
/// categories via a horizontal feed picker. Articles are loaded using
/// `CountryFeedViewModel`.
struct CountryFeedView: View {
    let country: Country
    @AppStorage("preferredLanguage") private var preferredLanguage: String = Locale.current.language.languageCode?.identifier ?? "es"
    @StateObject private var viewModel = CountryFeedViewModel()
    @State private var selectedFeed: CountryFeedViewModel.FeedType = .top
    @State private var presentingSafariURL: URL?

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
                    ArticleRowView(article: article)
                        .onTapGesture {
                            presentingSafariURL = article.url
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
        .sheet(item: $presentingSafariURL) { url in
            SafariView(url: url)
        }
    }
}
