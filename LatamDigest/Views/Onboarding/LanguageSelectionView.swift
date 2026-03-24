import SwiftUI

/// First step of the onboarding flow: allows the user to pick a
/// preferred language.  The options are English, Spanish and Portuguese.
struct LanguageSelectionView: View {
    @ObservedObject var viewModel: OnboardingViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 32) {
            Text("onboarding_choose_language")
                .font(.title)
                .fontWeight(.bold)
                .padding(.top)

            VStack(spacing: 16) {
                LanguageButton(title: "Español", code: "es", viewModel: viewModel)
                LanguageButton(title: "Português", code: "pt", viewModel: viewModel)
                LanguageButton(title: "English", code: "en", viewModel: viewModel)
            }

            Spacer()
        }
        .padding()
    }
}

private struct LanguageButton: View {
    var title: String
    var code: String
    @ObservedObject var viewModel: OnboardingViewModel

    var body: some View {
        Button(action: {
            viewModel.selectedLanguage = code
            viewModel.proceed()
        }) {
            HStack {
                Text(title)
                    .font(.headline)
                    .foregroundColor(.primary)
                Spacer()
                if viewModel.selectedLanguage == code {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.accentColor)
                }
            }
            .padding()
            .frame(maxWidth: .infinity)
            .background(Color(UIColor.secondarySystemBackground))
            .cornerRadius(12)
        }
    }
}
