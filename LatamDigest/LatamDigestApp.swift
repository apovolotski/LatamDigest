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
    @AppStorage("preferredLanguage") private var preferredLanguage = Locale.current.language.languageCode?.identifier ?? "es"
    @StateObject private var readingLibrary = ReadingLibrary.shared
    @StateObject private var workspaceStore = WorkspaceStore.shared

    var body: some Scene {
        WindowGroup {
            Group {
                if hasCompletedOnboarding {
                    WorkspaceRootView()
                } else {
                    OnboardingFlowView()
                }
            }
            .environment(\.locale, Locale(identifier: preferredLanguage))
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
