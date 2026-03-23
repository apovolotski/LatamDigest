import Foundation

/// Makes `URL` conform to `Identifiable` by using itself as the identifier.
extension URL: @retroactive Identifiable {
    public var id: URL { self }
}
