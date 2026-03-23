import Foundation
import Combine
import SwiftUI

/// View model for managing the onboarding flow.  Tracks the current
/// step, holds user selections and persists them in `@AppStorage`.
final class OnboardingViewModel: ObservableObject {
    enum Step: Int, CaseIterable {
        case language
        case countries
        case notificationTime
    }

    // MARK: - Published properties

    /// The current onboarding step.  Switching this moves the user
    /// forward or backward through the onboarding views.
    @Published var currentStep: Step = .language
    /// The selected language code (“es”, “pt”, or “en”).  Persisted via
    /// `@AppStorage` so it can be used across the app.
    @AppStorage("preferredLanguage") var selectedLanguage: String = Locale.current.language.languageCode?.identifier ?? "es"
    /// The list of selected country codes.  Persisted via `@AppStorage`.
    @AppStorage("selectedCountries") var selectedCountriesString: String = ""
    /// The time of day for the daily digest persisted as a timestamp because
    /// `@AppStorage` does not support `Date` directly.
    @AppStorage("dailyDigestTimeInterval") private var notificationTimeInterval: Double = {
        // Default to 07:30 local time.
        var comps = DateComponents()
        comps.hour = 7
        comps.minute = 30
        return (Calendar.current.date(from: comps) ?? Date()).timeIntervalSince1970
    }()

    var notificationTime: Date {
        get { Date(timeIntervalSince1970: notificationTimeInterval) }
        set { notificationTimeInterval = newValue.timeIntervalSince1970 }
    }

    /// Converts the comma‑separated `selectedCountriesString` into an array.
    var selectedCountries: [String] {
        get {
            selectedCountriesString.split(separator: ",").map { String($0) }
        }
        set {
            selectedCountriesString = newValue.joined(separator: ",")
        }
    }

    /// Convenience method to move to the next step or finish onboarding.
    func proceed() {
        switch currentStep {
        case .language:
            currentStep = .countries
        case .countries:
            currentStep = .notificationTime
        case .notificationTime:
            finishOnboarding()
        }
    }

    /// Completes onboarding, persists the flag and schedules notifications.
    private func finishOnboarding() {
        // Mark onboarding as completed.
        UserDefaults.standard.set(true, forKey: "hasCompletedOnboarding")

        // Schedule daily digest notifications for the selected countries.
        Task {
            await NotificationManager.shared.scheduleDailyDigest(
                for: selectedCountries,
                at: notificationTime,
                languageCode: selectedLanguage
            )
        }
    }
}
