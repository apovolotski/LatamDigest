//
//  LatamDigestApp.swift
//  LatamDigest
//
//  Created by Alex on 2026-03-23.
//

import SwiftUI

@main
struct LatamDigestApp: App {
    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding = false
    @AppStorage("preferredLanguage") private var preferredLanguage = AppEdition.defaultLanguage
    @StateObject private var readingLibrary = ReadingLibrary.shared
    @StateObject private var workspaceStore = WorkspaceStore.shared

    #if JAPAN_EDITION && DEBUG
    init() {
        // Only an explicit UI-test launch resets this app's local test state.
        if ProcessInfo.processInfo.arguments.contains("--japan-ui-test-reset"), let id = Bundle.main.bundleIdentifier {
            UserDefaults.standard.removePersistentDomain(forName: id)
        }
    }
    #endif

    var body: some Scene {
        WindowGroup {
            Group {
                if hasCompletedOnboarding {
                    #if JAPAN_EDITION
                    JapanRootView()
                    #else
                    WorkspaceRootView()
                    #endif
                } else {
                    #if JAPAN_EDITION
                    JapanOnboardingView()
                    #else
                    OnboardingFlowView()
                    #endif
                }
            }
            .environment(\.locale, Locale(identifier: AppLanguage.supportedLanguageCode(from: preferredLanguage)))
            .environmentObject(readingLibrary)
            .environmentObject(workspaceStore)
            .task(id: hasCompletedOnboarding) {
                guard hasCompletedOnboarding else { return }
                let defaults = UserDefaults.standard
                let countries = (defaults.string(forKey: "selectedCountries") ?? "").split(separator: ",").map(String.init)
                let reminderTime: Date
                if let storedTime = defaults.object(forKey: "dailyDigestTimeInterval") as? Double {
                    reminderTime = Date(timeIntervalSince1970: storedTime)
                } else {
                    reminderTime = Calendar.current.date(bySettingHour: 7, minute: 30, second: 0, of: Date()) ?? Date()
                }
                await NotificationManager.shared.scheduleDailyDigest(for: countries,
                    at: reminderTime, languageCode: preferredLanguage)
            }
        }
    }
}
