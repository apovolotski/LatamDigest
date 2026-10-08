import Foundation
import CryptoKit

/// Represents a news article headline returned from the backend.  Only
/// lightweight information is stored here; the actual content lives on
/// the publisher’s website and is opened in a WebView.  Conforms to
/// `Codable` for easy decoding from JSON.
public struct Article: Identifiable, Codable, Equatable, Hashable {
    /// Unique identifier used locally.  Decoded feeds derive this from the source URL.
    public let id: UUID
    /// Headline title.
    public let title: String
    /// A short snippet or excerpt of the article.  The backend should
    /// limit this to 150–200 characters.
    public let snippet: String
    /// The URL of the original article on the publisher’s website.
    public let url: URL
    /// Human‑readable name of the news source (e.g. “El País”).
    public let sourceName: String
    /// Optional URL pointing to a small logo for the source.  You can
    /// display this next to the headline.
    public let sourceLogoURL: URL?
    /// Publication date and time.
    public let publishedAt: Date

    public var storageKey: String {
        url.absoluteString
    }

    public enum CodingKeys: String, CodingKey {
        case id
        case title
        case snippet
        case url
        case sourceName
        case sourceLogoURL
        case publishedAt
    }

    public init(
        id: UUID = UUID(),
        title: String,
        snippet: String,
        url: URL,
        sourceName: String,
        sourceLogoURL: URL? = nil,
        publishedAt: Date
    ) {
        self.id = id
        self.title = title
        self.snippet = snippet
        self.url = url
        self.sourceName = sourceName
        self.sourceLogoURL = sourceLogoURL
        self.publishedAt = publishedAt
    }

    static func isWebURL(_ url: URL) -> Bool {
        ["http", "https"].contains(url.scheme?.lowercased() ?? "") && url.host != nil && url.user == nil && url.password == nil
    }

    static func stableID(for url: URL) -> UUID {
        let bytes = Array(SHA256.hash(data: Data(url.absoluteString.utf8)).prefix(16))
        return UUID(uuid: (bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
                           bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]))
    }

    /// Decode only browser-safe links and derive stable identity from the source URL.
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
                self.title = try container.decode(String.self, forKey: .title)
        self.snippet = try container.decode(String.self, forKey: .snippet)
        self.url = try container.decode(URL.self, forKey: .url)
        guard Self.isWebURL(self.url) else {
            throw DecodingError.dataCorruptedError(forKey: .url, in: container, debugDescription: "Article URL must use HTTP or HTTPS")
        }
        // Identity survives feed regeneration even when a server sends a new UUID.
        self.id = Self.stableID(for: self.url)
        self.sourceName = try container.decode(String.self, forKey: .sourceName)
        let logo = try container.decodeIfPresent(URL.self, forKey: .sourceLogoURL)
        self.sourceLogoURL = logo.flatMap { Self.isWebURL($0) ? $0 : nil }
        self.publishedAt = try container.decode(Date.self, forKey: .publishedAt)
    }
}
