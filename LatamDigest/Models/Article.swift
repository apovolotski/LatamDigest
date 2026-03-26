import Foundation

/// Represents a news article headline returned from the backend.  Only
/// lightweight information is stored here; the actual content lives on
/// the publisher’s website and is opened in a WebView.  Conforms to
/// `Codable` for easy decoding from JSON.
public struct Article: Identifiable, Codable, Equatable {
    /// Unique identifier used locally.  The backend should provide its
    /// own identifier; if not, a UUID is generated on decoding.
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

    /// Custom decoder to fill in a UUID if the backend doesn’t provide one.
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let id = try container.decodeIfPresent(UUID.self, forKey: .id) {
            self.id = id
        } else {
            self.id = UUID()
        }
        self.title = try container.decode(String.self, forKey: .title)
        self.snippet = try container.decode(String.self, forKey: .snippet)
        self.url = try container.decode(URL.self, forKey: .url)
        self.sourceName = try container.decode(String.self, forKey: .sourceName)
        self.sourceLogoURL = try container.decodeIfPresent(URL.self, forKey: .sourceLogoURL)
        self.publishedAt = try container.decode(Date.self, forKey: .publishedAt)
    }
}
