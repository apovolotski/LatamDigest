import Foundation

/// A simple networking layer responsible for fetching headlines from a
/// static JSON feed.
final class NewsService {
    static let shared = NewsService()
    private init() {}

    enum NewsServiceError: LocalizedError {
        case feedUnavailable
        case serverError(String)
        case invalidResponse

        var errorDescription: String? {
            switch self {
            case .feedUnavailable:
                return "Latam Digest is temporarily unavailable. Please try again in a minute."
            case .serverError(let message):
                return message
            case .invalidResponse:
                return "Latam Digest returned data in an unexpected format."
            }
        }
    }

    /// The base URL of the app's JSON feed. This can be set in the app's
    /// Info.plist via the `LATAM_BACKEND_URL` key.
    var baseURL: URL = {
        if
            let configured = Bundle.main.object(forInfoDictionaryKey: "LATAM_BACKEND_URL") as? String,
            let url = URL(string: configured),
            !configured.isEmpty
        {
            return url
        }

        return URL(string: "https://raw.githubusercontent.com/apovolotski/LatamDigest/main/docs/api")!
    }()

    /// The URLSession used for network requests.
    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 60
        config.timeoutIntervalForResource = 90
        return URLSession(configuration: config)
    }()

    func fetchTopArticles(countryCode: String) async throws -> [Article] {
        let requestURL = feedURL(components: ["countries", countryCode, "top"])
        return try await loadArticles(from: requestURL)
    }

    func fetchLatestArticles(countryCode: String) async throws -> [Article] {
        let requestURL = feedURL(components: ["countries", countryCode, "latest"])
        return try await loadArticles(from: requestURL)
    }

    func fetchArticles(countryCode: String, category: String) async throws -> [Article] {
        let requestURL = feedURL(components: ["countries", countryCode, "category", category])
        return try await loadArticles(from: requestURL)
    }

    private func loadArticles(from url: URL) async throws -> [Article] {
        let retryDelays: [UInt64] = [0, 2_000_000_000, 5_000_000_000]
        var lastError: Error?

        for delay in retryDelays {
            if delay > 0 {
                try? await Task.sleep(nanoseconds: delay)
            }

            do {
                let (data, response) = try await session.data(from: url)
                guard let http = response as? HTTPURLResponse else {
                    throw NewsServiceError.invalidResponse
                }

                guard http.statusCode == 200 else {
                    if let apiError = try? JSONDecoder().decode(APIErrorResponse.self, from: data) {
                        throw NewsServiceError.serverError(apiError.error)
                    }

                    throw NewsServiceError.feedUnavailable
                }

                let decoder = JSONDecoder()
                decoder.dateDecodingStrategy = .iso8601
                let articles = try decoder.decode([Article].self, from: data)
                persistCache(data: data, for: url)
                return articles
            } catch let error as DecodingError {
                lastError = error
            } catch let error as NewsServiceError {
                lastError = error

                switch error {
                case .feedUnavailable:
                    continue
                case .serverError, .invalidResponse:
                    throw error
                }
            } catch {
                lastError = error
            }
        }

        if let cachedArticles = loadCachedArticles(for: url) {
            return cachedArticles
        }

        if let serviceError = lastError as? NewsServiceError {
            throw serviceError
        }

        if lastError is DecodingError {
            throw NewsServiceError.invalidResponse
        }

        throw NewsServiceError.feedUnavailable
    }

    private func feedURL(components: [String]) -> URL {
        var url = baseURL

        for component in components {
            url.appendPathComponent(component)
        }

        if usesStaticJSON {
            url.appendPathExtension("json")
        }

        return url
    }

    private var usesStaticJSON: Bool {
        guard let host = baseURL.host?.lowercased() else {
            return false
        }

        return host.contains("raw.githubusercontent.com") || host.contains("github.io")
    }

    private func persistCache(data: Data, for url: URL) {
        guard let cacheURL = cacheFileURL(for: url) else { return }
        try? FileManager.default.createDirectory(
            at: cacheURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try? data.write(to: cacheURL, options: .atomic)
    }

    private func loadCachedArticles(for url: URL) -> [Article]? {
        guard
            let cacheURL = cacheFileURL(for: url),
            let data = try? Data(contentsOf: cacheURL)
        else {
            return nil
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode([Article].self, from: data)
    }

    private func cacheFileURL(for url: URL) -> URL? {
        guard let cachesDirectory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
            return nil
        }

        let sanitizedPath = url.path.replacingOccurrences(of: "/", with: "_")
        return cachesDirectory
            .appendingPathComponent("LatamDigestFeedCache", isDirectory: true)
            .appendingPathComponent("\(sanitizedPath).json")
    }
}

private struct APIErrorResponse: Decodable {
    let error: String
}
