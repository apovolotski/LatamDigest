import Foundation
import UserNotifications

/// Helper responsible for requesting notification permissions and
/// scheduling daily digest notifications.  If the user has not yet
/// granted permission, the manager will prompt them when scheduling.
final class NotificationManager {
    static let shared = NotificationManager()
    private init() {}

    private let center = UNUserNotificationCenter.current()

    /// Requests authorisation to send alerts and play sounds.  You must call
    /// this before scheduling notifications.  The completion handler is
    /// executed on an arbitrary queue.
    func requestAuthorization(completion: @escaping (Bool) -> Void) {
        center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
            completion(granted)
        }
    }

    /// Schedules a daily digest notification for each selected country.
    /// - Parameters:
    ///   - countries: A list of ISO country codes (e.g. ["MX", "BR"]).
    ///   - time: The time of day when the notification should be delivered.
    ///   - languageCode: The language chosen by the user; used for
    ///     localising the message body.
    func scheduleDailyDigest(for countries: [String], at time: Date, languageCode: String) async {
        // Remove any existing notifications to avoid duplicates.
        center.removeAllPendingNotificationRequests()

        // Request permission first.  Without permission nothing happens.
        let isAuthorized = await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
            self.center.getNotificationSettings { settings in
                if settings.authorizationStatus == .authorized {
                    continuation.resume(returning: true)
                } else if settings.authorizationStatus == .notDetermined {
                    // Ask for permission.
                    self.requestAuthorization { granted in
                        continuation.resume(returning: granted)
                    }
                } else {
                    continuation.resume(returning: false)
                }
            }
        }

        guard isAuthorized else { return }

        // Prepare notifications for each country.
        for country in countries {
            do {
                // Fetch top headlines to include in the summary.  Only the
                // titles are included in the notification; the user will
                // navigate into the app to read the full list.
                let articles = try await NewsService.shared.fetchTopArticles(countryCode: country)
                let titles = articles.prefix(3).map { $0.title }
                let summary = titles.joined(separator: "\n")

                // Configure the notification content.
                let content = UNMutableNotificationContent()
                let countryName = Locale.current.localizedString(forRegionCode: country) ?? country
                content.title = String(format: NSLocalizedString("daily_briefing_title", comment: "Notification title"), countryName)
                content.body = summary
                content.sound = UNNotificationSound.default

                // Create a calendar trigger at the specified time every day.
                var calendar = Calendar.current
                // Ensure the notification triggers in the user’s current locale/timezone.
                calendar.timeZone = TimeZone.current
                let components = calendar.dateComponents([.hour, .minute], from: time)
                let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)

                // Use a unique identifier for each country to allow replacement.
                let identifier = "daily_digest_\(country)"
                let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)
                try await center.add(request)
            } catch {
                print("Failed to schedule notification for \(country): \(error)")
            }
        }
    }
}
