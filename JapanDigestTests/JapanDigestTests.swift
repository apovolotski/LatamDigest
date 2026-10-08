import Foundation
import Testing
import UserNotifications
@testable import JapanDigest

@Suite(.serialized)
@MainActor
struct JapanDigestTests {
    private let source = JapanSource.all[0]
    private let now = Date(timeIntervalSince1970: 1_791_504_000)

    private func rss(title: String = "日本の経済と半導体", link: String = "https://news.google.com/rss/articles/story1", sourceURL: String = "https://news.web.nhk", date: Date? = nil) -> Data {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss zzz"
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return Data("""
        <rss version="2.0"><channel><item><title>\(title)</title><link>\(link)</link><pubDate>\(formatter.string(from: date ?? now))</pubDate><source url="\(sourceURL)">NHKニュース</source><description>Never copy this description</description></item></channel></rss>
        """.utf8)
    }

    @Test func editionHasJapaneseNameAndSeparateIdentity() {
        #expect(AppEdition.isJapan)
        #expect(AppEdition.defaultLanguage == "ja")
        #expect(AppLanguage.supportedLanguageCode(from: "en-US") == "ja")
        #expect(Bundle.main.bundleIdentifier == "com.apovolotski.JapanDigest")
        #expect(Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String == "日本ニュース手帖")
        #expect(AppLanguage.localized("library_title", languageCode: "ja") == "ライブラリ")
        #expect(CountryCatalog.loadCountries().map(\.id) == JapanSource.all.map(\.id))
    }
    @Test func queriesPinJapanLanguageAndPublisher() throws {
        for source in JapanSource.all {
            let url = try JapanSource.feedURL(sourceID: source.id)
            let query = Dictionary(uniqueKeysWithValues: URLComponents(url: url, resolvingAgainstBaseURL: false)!.queryItems!.map { ($0.name, $0.value!) })
            #expect(query["hl"] == "ja" && query["gl"] == "JP" && query["ceid"] == "JP:ja")
            #expect(query["q"]?.contains("site:" + source.domain) == true)
            #expect(url.scheme == "https")
        }
        #expect(throws: (any Error).self) { try JapanSource.feedURL(sourceID: "MX") }
    }
    @Test func readsJapaneseMetadataWithoutPublisherText() throws {
        let articles = try JapanRSSParser(source: source, now: now).decode(rss())
        #expect(articles.count == 1)
        #expect(articles[0].title == "日本の経済と半導体")
        #expect(articles[0].sourceName == "NHKニュース")
        #expect(articles[0].snippet.isEmpty)
        #expect(articles[0].publishedAt == now)
        #expect(articles[0].sourceLogoURL == nil)
    }
    @Test func deduplicatesAndKeepsStableIdentity() throws {
        let first = try JapanRSSParser(source: source, now: now).decode(rss())
        let second = try JapanRSSParser(source: source, now: now).decode(rss())
        #expect(first[0].id == second[0].id)
        let text = String(data: rss(), encoding: .utf8)!
        let item = text.components(separatedBy: "<item>")[1].components(separatedBy: "</item>")[0]
        let duplicate = text.replacingOccurrences(of: "</channel>", with: "<item>" + item + "</item></channel>")
        #expect(try JapanRSSParser(source: source, now: now).decode(Data(duplicate.utf8)).count == 1)
    }
    @Test func rejectsSpoofedSourcesUnsafeLinksAndForeignLanguage() throws {
        for data in [rss(sourceURL: "https://evilnews.web.nhk"), rss(link: "javascript:alert(1)"), rss(sourceURL: "http://news.web.nhk"), rss(title: "English only headline"), rss(link: "https://user:pass@news.google.com/rss/articles/test"), rss(link: "https://evil.example.com/story")] {
            #expect(try JapanRSSParser(source: source, now: now).decode(data).isEmpty)
        }
    }
    @Test func rejectsOldFutureMalformedAndEntityFeeds() throws {
        #expect(try JapanRSSParser(source: source, now: now).decode(rss(date: now.addingTimeInterval(-8 * 86400))).isEmpty)
        #expect(try JapanRSSParser(source: source, now: now).decode(rss(date: now.addingTimeInterval(7200))).isEmpty)
        for bad in ["<!DOCTYPE rss [<!ENTITY x SYSTEM 'file:///etc/passwd'>]><rss/>", "<html>not a feed</html>", "<rss><broken>"] {
            #expect(throws: (any Error).self) { try JapanRSSParser(source: source, now: now).decode(Data(bad.utf8)) }
        }
    }
    @Test func JapaneseTopicsAndWidthInsensitiveSearch() throws {
        let articles = try JapanRSSParser(source: source, now: now).decode(rss(title: "ＡＩと半導体で経済を支える"))
        #expect(SignalEngine.relevantArticles(for: .technology, in: articles).count == 1)
        #expect(SignalEngine.relevantArticles(for: .economy, in: articles).count == 1)
        #expect(ArticleSearch.filter(articles, query: "AI 半導体").count == 1)
        #expect(ArticleSearch.filter(articles, query: "NHK").count == 1)
        #expect(ArticleSearch.filter(articles, query: "選挙").isEmpty)
    }
    @Test func reminderIsJapaneseAndContainsNoStaleHeadline() {
        let content = NotificationManager.reminderContent(countryCode: "JP", languageCode: "en")
        #expect(content.title == "日本ニュース手帖")
        #expect(content.body.contains("アプリを開く"))
    }
    @Test func cachedFeedSurvivesOfflineAndCancellation() async throws {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [JapanURLProtocol.self]
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let service = NewsService(session: URLSession(configuration: config), cacheDirectory: directory, retryDelays: [0])
        JapanURLProtocol.response = (200, rss(date: .now))
        let online = try await service.fetchFeed(countryCode: "NH", feed: .top)
        #expect(online.articles.count == 1 && !online.isCached)
        JapanURLProtocol.response = (503, Data())
        let offline = try await service.fetchFeed(countryCode: "NH", feed: .top)
        #expect(offline.isCached && offline.articles == online.articles)
        await #expect(throws: (any Error).self) { try await service.fetchFeed(countryCode: "AS", feed: .top) }
        let cancelled = Task { try await service.fetchFeed(countryCode: "NH", feed: .top) }
        cancelled.cancel()
        await #expect(throws: CancellationError.self) { try await cancelled.value }
    }
    @Test func arbitraryBackendAndUnknownSourceAreRejected() async {
        let service = NewsService(baseURL: URL(string: "https://untrusted.example.com"), retryDelays: [0])
        await #expect(throws: (any Error).self) { try await service.fetchFeed(countryCode: "NH", feed: .top) }
    }
}

final class JapanURLProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var response: (Int, Data) = (200, Data())
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        let (status, data) = Self.response
        client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}
