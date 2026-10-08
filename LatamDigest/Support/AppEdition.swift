import Foundation

nonisolated enum AppEdition {
    #if JAPAN_EDITION
    static let isJapan = true
    static let defaultLanguage = "ja"
    static let globeSymbol = "newspaper"
    #else
    static let isJapan = false
    static var defaultLanguage: String { Locale.current.language.languageCode?.identifier ?? "es" }
    static let globeSymbol = "globe.americas"
    #endif
}
