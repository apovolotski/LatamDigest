import Foundation
import Combine
import SwiftUI

@MainActor
final class ReadingLibrary: ObservableObject {
    static let shared = ReadingLibrary()

    @Published private(set) var savedArticles: [Article] = []
    @Published private(set) var readingHistory: [Article] = []

    private let defaults = UserDefaults.standard
    private let savedKey = "savedArticles"
    private let historyKey = "readingHistory"
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private init() {
        decoder.dateDecodingStrategy = .iso8601
        encoder.dateEncodingStrategy = .iso8601
        loadPersistedState()
    }

    func isSaved(_ article: Article) -> Bool {
        savedArticles.contains(where: { $0.storageKey == article.storageKey })
    }

    func toggleSaved(_ article: Article) {
        if isSaved(article) {
            savedArticles.removeAll { $0.storageKey == article.storageKey }
        } else {
            savedArticles.insert(article, at: 0)
        }

        persist(savedArticles, key: savedKey)
    }

    func markAsRead(_ article: Article) {
        readingHistory.removeAll { $0.storageKey == article.storageKey }
        readingHistory.insert(article, at: 0)
        readingHistory = Array(readingHistory.prefix(30))
        persist(readingHistory, key: historyKey)
    }

    private func loadPersistedState() {
        savedArticles = decodeArticles(forKey: savedKey)
        readingHistory = decodeArticles(forKey: historyKey)
    }

    private func decodeArticles(forKey key: String) -> [Article] {
        guard let data = defaults.data(forKey: key) else {
            return []
        }

        return (try? decoder.decode([Article].self, from: data)) ?? []
    }

    private func persist(_ articles: [Article], key: String) {
        guard let data = try? encoder.encode(articles) else {
            return
        }

        defaults.set(data, forKey: key)
    }
}
