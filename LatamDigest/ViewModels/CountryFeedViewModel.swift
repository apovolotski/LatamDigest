import Foundation
import Combine
import SwiftUI

/// View model for displaying a list of articles for a selected country.
/// Supports loading top headlines, latest headlines or specific categories.
final class CountryFeedViewModel: ObservableObject {
    enum FeedType: String, CaseIterable {
        case top = "Top"
        case latest = "Latest"
        case politics = "Politics"
        case business = "Business"
        case sports = "Sports"
        case tech = "Tech"
        case culture = "Culture"
        case crime = "Crime"
        case economy = "Economy"
        case world = "World"
        case other = "Other"

        var localizationKey: String {
            switch self {
            case .top: return "feed_top"
            case .latest: return "feed_latest"
            case .politics: return "feed_politics"
            case .business: return "feed_business"
            case .sports: return "feed_sports"
            case .tech: return "feed_tech"
            case .culture: return "feed_culture"
            case .crime: return "feed_crime"
            case .economy: return "feed_economy"
            case .world: return "feed_world"
            case .other: return "feed_other"
            }
        }

        /// Returns a backend category string for non‑standard tabs.
        var categoryKey: String? {
            switch self {
            case .top, .latest:
                return nil
            case .politics: return "politics"
            case .business: return "business"
            case .sports: return "sports"
            case .tech: return "tech"
            case .culture: return "culture"
            case .crime: return "crime"
            case .economy: return "economy"
            case .world: return "world"
            case .other: return "other"
            }
        }
    }

    @Published var articles: [Article] = []
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?

    /// Loads articles from the `NewsService` depending on the selected feed type.
    func loadArticles(for country: String, feed: FeedType) async {
        DispatchQueue.main.async {
            self.isLoading = true
            self.errorMessage = nil
        }
        do {
            let result: [Article]
            switch feed {
            case .top:
                result = try await NewsService.shared.fetchTopArticles(countryCode: country)
            case .latest:
                result = try await NewsService.shared.fetchLatestArticles(countryCode: country)
            default:
                if let category = feed.categoryKey {
                    result = try await NewsService.shared.fetchArticles(countryCode: country, category: category)
                } else {
                    result = []
                }
            }
            DispatchQueue.main.async {
                self.articles = result.sorted(by: { $0.publishedAt > $1.publishedAt })
                self.isLoading = false
            }
        } catch {
            DispatchQueue.main.async {
                self.articles = []
                self.isLoading = false
                self.errorMessage = error.localizedDescription
            }
        }
    }
}
