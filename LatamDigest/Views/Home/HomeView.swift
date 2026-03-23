import SwiftUI

/// The main screen displayed after onboarding.  Shows the user’s
/// followed countries and a full list of all available countries.  Tapping
/// a country navigates to its feed.
struct HomeView: View {
    @AppStorage("selectedCountries") private var selectedCountriesString: String = ""
    @State private var allCountries: [Country] = []

    private var selectedCountries: [String] {
        selectedCountriesString.split(separator: ",").map { String($0) }
    }

    var body: some View {
        NavigationStack {
            List {
                if !selectedCountries.isEmpty {
                    Section(header: Text("My Countries")) {
                        ForEach(selectedCountries, id: \.self) { code in
                            if let country = allCountries.first(where: { $0.id == code }) {
                                NavigationLink(destination: CountryFeedView(country: country)) {
                                    Text(country.name)
                                }
                            }
                        }
                    }
                }

                Section(header: Text("All Countries")) {
                    ForEach(allCountries) { country in
                        NavigationLink(destination: CountryFeedView(country: country)) {
                            HStack {
                                Text(country.name)
                                if selectedCountries.contains(country.id) {
                                    Spacer()
                                    Image(systemName: "star.fill")
                                        .foregroundColor(.yellow)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("LATAM News")
            .toolbar {
                NavigationLink(destination: SettingsView()) {
                    Image(systemName: "gearshape")
                }
            }
        }
        .onAppear {
            loadCountries()
        }
    }

    private func loadCountries() {
        guard allCountries.isEmpty else { return }
        if let url = Bundle.main.url(forResource: "Countries", withExtension: "json") {
            do {
                let data = try Data(contentsOf: url)
                let decoder = JSONDecoder()
                allCountries = try decoder.decode([Country].self, from: data)
                allCountries.sort { $0.name < $1.name }
            } catch {
                print("Failed to load Countries.json: \(error)")
            }
        }
    }
}