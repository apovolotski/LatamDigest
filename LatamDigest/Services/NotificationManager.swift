import Foundation
import UserNotifications

/// Local reminders deliberately contain no headlines: repeated notifications cannot refresh news.
@MainActor
final class NotificationManager {
    static let shared = NotificationManager()
    private let center = UNUserNotificationCenter.current()
    private var scheduleID = UUID()
    private var scheduleTask: Task<Void, Never>?
    private init() {}

    func scheduleDailyDigest(for countries: [String], at time: Date, languageCode: String) async {
        let id = UUID()
        scheduleID = id
        let previous = scheduleTask
        let task = Task {
            await previous?.value
            await applySchedule(id: id, countries: countries, time: time, languageCode: languageCode)
        }
        scheduleTask = task
        await task.value
    }

    private func applySchedule(id: UUID, countries: [String], time: Date, languageCode: String) async {
        guard scheduleID == id else { return }
        let pending = await center.pendingNotificationRequests()
        guard scheduleID == id else { return }
        center.removePendingNotificationRequests(withIdentifiers: pending.map(\.identifier).filter { $0.hasPrefix("daily_digest_") })
        let enabled = UserDefaults.standard.object(forKey: "dailyRemindersEnabled") as? Bool ?? !AppEdition.isJapan
        guard enabled, !countries.isEmpty else { return }
        var settings = await center.notificationSettings()
        if settings.authorizationStatus == .notDetermined {
            _ = try? await center.requestAuthorization(options: [.alert, .sound])
            settings = await center.notificationSettings()
        }
        guard scheduleID == id, [.authorized, .provisional, .ephemeral].contains(settings.authorizationStatus) else { return }
        let components = Calendar.current.dateComponents([.hour, .minute], from: time)
        let reminderCodes = AppEdition.isJapan ? ["JP"] : Set(countries).sorted()
        for country in reminderCodes {
            guard scheduleID == id else { return }
            let content = Self.reminderContent(countryCode: country, languageCode: languageCode)
            let request = UNNotificationRequest(identifier: "daily_digest_\(country)", content: content,
                trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: true))
            try? await center.add(request)
        }
    }

    func notificationsDenied() async -> Bool {
        await center.notificationSettings().authorizationStatus == .denied
    }

    static func reminderContent(countryCode: String, languageCode: String) -> UNMutableNotificationContent {
        let locale = Locale(identifier: AppLanguage.supportedLanguageCode(from: languageCode))
        let name = locale.localizedString(forRegionCode: countryCode) ?? countryCode
        let content = UNMutableNotificationContent()
        content.title = AppLanguage.localizedFormat("daily_briefing_title", languageCode: languageCode, name)
        content.body = AppLanguage.localizedFormat("notifications_body", languageCode: languageCode, name)
        content.sound = .default
        return content
    }
}
