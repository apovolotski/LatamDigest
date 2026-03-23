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
            Section(header: Text("Language")) {
                Picker("Language", selection: $selectedLanguage) {
                    Text("Español").tag("es")
                    Text("Português").tag("pt")
                    Text("English").tag("en")
                }
                .pickerStyle(SegmentedPickerStyle())
            }

            Section(header: Text("Countries")) {
                if allCountries.isEmpty {
                    Text("Loading…")
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
                            Text(country.name)
                        }
                    }
                }
            }

            Section(header: Text("Daily Briefing Time")) {
                DatePicker(
                    "Time",
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
        .navigationTitle("Settings")
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
