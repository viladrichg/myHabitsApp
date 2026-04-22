import SwiftData
import Foundation

@Model
final class AppSettings {
    // Singleton — always id = 1
    var themeStyle: String        = "dark"
    var displayMode: String       = "absolute"   // "absolute" | "percentage"
    var chartTimeframe: String    = "month"       // "week"|"15days"|"month"|"3months"|"6months"|"year"|"all"

    // Notifications
    var notificationsEnabled: Bool = false
    var morningReminderTime: String = "09:00"     // "HH:mm"
    var eveningReminderTime: String = "23:00"     // "HH:mm"
    var reminderDaysJSON: String   = "[0,1,2,3,4,5,6]" // days of week (0=Sun)

    // Backup
    var backupFrequency: String  = "none"         // "none"|"weekly"|"monthly"
    var lastBackupDate: Date?

    var createdAt: Date = Date()
    var updatedAt: Date = Date()

    init() {}

    var reminderDays: [Int] {
        get {
            guard let data = reminderDaysJSON.data(using: .utf8),
                  let arr = try? JSONDecoder().decode([Int].self, from: data)
            else { return [0,1,2,3,4,5,6] }
            return arr
        }
        set {
            reminderDaysJSON = (try? String(data: JSONEncoder().encode(newValue), encoding: .utf8)) ?? "[0,1,2,3,4,5,6]"
        }
    }

    var isBackupDue: Bool {
        switch backupFrequency {
        case "weekly":
            guard let last = lastBackupDate else { return true }
            return Date().timeIntervalSince(last) >= 7 * 86400
        case "monthly":
            guard let last = lastBackupDate else { return true }
            return Date().timeIntervalSince(last) >= 30 * 86400
        default:
            return false
        }
    }
}