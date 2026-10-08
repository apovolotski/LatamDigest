import Foundation
import CryptoKit

struct FeedResult {
    let articles: [Article]
    let fetchedAt: Date
    let isCached: Bool
}

/// Public feed reader. AI credentials belong exclusively on a backend.
@MainActor
final class NewsService {
    static let shared = NewsService()
    #if JAPAN_EDITION
    static let defaultURL = URL(string: "https://news.google.com/rss/search")!
    #else
    static let defaultURL = URL(string: "https://raw.githubusercontent.com/apovolotski/LatamDigest/main/docs/api")!
    #endif

    enum NewsServiceError: LocalizedError {
        case feedUnavailable, invalidResponse, invalidConfiguration
        var errorDescription: String? {
            switch self {
            case .feedUnavailable: return AppEdition.isJapan ? "ニュースを取得できません。接続を確認して再度お試しください。" : "Latam Digest is temporarily unavailable. Please try again."
            case .invalidResponse: return AppEdition.isJapan ? "ニュースフィードを読み込めませんでした。" : "Latam Digest returned data in an unexpected format."
            case .invalidConfiguration: return AppEdition.isJapan ? "配信元の設定を確認してください。" : "The news feed must use a secure HTTPS address."
            }
        }
    }

    let baseURL: URL
    private let session: URLSession
    private let cacheDirectory: URL?
    private let retryDelays: [UInt64]

    init(baseURL: URL? = nil, session: URLSession? = nil, cacheDirectory: URL? = nil,
         retryDelays: [UInt64] = [0, 500_000_000]) {
        let configured = Bundle.main.object(forInfoDictionaryKey: "LATAM_BACKEND_URL") as? String
        self.baseURL = baseURL ?? configured.flatMap(URL.init(string:)) ?? Self.defaultURL
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 15
        configuration.timeoutIntervalForResource = 30
        self.session = session ?? URLSession(configuration: configuration)
        self.cacheDirectory = cacheDirectory ?? FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?
            .appendingPathComponent(AppEdition.isJapan ? "JapanDigestFeedCache-v1" : "LatamDigestFeedCache-v2", isDirectory: true)
        self.retryDelays = retryDelays.isEmpty ? [0] : retryDelays
    }

    func fetchTopArticles(countryCode: String) async throws -> [Article] {
        try await fetchFeed(countryCode: countryCode, feed: .top).articles
    }
    func fetchLatestArticles(countryCode: String) async throws -> [Article] {
        try await fetchFeed(countryCode: countryCode, feed: .latest).articles
    }
    func fetchArticles(countryCode: String, category: String) async throws -> [Article] {
        guard let feed = CountryFeedViewModel.FeedType.allCases.first(where: { $0.categoryKey == category }) else {
            throw NewsServiceError.invalidResponse
        }
        return try await fetchFeed(countryCode: countryCode, feed: feed).articles
    }

    func fetchFeed(countryCode: String, feed: CountryFeedViewModel.FeedType) async throws -> FeedResult {
        guard baseURL.scheme?.lowercased() == "https", baseURL.host != nil,
              baseURL.user == nil, baseURL.password == nil else { throw NewsServiceError.invalidConfiguration }
        #if JAPAN_EDITION
        guard let source = JapanSource.all.first(where: { $0.id == countryCode }), baseURL == Self.defaultURL else {
            throw NewsServiceError.invalidConfiguration
        }
        return try await loadArticles(from: JapanSource.feedURL(sourceID: countryCode, feed: feed), source: source)
        #else
        guard countryCode.count == 2, countryCode.unicodeScalars.allSatisfy({ (65...90).contains(Int($0.value)) }) else {
            throw NewsServiceError.invalidResponse
        }
        var url = baseURL.appendingPathComponent("countries").appendingPathComponent(countryCode)
        if let category = feed.categoryKey { url.appendPathComponent("category"); url.appendPathComponent(category) }
        else { url.appendPathComponent(feed == .top ? "top" : "latest") }
        let host = baseURL.host?.lowercased() ?? ""
        if host == "raw.githubusercontent.com" || host.hasSuffix(".github.io") { url.appendPathExtension("json") }
        return try await loadArticles(from: url)
        #endif
    }

    #if JAPAN_EDITION
    private func loadArticles(from url: URL, source: JapanSource) async throws -> FeedResult {
        try await loadFeed(from: url) { data in try JapanRSSParser(source: source).decode(data) }
    }
    #else
    private func loadArticles(from url: URL) async throws -> FeedResult {
        try await loadFeed(from: url, decode: Self.decodeArticles)
    }
    #endif

    private func loadFeed(from url: URL, decode: (Data) throws -> [Article]) async throws -> FeedResult {
        var lastError: Error = NewsServiceError.feedUnavailable
        for (attempt, delay) in retryDelays.enumerated() {
            try Task.checkCancellation()
            if delay > 0 { try await Task.sleep(nanoseconds: delay) }
            do {
                var request = URLRequest(url: url)
                request.cachePolicy = .reloadIgnoringLocalCacheData
                let (data, response) = try await session.data(for: request)
                try Task.checkCancellation()
                guard let http = response as? HTTPURLResponse else { throw NewsServiceError.invalidResponse }
                guard http.url?.scheme == "https" else { throw NewsServiceError.invalidConfiguration }
                guard http.statusCode == 200 else {
                    if http.statusCode == 429 || http.statusCode >= 500 {
                        lastError = NewsServiceError.feedUnavailable
                        if attempt + 1 < retryDelays.count { continue }
                    }
                    throw NewsServiceError.feedUnavailable
                }
                guard data.count <= 2_000_000 else { throw NewsServiceError.invalidResponse }
                let articles = try decode(data)
                let fetchedAt = Date()
                persistCache(articles: articles, fetchedAt: fetchedAt, for: url)
                return FeedResult(articles: articles, fetchedAt: fetchedAt, isCached: false)
            } catch {
                if Task.isCancelled || error is CancellationError || (error as? URLError)?.code == .cancelled {
                    throw CancellationError()
                }
                lastError = error
                // Retry transient transport failures only; malformed data and client errors use the cache immediately.
                guard let networkError = error as? URLError,
                      [.timedOut, .networkConnectionLost, .cannotConnectToHost, .cannotFindHost, .dnsLookupFailed].contains(networkError.code)
                else { break }
            }
        }
        try Task.checkCancellation()
        if let cached = loadCache(for: url) { return cached }
        if lastError is DecodingError { throw NewsServiceError.invalidResponse }
        throw lastError
    }

    static func decodeArticles(_ data: Data) throws -> [Article] {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let value = try decoder.singleValueContainer().decode(String.self)
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: value) { return date }
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: value) { return date }
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Invalid publication date"))
        }
        var seen = Set<String>()
        return try decoder.decode([Article].self, from: data).filter { seen.insert($0.storageKey).inserted }
    }

    private struct CachedFeed: Codable {
        let articles: [Article]
        let fetchedAt: Date
    }
    private func cacheFileURL(for url: URL) -> URL? {
        let key = SHA256.hash(data: Data(url.absoluteString.utf8)).map { String(format: "%02x", $0) }.joined()
        return cacheDirectory?.appendingPathComponent(key + ".json")
    }
    private func persistCache(articles: [Article], fetchedAt: Date, for url: URL) {
        guard let directory = cacheDirectory, let file = cacheFileURL(for: url),
              let data = try? JSONEncoder().encode(CachedFeed(articles: articles, fetchedAt: fetchedAt)) else { return }
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try? data.write(to: file, options: .atomic)
    }
    private func loadCache(for url: URL) -> FeedResult? {
        guard let file = cacheFileURL(for: url), let data = try? Data(contentsOf: file),
              let cached = try? JSONDecoder().decode(CachedFeed.self, from: data),
              Date().timeIntervalSince(cached.fetchedAt) <= 7 * 24 * 3600 else { return nil }
        return FeedResult(articles: cached.articles, fetchedAt: cached.fetchedAt, isCached: true)
    }
}
