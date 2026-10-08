import Foundation
import Testing
import UserNotifications
@testable import LatamDigest

@Suite(.serialized)
@MainActor
struct LatamDigestTests {
    private func payload(url: String = "https://example.com/story", date: String = "2026-10-07T12:00:00.000Z") -> Data {
        Data("""
        [{"id":"\(UUID().uuidString)","title":"Economía de México","snippet":"Budget outlook","url":"\(url)","sourceName":"Example","publishedAt":"\(date)"}]
        """.utf8)
    }

    @Test func acceptsFractionalAndWholeSecondDates() throws {
        let fractional = try NewsService.decodeArticles(payload())
        let whole = try NewsService.decodeArticles(payload(date: "2026-10-07T12:00:00Z"))
        #expect(fractional.first?.publishedAt == whole.first?.publishedAt)
    }
    @Test func IDsSurviveServerRegeneration() throws {
        #expect(try NewsService.decodeArticles(payload()).first?.id == NewsService.decodeArticles(payload()).first?.id)
    }
    @Test func duplicatesAreRemoved() throws {
        let one = try JSONSerialization.jsonObject(with: payload()) as! [[String: Any]]
        let doubled = try JSONSerialization.data(withJSONObject: one + one)
        #expect(try NewsService.decodeArticles(doubled).count == 1)
    }
    @Test func unsafeArticleLinksAreRejected() {
        for url in ["javascript:alert(1)", "file:///etc/passwd", "https://user:password@example.com"] {
            #expect(throws: (any Error).self) { try NewsService.decodeArticles(payload(url: url)) }
        }
    }
    @Test func searchIgnoresAccentsAndMatchesSources() throws {
        let articles = try NewsService.decodeArticles(payload())
        #expect(ArticleSearch.filter(articles, query: "economia mexico").count == 1)
        #expect(ArticleSearch.filter(articles, query: "example budget").count == 1)
        #expect(ArticleSearch.filter(articles, query: "unrelated").isEmpty)
        #expect(ArticleSearch.filter(articles, query: "   ").count == 1)
    }
    @Test func remindersUseChosenLanguageWithoutStaleHeadlines() {
        let english = NotificationManager.reminderContent(countryCode: "MX", languageCode: "en")
        let spanish = NotificationManager.reminderContent(countryCode: "MX", languageCode: "es")
        #expect(english.body.contains("Open Latam Digest"))
        #expect(spanish.body.contains("Abre Latam Digest"))
        #expect(english.body != spanish.body)
    }
    @Test func cachedNewsSurvivesOfflineFailure() async throws {
        let (service, directory) = makeService()
        defer { try? FileManager.default.removeItem(at: directory) }
        StubURLProtocol.response = (200, payload())
        let online = try await service.fetchFeed(countryCode: "MX", feed: .top)
        StubURLProtocol.response = (503, Data())
        let offline = try await service.fetchFeed(countryCode: "MX", feed: .top)
        #expect(!online.isCached)
        #expect(offline.isCached)
        #expect(online.articles == offline.articles)
        #expect(abs(online.fetchedAt.timeIntervalSince(offline.fetchedAt)) < 0.001)
    }
    @Test func cacheDoesNotCrossHosts() async throws {
        let (first, directory) = makeService()
        defer { try? FileManager.default.removeItem(at: directory) }
        StubURLProtocol.response = (200, payload())
        _ = try await first.fetchFeed(countryCode: "MX", feed: .top)
        let second = NewsService(baseURL: URL(string: "https://other.example.com"), session: stubSession(), cacheDirectory: directory, retryDelays: [0])
        StubURLProtocol.response = (503, Data())
        await #expect(throws: (any Error).self) { try await second.fetchFeed(countryCode: "MX", feed: .top) }
    }
    @Test func cancellationDoesNotReturnCachedSuccess() async throws {
        let (service, directory) = makeService()
        defer { try? FileManager.default.removeItem(at: directory) }
        StubURLProtocol.response = (200, payload())
        _ = try await service.fetchFeed(countryCode: "MX", feed: .top)
        let task = Task { try await service.fetchFeed(countryCode: "MX", feed: .top) }
        task.cancel()
        await #expect(throws: CancellationError.self) { try await task.value }
    }
    @Test func olderRequestCannotReplaceNewerFeed() async throws {
        let (service, directory) = makeService()
        defer { try? FileManager.default.removeItem(at: directory); StubURLProtocol.delay = 0 }
        let model = CountryFeedViewModel(service: service)
        StubURLProtocol.response = (200, payload(url: "https://example.com/old"))
        StubURLProtocol.delay = 0.15
        let first = Task { await model.loadArticles(for: "MX", feed: .top) }
        try await Task.sleep(for: .milliseconds(50))
        StubURLProtocol.response = (200, payload(url: "https://example.com/new"))
        StubURLProtocol.delay = 0
        await model.loadArticles(for: "MX", feed: .latest)
        await first.value
        #expect(model.articles.first?.url.absoluteString == "https://example.com/new")
        #expect(!model.isLoading)
    }
    @Test func insecureFeedConfigurationIsRejected() async {
        let service = NewsService(baseURL: URL(string: "http://example.com"), retryDelays: [0])
        await #expect(throws: NewsService.NewsServiceError.self) { try await service.fetchFeed(countryCode: "MX", feed: .top) }
    }
    private func stubSession() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubURLProtocol.self]
        return URLSession(configuration: config)
    }
    private func makeService() -> (NewsService, URL) {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        return (NewsService(baseURL: URL(string: "https://example.com"), session: stubSession(), cacheDirectory: directory, retryDelays: [0]), directory)
    }
}

// Tests using the shared URLProtocol response run serially to keep network fixtures isolated.
final class StubURLProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var response: (Int, Data) = (200, Data())
    nonisolated(unsafe) static var delay: TimeInterval = 0
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        let (status, data) = Self.response
        if Self.delay > 0 { Thread.sleep(forTimeInterval: Self.delay) }
        client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}
