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
            Picker("Feed", selection: $selectedFeed) {
                ForEach(CountryFeedViewModel.FeedType.allCases, id: \.self) { feed in
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
                VStack(alignment: .leading, spacing: 8) {
                    Text("Digest unavailable")
                        .font(.headline)
                    Text(errorMessage)
                        .foregroundColor(.secondary)
                    Button("Try Again") {
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
