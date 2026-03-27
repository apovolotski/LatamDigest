import Combine
import Foundation
import SwiftUI

@MainActor
final class MonitoringWorkspaceViewModel: ObservableObject {
    @Published private(set) var allCountries: [Country] = []
    @Published private(set) var articlesByCountry: [String: [Article]] = [:]
    @Published var isLoading = false
    @Published var errorMessage: String?

    init() {
        allCountries = CountryCatalog.loadCountries()
    }

    func countries(for codes: [String], languageCode: String) -> [Country] {
        allCountries
            .filter { codes.contains($0.id) }
            .sorted { $0.localizedName(languageCode: languageCode) < $1.localizedName(languageCode: languageCode) }
    }

    func load(countryCodes: [String]) async {
        guard !countryCodes.isEmpty else {
            articlesByCountry = [:]
            return
        }

        isLoading = true
        errorMessage = nil

        var loaded: [String: [Article]] = [:]

        await withTaskGroup(of: (String, [Article]?).self) { group in
            for code in countryCodes {
                group.addTask {
                    do {
                        let articles = try await NewsService.shared.fetchTopArticles(countryCode: code)
                        return (code, articles)
                    } catch {
                        return (code, nil)
                    }
                }
            }

            for await result in group {
                loaded[result.0] = (result.1 ?? []).sorted(by: { $0.publishedAt > $1.publishedAt })
            }
        }

        articlesByCountry = loaded
        isLoading = false

        if loaded.values.allSatisfy(\.isEmpty) {
            errorMessage = NewsService.NewsServiceError.feedUnavailable.localizedDescription
        }
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
