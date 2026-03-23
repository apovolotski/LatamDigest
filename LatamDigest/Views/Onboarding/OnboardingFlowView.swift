import SwiftUI

/// Wrapper view that orchestrates the onboarding flow.  Presents the
/// appropriate subview based on the current step in the `OnboardingViewModel`.
struct OnboardingFlowView: View {
    @StateObject private var viewModel = OnboardingViewModel()

    var body: some View {
        VStack {
            switch viewModel.currentStep {
            case .language:
                LanguageSelectionView(viewModel: viewModel)
            case .countries:
                CountrySelectionView(viewModel: viewModel)
            case .notificationTime:
                NotificationTimeView(viewModel: viewModel)
            }
        }
        .animation(.easeInOut, value: viewModel.currentStep)
        .transition(.slide)
    }
}