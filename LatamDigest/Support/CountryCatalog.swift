import Foundation

enum CountryCatalog {
    static func loadCountries() -> [Country] {
        #if JAPAN_EDITION
        return JapanSource.all.map { Country(id: $0.id, name: $0.name) }
        #else
        guard let url = Bundle.main.url(forResource: "Countries", withExtension: "json") else {
            return []
        }

        do {
            let data = try Data(contentsOf: url)
            return try JSONDecoder().decode([Country].self, from: data)
        } catch {
            print("Failed to load Countries.json: \(error)")
            return []
        }
        #endif
    }
}
