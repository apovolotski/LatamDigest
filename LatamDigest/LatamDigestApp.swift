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

    var body: some Scene {
        WindowGroup {
            Group {
                if hasCompletedOnboarding {
                    HomeView()
                } else {
                    OnboardingFlowView()
                }
            }
            .environment(\.locale, Locale(identifier: preferredLanguage))
            .environmentObject(readingLibrary)
        }
    }
}
