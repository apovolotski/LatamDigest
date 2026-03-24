import SwiftUI

/// The main screen displayed after onboarding.  Shows the user's
/// followed countries and the full country list.  The copy makes it
/// explicit that tapping a country opens that country's digest.
struct HomeView: View {
    @AppStorage("preferredLanguage") private var preferredLanguage: String = Locale.current.language.languageCode?.identifier ?? "es"
    @AppStorage("selectedCountries") private var selectedCountriesString: String = ""
    @State private var allCountries: [Country] = []

    private var selectedCountries: [String] {
        selectedCountriesString.split(separator: ",").map { String($0) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(AppLanguage.localized("home_title", languageCode: preferredLanguage))
                            .font(.largeTitle)
                            .fontWeight(.bold)
                        Text(AppLanguage.localized("home_subtitle", languageCode: preferredLanguage))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }

                    if !selectedCountries.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text(AppLanguage.localized("home_my_countries", languageCode: preferredLanguage))
                                .font(.title3)
                                .fontWeight(.semibold)
                                .foregroundStyle(.secondary)

                            ForEach(selectedCountries, id: \.self) { code in
                                if let country = allCountries.first(where: { $0.id == code }) {
                                    NavigationLink(destination: CountryFeedView(country: country)) {
                                        countryCard(
                                            country: country,
                                            subtitle: AppLanguage.localized("home_open_digest", languageCode: preferredLanguage),
                                            isSelected: true
                                        )
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        Text(AppLanguage.localized("home_all_countries", languageCode: preferredLanguage))
                            .font(.title3)
                            .fontWeight(.semibold)
                            .foregroundStyle(.secondary)

                        LazyVStack(spacing: 12) {
                            ForEach(allCountries) { country in
                                NavigationLink(destination: CountryFeedView(country: country)) {
                                    countryCard(
                                        country: country,
                                        subtitle: AppLanguage.localized("home_browse_digest", languageCode: preferredLanguage),
                                        isSelected: selectedCountries.contains(country.id)
                                    )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding()
            }
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

    private func countryCard(country: Country, subtitle: String, isSelected: Bool) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(country.localizedName(languageCode: preferredLanguage))
                    .font(.headline)
                    .foregroundStyle(.primary)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if isSelected {
                Image(systemName: "star.fill")
                    .foregroundStyle(.yellow)
            }

            Image(systemName: "chevron.right")
                .foregroundStyle(.tertiary)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(.background)
                .shadow(color: .black.opacity(0.05), radius: 12, y: 4)
        )
    }

    private func loadCountries() {
        guard allCountries.isEmpty else { return }
        if let url = Bundle.main.url(forResource: "Countries", withExtension: "json") {
            do {
                let data = try Data(contentsOf: url)
                let decoder = JSONDecoder()
                allCountries = try decoder.decode([Country].self, from: data)
                allCountries.sort { $0.localizedName(languageCode: preferredLanguage) < $1.localizedName(languageCode: preferredLanguage) }
            } catch {
                print("Failed to load Countries.json: \(error)")
            }
        }
    }
}
