#if JAPAN_EDITION
import Foundation

/// Reads headline metadata only. Full text and publisher images are never fetched or copied.
nonisolated final class JapanRSSParser: NSObject, XMLParserDelegate {
    private var articles: [Article] = []
    private var values: [String: String] = [:]
    private var element = ""
    private var inItem = false
    private var sourceURL: URL?
    private let source: JapanSource
    private var seen = Set<String>()
    private var isRSS = false
    private let now: Date

    init(source: JapanSource, now: Date = .now) {
        self.source = source
        self.now = now
    }

    func decode(_ data: Data) throws -> [Article] {
        guard data.count <= 2_000_000,
              let xml = String(data: data, encoding: .utf8),
              !xml.localizedCaseInsensitiveContains("<!DOCTYPE"),
              !xml.localizedCaseInsensitiveContains("<!ENTITY") else {
            throw NewsService.NewsServiceError.invalidResponse
        }
        let parser = XMLParser(data: data)
        parser.shouldResolveExternalEntities = false
        parser.delegate = self
        guard parser.parse(), isRSS else { throw NewsService.NewsServiceError.invalidResponse }
        return articles.sorted { $0.publishedAt > $1.publishedAt }.prefix(60).map { $0 }
    }

    func parser(_ parser: XMLParser, didStartElement elementName: String, namespaceURI: String?, qualifiedName: String?, attributes: [String: String]) {
        if elementName == "rss" { isRSS = true }
        if elementName == "item" { inItem = true; values = [:]; sourceURL = nil }
        guard inItem else { return }
        element = elementName
        if elementName == "source" { sourceURL = attributes["url"].flatMap(URL.init(string:)) }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        guard inItem, ["title", "link", "pubDate", "source"].contains(element) else { return }
        values[element, default: ""] += string
    }

    func parser(_ parser: XMLParser, foundCDATA CDATABlock: Data) {
        if let text = String(data: CDATABlock, encoding: .utf8) { self.parser(parser, foundCharacters: text) }
    }

    func parser(_ parser: XMLParser, didEndElement elementName: String, namespaceURI: String?, qualifiedName: String?) {
        guard elementName == "item" else { element = ""; return }
        defer { inItem = false; element = "" }
        let title = values["title"]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let sourceName = values["source"]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !title.isEmpty, title.count <= 1000, !sourceName.isEmpty,
              title.unicodeScalars.contains(where: { (0x3040...0x30FF).contains($0.value) || (0x3400...0x9FFF).contains($0.value) }),
              let sourceURL, sourceURL.scheme == "https", sourceURL.user == nil, sourceURL.password == nil,
              let host = sourceURL.host?.lowercased(), host == source.domain || host.hasSuffix("." + source.domain),
              let link = values["link"]?.trimmingCharacters(in: .whitespacesAndNewlines),
              let url = URL(string: link), url.scheme == "https", url.host == "news.google.com",
              url.user == nil, url.password == nil, url.path.hasPrefix("/rss/articles/"),
              let dateString = values["pubDate"] else { return }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss zzz"
        guard let date = formatter.date(from: dateString), date <= now.addingTimeInterval(3600),
              now.timeIntervalSince(date) <= 7 * 24 * 3600,
              seen.insert(url.absoluteString).inserted else { return }
        articles.append(Article(id: Article.stableID(for: url), title: title, snippet: "", url: url,
                                sourceName: sourceName, publishedAt: date))
    }
}
#endif
