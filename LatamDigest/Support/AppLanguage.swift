import Foundation
import SwiftUI

enum AppLanguage {
    static func localized(_ key: String, languageCode: String) -> String {
        let normalizedCode = supportedLanguageCode(from: languageCode)
        guard
            let path = Bundle.main.path(forResource: normalizedCode, ofType: "lproj"),
            let bundle = Bundle(path: path)
        else {
            return NSLocalizedString(key, comment: "")
        }

        return NSLocalizedString(key, tableName: "Localizable", bundle: bundle, value: key, comment: "")
    }

    static func localizedFormat(_ key: String, languageCode: String, _ arguments: CVarArg...) -> String {
        let format = localized(key, languageCode: languageCode)
        return String(format: format, locale: Locale(identifier: supportedLanguageCode(from: languageCode)), arguments: arguments)
    }

    static func supportedLanguageCode(from languageCode: String) -> String {
        switch languageCode.prefix(2) {
        case "es": return "es"
        case "pt": return "pt"
        default: return "en"
        }
    }
}

extension Country {
    func localizedName(languageCode: String) -> String {
        AppLanguage.localized("country_\(id)", languageCode: languageCode)
    }
}
