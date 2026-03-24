import SwiftUI

/// Final step of onboarding: asks the user to choose a time for their
/// daily news digest.  Uses a `DatePicker` limited to hour and minute.
struct NotificationTimeView: View {
    @ObservedObject var viewModel: OnboardingViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            Text(AppLanguage.localized("onboarding_daily_briefing_time", languageCode: viewModel.selectedLanguage))
                .font(.title)
                .fontWeight(.bold)
                .padding(.top)

            Text(AppLanguage.localized("onboarding_daily_briefing_subtitle", languageCode: viewModel.selectedLanguage))
                .foregroundColor(.secondary)

            DatePicker(AppLanguage.localized("settings_time_label", languageCode: viewModel.selectedLanguage), selection: $viewModel.notificationTime, displayedComponents: .hourAndMinute)
                .datePickerStyle(WheelDatePickerStyle())
                .labelsHidden()

            Spacer()

            Button(action: {
                viewModel.proceed()
            }) {
                Text(AppLanguage.localized("onboarding_finish_setup", languageCode: viewModel.selectedLanguage))
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.accentColor)
                    .foregroundColor(.white)
                    .cornerRadius(12)
            }
            .padding(.vertical)
        }
        .padding()
    }
}
