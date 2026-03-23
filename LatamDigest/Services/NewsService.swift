import Foundation

/// A simple networking layer responsible for fetching headlines from the
/// backend.  Replace `baseURL` with your actual API endpoint and
/// implement the network requests as needed.  For demonstration
/// purposes this service returns sample data when the network is not
/// available.
final class NewsService {
    static let shared = NewsService()
    private init() {}

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
    /// reasonable timeout.
    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 10
        config.timeoutIntervalForResource = 30
        return URLSession(configuration: config)
    }()

    // MARK: - Public API

    /// Fetches the top headlines for a given country.  Returns a list of
    /// `Article` objects sorted by publication time (descending).  If
    /// there is no backend available, returns sample data.  Errors are
    /// propagated to the caller.
    func fetchTopArticles(countryCode: String) async throws -> [Article] {
        // Construct the URL.  For example: /countries/MX/top
        let requestURL = baseURL.appendingPathComponent("countries")
            .appendingPathComponent(countryCode)
            .appendingPathComponent("top")

        do {
            let (data, response) = try await session.data(from: requestURL)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                throw URLError(.badServerResponse)
            }
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode([Article].self, from: data)
        } catch {
            // Fallback to sample data on error (useful during development).
            return sampleArticles(for: countryCode)
        }
    }

    /// Fetches the latest headlines for a given country.
    func fetchLatestArticles(countryCode: String) async throws -> [Article] {
        let requestURL = baseURL.appendingPathComponent("countries")
            .appendingPathComponent(countryCode)
            .appendingPathComponent("latest")
        do {
            let (data, response) = try await session.data(from: requestURL)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                throw URLError(.badServerResponse)
            }
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode([Article].self, from: data)
        } catch {
            return sampleArticles(for: countryCode)
        }
    }

    /// Fetches headlines for a given country and category (e.g. politics,
    /// business, sports).  The backend should normalise category names.
    func fetchArticles(countryCode: String, category: String) async throws -> [Article] {
        let requestURL = baseURL.appendingPathComponent("countries")
            .appendingPathComponent(countryCode)
            .appendingPathComponent("category")
            .appendingPathComponent(category)
        do {
            let (data, response) = try await session.data(from: requestURL)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                throw URLError(.badServerResponse)
            }
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode([Article].self, from: data)
        } catch {
            return sampleArticles(for: countryCode)
        }
    }

    // MARK: - Sample Data

    /// Generates some sample articles to populate the UI while the
    /// backend is unavailable.  Each call returns a few random articles.
    private func sampleArticles(for countryCode: String) -> [Article] {
        let now = Date()
        // Hardcoded sample articles; you should adjust these for your
        // development needs or remove them once your API is live.
        return [
            Article(
                id: UUID(),
                title: "Gobierno anuncia nuevas medidas económicas",
                snippet: "El ministerio de economía comunicó un paquete de medidas para impulsar la inversión.",
                url: URL(string: "https://news.example.com/article1")!,
                sourceName: "La Nación",
                sourceLogoURL: nil,
                publishedAt: now.addingTimeInterval(-3600)
            ),
            Article(
                id: UUID(),
                title: "El equipo local gana el clásico",
                snippet: "En un emocionante encuentro, el equipo de la capital se impuso 3-2 a su rival.",
                url: URL(string: "https://news.example.com/article2")!,
                sourceName: "Deportes Hoy",
                sourceLogoURL: nil,
                publishedAt: now.addingTimeInterval(-7200)
            ),
            Article(
                id: UUID(),
                title: "Descubren nueva especie de árbol en la Amazonia",
                snippet: "Investigadores revelan el hallazgo de una especie desconocida hasta ahora en la región.",
                url: URL(string: "https://news.example.com/article3")!,
                sourceName: "Ciencia al Día",
                sourceLogoURL: nil,
                publishedAt: now.addingTimeInterval(-10800)
            )
        ]
    }
}
