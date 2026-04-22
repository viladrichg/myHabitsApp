import UserNotifications
import Foundation

/// All local notification scheduling.
/// Works 100 % offline — no network needed.
@MainActor
final class NotificationManager {
    static let shared = NotificationManager()
    private init() {}

    // MARK: - Permission

    func requestAuthorization() async -> Bool {
        do {
            return try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound, .badge])
        } catch {
            return false
        }
    }

    func authorizationStatus() async -> UNAuthorizationStatus {
        await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }

    // MARK: - Schedule

    /// Cancels all previously scheduled reminders and re-schedules
    /// based on the current settings. Call this every time the user
    /// changes notification settings.
    func reschedule(settings: AppSettings) async {
        // Clear existing
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
        guard settings.notificationsEnabled else { return }

        let days = settings.reminderDays    // e.g. [1,2,3,4,5]
        if let morning = settings.morningReminderTime.parseHHmm() {
            schedule(identifier: "morning",
                     title: "Good morning!",
                     body: "Time to log your morning data.",
                     hour: morning.hour, minute: morning.minute,
                     weekdays: days)
        }
        if let evening = settings.eveningReminderTime.parseHHmm() {
            schedule(identifier: "evening",
                     title: "Daily check-in",
                     body: "Don't forget to fill in today's habits.",
                     hour: evening.hour, minute: evening.minute,
                     weekdays: days)
        }
    }

    // MARK: - Debug helper

    /// Returns the list of pending notification identifiers — useful for
    /// verifying that scheduling worked correctly (show in Settings).
    func pendingNotificationDescriptions() async -> [String] {
        let requests = await UNUserNotificationCenter.current().pendingNotificationRequests()
        return requests.map { req in
            let trigger = req.trigger as? UNCalendarNotificationTrigger
            let next = trigger?.nextTriggerDate()?.description ?? "unknown"
            return "\(req.identifier) → \(next)"
        }
    }

    // MARK: - Private

    private func schedule(identifier: String,
                          title: String,
                          body: String,
                          hour: Int,
                          minute: Int,
                          weekdays: [Int]) {
        for day in weekdays {
            var comps = DateComponents()
            comps.hour    = hour
            comps.minute  = minute
            // UNCalendarNotificationTrigger uses 1=Sun … 7=Sat
            comps.weekday = (day % 7) + 1

            let trigger = UNCalendarNotificationTrigger(
                dateMatching: comps, repeats: true
            )
            let content = UNMutableNotificationContent()
            content.title = title
            content.body  = body
            content.sound = .default

            let request = UNNotificationRequest(
                identifier: "\(identifier)_day\(day)",
                content: content,
                trigger: trigger
            )
            UNUserNotificationCenter.current().add(request)
        }
    }
}