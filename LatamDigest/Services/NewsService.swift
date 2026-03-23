import Foundation

/// A simple networking layer responsible for fetching headlines from the
/// backend.
final class NewsService {
    static let shared = NewsService()
    private init() {}

    enum NewsServiceError: LocalizedError {
        case backendUnavailable
        case serverError(String)
        case invalidResponse

        var errorDescription: String? {
            switch self {
            case .backendUnavailable:
                return "Latam Digest is temporarily unavailable. Please try again in a minute."
            case .serverError(let message):
                return message
            case .invalidResponse:
                return "Latam Digest returned data in an unexpected format."
            }
        }
    }

    /// The base URL of your backend API.  This can be set in the app's
    /// Info.plist via the `LATAM_BACKEND_URL` key.
    var baseURL: URL = {
        if
            let configured = Bundle.main.object(forInfoDictionaryKey: "LATAM_BACKEND_URL") as? String,
            let url = URL(string: configured),
            !configured.isEmpty
        {
            return url
        }

        return URL(string: "https://api.example.com")!
    }()

    /// The URLSession used for network requests.  Configured with a
    /// longer timeout because the hosted backend can take time to wake up.
    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 180
        config.timeoutIntervalForResource = 240
        return URLSession(configuration: config)
    }()

    func fetchTopArticles(countryCode: String) async throws -> [Article] {
        let requestURL = baseURL.appendingPathComponent("countries")
            .appendingPathComponent(countryCode)
            .appendingPathComponent("top")
        return try await loadArticles(from: requestURL)
    }

    func fetchLatestArticles(countryCode: String) async throws -> [Article] {
        let requestURL = baseURL.appendingPathComponent("countries")
            .appendingPathComponent(countryCode)
            .appendingPathComponent("latest")
        return try await loadArticles(from: requestURL)
    }

    func fetchArticles(countryCode: String, category: String) async throws -> [Article] {
        let requestURL = baseURL.appendingPathComponent("countries")
            .appendingPathComponent(countryCode)
            .appendingPathComponent("category")
            .appendingPathComponent(category)
        return try await loadArticles(from: requestURL)
    }

    private func loadArticles(from url: URL) async throws -> [Article] {
        let retryDelays: [UInt64] = [0, 8_000_000_000, 15_000_000_000]
        var lastError: Error?

        for delay in retryDelays {
            if delay > 0 {
                try? await Task.sleep(nanoseconds: delay)
            }

            do {
                try await warmBackendIfNeeded()
                let (data, response) = try await session.data(from: url)
                guard let http = response as? HTTPURLResponse else {
                    throw NewsServiceError.invalidResponse
                }

                guard http.statusCode == 200 else {
                    if let apiError = try? JSONDecoder().decode(APIErrorResponse.self, from: data) {
                        throw NewsServiceError.serverError(apiError.error)
                    }

                    throw NewsServiceError.backendUnavailable
                }

                let decoder = JSONDecoder()
                decoder.dateDecodingStrategy = .iso8601
                return try decoder.decode([Article].self, from: data)
            } catch let error as DecodingError {
                lastError = error
            } catch let error as NewsServiceError {
                lastError = error

                switch error {
                case .backendUnavailable:
                    continue
                case .serverError, .invalidResponse:
                    throw error
                }
            } catch {
                lastError = error
            }
        }

        if let serviceError = lastError as? NewsServiceError {
            throw serviceError
        }

        if lastError is DecodingError {
            throw NewsServiceError.invalidResponse
        }

        throw NewsServiceError.backendUnavailable
    }

    private func warmBackendIfNeeded() async throws {
        let healthURL = baseURL.appendingPathComponent("health")
        var request = URLRequest(url: healthURL)
        request.timeoutInterval = 30
        _ = try? await session.data(for: request)
    }
}

private struct APIErrorResponse: Decodable {
    let error: String
}
