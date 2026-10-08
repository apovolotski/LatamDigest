import Combine
import Foundation
import SwiftUI

@MainActor
final class MonitoringWorkspaceViewModel: ObservableObject {
    @Published private(set) var allCountries: [Country] = []
    @Published private(set) var articlesByCountry: [String: [Article]] = [:]
    @Published var isLoading = false
    @Published var errorMessage: String?

    @Published private(set) var cachedCountryCodes: [String] = []
    @Published private(set) var unavailableCountryCodes: [String] = []
    @Published private(set) var lastUpdated: Date?
    private var loadID = UUID()

    init() {
        allCountries = CountryCatalog.loadCountries()
    }

    func countries(for codes: [String], languageCode: String) -> [Country] {
        allCountries
            .filter { codes.contains($0.id) }
            .sorted { $0.localizedName(languageCode: languageCode) < $1.localizedName(languageCode: languageCode) }
    }

    func load(countryCodes: [String]) async {
        let id = UUID()
        loadID = id
        let codes = Array(Set(countryCodes)).sorted()
        isLoading = true
        errorMessage = nil
        defer { if loadID == id { isLoading = false } }
        guard !codes.isEmpty else {
            articlesByCountry = [:]
            cachedCountryCodes = []
            unavailableCountryCodes = []
            lastUpdated = nil
            return
        }
        var results: [String: FeedResult] = [:]
        await withTaskGroup(of: (String, FeedResult?).self) { group in
            for code in codes {
                group.addTask {
                    do { return (code, try await NewsService.shared.fetchFeed(countryCode: code, feed: .top)) }
                    catch { return (code, nil) }
                }
            }
            for await (code, result) in group { if let result { results[code] = result } }
        }
        guard !Task.isCancelled, loadID == id else { return }
        articlesByCountry = results.mapValues(\.articles)
        cachedCountryCodes = codes.filter { results[$0]?.isCached == true }
        unavailableCountryCodes = codes.filter { results[$0] == nil }
        lastUpdated = results.values.map(\.fetchedAt).min()
        if !unavailableCountryCodes.isEmpty { errorMessage = NewsService.NewsServiceError.feedUnavailable.localizedDescription }
    }

    func evidence(for countryCode: String) -> [Article] {
        articlesByCountry[countryCode] ?? []
    }

    func allEvidence(for countryCodes: [String]) -> [Article] {
        countryCodes
            .flatMap { articlesByCountry[$0] ?? [] }
            .sorted(by: { $0.publishedAt > $1.publishedAt })
    }
}
