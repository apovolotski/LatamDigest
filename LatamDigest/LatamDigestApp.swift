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

    var body: some Scene {
        WindowGroup {
            if hasCompletedOnboarding {
                HomeView()
            } else {
                OnboardingFlowView()
            }
        }
    }
}
