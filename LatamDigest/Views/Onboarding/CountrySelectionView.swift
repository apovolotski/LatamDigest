import SwiftUI

/// Second step of the onboarding flow: allows the user to choose one or
/// more countries they wish to follow.  Uses a multi‑select list with
/// search functionality.  The list of available countries is loaded
/// from `Countries.json` at runtime.
struct CountrySelectionView: View {
    @ObservedObject var viewModel: OnboardingViewModel

    @State private var countries: [Country] = []
    @State private var searchText: String = ""
    @State private var selected: Set<String> = []

    var body: some View {
        VStack(alignment: .leading) {
            Text(AppLanguage.localized("onboarding_select_countries", languageCode: viewModel.selectedLanguage))
                .font(.title)
                .fontWeight(.bold)
                .padding(.top)

            // Search bar
            TextField(AppLanguage.localized("onboarding_search", languageCode: viewModel.selectedLanguage), text: $searchText)
                .textFieldStyle(RoundedBorderTextFieldStyle())
                .padding(.vertical)

            // List of countries with checkmarks
            List {
                ForEach(filteredCountries) { country in
                    Button(action: {
                        toggleSelection(country)
                    }) {
                        HStack {
                            Text(country.localizedName(languageCode: viewModel.selectedLanguage))
                                .foregroundColor(.primary)
                            Spacer()
                            if selected.contains(country.id) {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.accentColor)
                            }
                        }
                    }
                }
            }
            .listStyle(PlainListStyle())

            Button(action: {
                // Persist selection and proceed
                viewModel.selectedCountries = Array(selected)
                viewModel.proceed()
            }) {
                Text(AppLanguage.localized("onboarding_continue", languageCode: viewModel.selectedLanguage))
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(selected.isEmpty ? Color.gray.opacity(0.3) : Color.accentColor)
                    .foregroundColor(.white)
                    .cornerRadius(12)
            }
            .disabled(selected.isEmpty)
            .padding(.vertical)

        }
        .padding()
        .onAppear {
            loadCountries()
            // Pre‑select any previously selected countries if the user goes back.
            selected = Set(viewModel.selectedCountries)
        }
    }

    private var filteredCountries: [Country] {
        if searchText.isEmpty {
            return countries
        }
        return countries.filter {
            $0.localizedName(languageCode: viewModel.selectedLanguage).localizedCaseInsensitiveContains(searchText)
                || $0.id.localizedCaseInsensitiveContains(searchText)
        }
    }

    private func toggleSelection(_ country: Country) {
        if selected.contains(country.id) {
            selected.remove(country.id)
        } else {
            selected.insert(country.id)
        }
    }

    private func loadCountries() {
        guard countries.isEmpty else { return }
        // Load Countries.json from the bundle.
        if let url = Bundle.main.url(forResource: "Countries", withExtension: "json") {
            do {
                let data = try Data(contentsOf: url)
                let decoder = JSONDecoder()
                countries = try decoder.decode([Country].self, from: data)
                countries.sort { $0.localizedName(languageCode: viewModel.selectedLanguage) < $1.localizedName(languageCode: viewModel.selectedLanguage) }
            } catch {
                print("Failed to load Countries.json: \(error)")
                countries = []
            }
        }
    }
}
