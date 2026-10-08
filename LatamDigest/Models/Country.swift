import Foundation

/// A feed group: a country in Latam Digest or a publisher in the Japanese edition.
/// CountryCatalog supplies the active edition’s list. Codable and Identifiable
/// preserve the shared reading/notebook data model.
public struct Country: Identifiable, Codable, Equatable {
    /// Country code (e.g. MX) or stable Japanese publisher key (e.g. NH).
    public let id: String
    /// Display name for this feed group.
    public let name: String

    public init(id: String, name: String) {
        self.id = id
        self.name = name
    }
}