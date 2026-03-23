import SwiftUI

/// Final step of onboarding: asks the user to choose a time for their
/// daily news digest.  Uses a `DatePicker` limited to hour and minute.
struct NotificationTimeView: View {
    @ObservedObject var viewModel: OnboardingViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            Text("Daily Briefing Time")
                .font(.title)
                .fontWeight(.bold)
                .padding(.top)

            Text("When would you like to receive your daily headlines?")
                .foregroundColor(.secondary)

            DatePicker("Time", selection: $viewModel.notificationTime, displayedComponents: .hourAndMinute)
                .datePickerStyle(WheelDatePickerStyle())
                .labelsHidden()

            Spacer()

            Button(action: {
                viewModel.proceed()
            }) {
                Text("Finish Setup")
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