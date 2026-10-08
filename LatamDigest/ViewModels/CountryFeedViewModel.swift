import Foundation
import Combine
import SwiftUI

/// View model for displaying a list of articles for a selected country.
/// Supports loading top headlines, latest headlines or specific categories.
@MainActor
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

    @Published private(set) var articles: [Article] = []
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published private(set) var feedResult: FeedResult?
    private var loadID = UUID()
    private let service: NewsService

    init(service: NewsService? = nil) { self.service = service ?? .shared }

    func loadArticles(for country: String, feed: FeedType) async {
        let id = UUID()
        loadID = id
        isLoading = true
        errorMessage = nil
        articles = []
        feedResult = nil
        defer { if loadID == id { isLoading = false } }
        do {
            let result = try await service.fetchFeed(countryCode: country, feed: feed)
            try Task.checkCancellation()
            guard loadID == id else { return }
            articles = result.articles
            feedResult = result
        } catch {
            guard loadID == id, !Task.isCancelled, !(error is CancellationError) else { return }
            errorMessage = error.localizedDescription
        }
    }
}
