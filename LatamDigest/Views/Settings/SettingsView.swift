import SwiftUI

/// Settings screen allowing the user to adjust language, followed
/// countries and notification times after onboarding.  Updates are
/// persisted via `@AppStorage` and notifications are rescheduled
/// automatically.
struct SettingsView: View {
    @AppStorage("preferredLanguage") private var selectedLanguage: String = Locale.current.language.languageCode?.identifier ?? "es"
    @AppStorage("selectedCountries") private var selectedCountriesString: String = ""
    @AppStorage("dailyDigestTimeInterval") private var notificationTimeInterval: Double = Date().timeIntervalSince1970
    @State private var allCountries: [Country] = []

    private var selectedCountriesList: [String] {
        get { selectedCountriesString.split(separator: ",").map { String($0) } }
        set { selectedCountriesString = newValue.joined(separator: ",") }
    }

    private var notificationTime: Date {
        get { Date(timeIntervalSince1970: notificationTimeInterval) }
        set { notificationTimeInterval = newValue.timeIntervalSince1970 }
    }

    var body: some View {
        Form {
            Section(header: Text(AppLanguage.localized("settings_language_section", languageCode: selectedLanguage))) {
                Picker(AppLanguage.localized("settings_language_section", languageCode: selectedLanguage), selection: $selectedLanguage) {
                    Text("Español").tag("es")
                    Text("Português").tag("pt")
                    Text("English").tag("en")
                }
                .pickerStyle(SegmentedPickerStyle())
            }

            Section(header: Text(AppLanguage.localized("settings_countries_section", languageCode: selectedLanguage))) {
                if allCountries.isEmpty {
                    Text(AppLanguage.localized("settings_loading", languageCode: selectedLanguage))
                        .foregroundColor(.secondary)
                } else {
                    ForEach(allCountries) { country in
                        Toggle(isOn: Binding(
                            get: { selectedCountriesList.contains(country.id) },
                            set: { newValue in
                                var updatedCountries = selectedCountriesList
                                if newValue {
                                    if !updatedCountries.contains(country.id) {
                                        updatedCountries.append(country.id)
                                    }
                                } else {
                                    updatedCountries.removeAll(where: { $0 == country.id })
                                }
                                selectedCountriesString = updatedCountries.joined(separator: ",")
                                // Reschedule notifications with updated countries
                                Task {
                                    await NotificationManager.shared.scheduleDailyDigest(
                                        for: updatedCountries,
                                        at: notificationTime,
                                        languageCode: selectedLanguage
                                    )
                                }
                            }
                        )) {
                            Text(country.localizedName(languageCode: selectedLanguage))
                        }
                    }
                }
            }

            Section(header: Text(AppLanguage.localized("settings_daily_briefing_time", languageCode: selectedLanguage))) {
                DatePicker(
                    AppLanguage.localized("settings_time_label", languageCode: selectedLanguage),
                    selection: Binding(
                        get: { notificationTime },
                        set: { notificationTimeInterval = $0.timeIntervalSince1970 }
                    ),
                    displayedComponents: .hourAndMinute
                )
                    .onChange(of: notificationTimeInterval) { _, _ in
                        // Reschedule notifications when the user changes the time.
                        Task {
                            await NotificationManager.shared.scheduleDailyDigest(
                                for: selectedCountriesList,
                                at: notificationTime,
                                languageCode: selectedLanguage
                            )
                        }
                }
            }
        }
        .navigationTitle(AppLanguage.localized("settings_title", languageCode: selectedLanguage))
        .onAppear {
            loadCountries()
        }
        .onChange(of: selectedLanguage) { _, _ in
            allCountries.sort { $0.localizedName(languageCode: selectedLanguage) < $1.localizedName(languageCode: selectedLanguage) }
        }
    }

    private func loadCountries() {
        guard allCountries.isEmpty else { return }
        if let url = Bundle.main.url(forResource: "Countries", withExtension: "json") {
            do {
                let data = try Data(contentsOf: url)
                let decoder = JSONDecoder()
                allCountries = try decoder.decode([Country].self, from: data)
                allCountries.sort { $0.localizedName(languageCode: selectedLanguage) < $1.localizedName(languageCode: selectedLanguage) }
            } catch {
                print("Failed to load Countries.json: \(error)")
            }
        }
    }
}
