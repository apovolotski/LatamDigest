import SwiftUI
import SafariServices

/// Displays a feed of articles for a specific country.  Allows the user
/// to choose between top headlines, latest headlines or various
/// categories via a segmented picker.  Articles are loaded using
/// `CountryFeedViewModel`.
struct CountryFeedView: View {
    let country: Country
    @StateObject private var viewModel = CountryFeedViewModel()
    @State private var selectedFeed: CountryFeedViewModel.FeedType = .top
    @State private var presentingSafariURL: URL?

    var body: some View {
        List {
            // Picker for selecting feed type
            Picker("Feed", selection: $selectedFeed) {
                ForEach(CountryFeedViewModel.FeedType.allCases, id: \.self) { feed in
                    // Hide "other" from the main picker; it's not used.
                    if feed != .other {
                        Text(feed.rawValue)
                            .tag(feed)
                    }
                }
            }
            .pickerStyle(SegmentedPickerStyle())
            .onChange(of: selectedFeed) { _ in
                Task {
                    await viewModel.loadArticles(for: country.id, feed: selectedFeed)
                }
            }

            if viewModel.isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity)
            } else if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .foregroundColor(.red)
            } else {
                ForEach(viewModel.articles) { article in
                    ArticleRowView(article: article)
                        .onTapGesture {
                            presentingSafariURL = article.url
                        }
                }
            }
        }
        .navigationTitle(country.name)
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