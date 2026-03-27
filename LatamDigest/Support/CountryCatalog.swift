import Foundation

enum CountryCatalog {
    static func loadCountries() -> [Country] {
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
    }
}
