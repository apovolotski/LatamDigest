import Foundation

/// Represents a Latin American country available in the app.  The list
/// is loaded from `Resources/Countries.json`.  Conforms to `Codable` for
/// decoding and `Identifiable` for use in SwiftUI lists.
public struct Country: Identifiable, Codable, Equatable {
    /// ISO‑3166 alpha‑2 country code (e.g. “MX”).
    public let id: String
    /// Human‑readable country name (e.g. “Mexico”).
    public let name: String

    public init(id: String, name: String) {
        self.id = id
        self.name = name
    }
}