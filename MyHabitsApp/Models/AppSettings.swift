import SwiftData
import Foundation

@Model
final class AppSettings {

    // Singleton — always id = 1

    var themeStyle: String = "dark"

    var displayMode: String = "absolute"

    var chartTimeframe: String = "month"

    // Notifications

    var notificationsEnabled: Bool = false

    var morningReminderTime: String = "09:00"

    var eveningReminderTime: String = "23:00"

    var reminderDaysJSON: String = "[0,1,2,3,4,5,6]"

    // Backup

    var backupFrequency: String = "none"

    var lastBackupDate: Date?

    // Built-in variable customization

    var variableLabelsJSON: String = "{}"

    var variableColorsJSON: String = "{}"

    var hiddenVariablesJSON: String = "[]"

    var createdAt: Date = Date()

    var updatedAt: Date = Date()

    init() {}

    // MARK: Reminder Days

    var reminderDays: [Int] {

        get {

            guard
                let data = reminderDaysJSON.data(using: .utf8),
                let arr = try? JSONDecoder().decode([Int].self, from: data)
            else {
                return [0,1,2,3,4,5,6]
            }

            return arr
        }

        set {

            reminderDaysJSON =
                (try? String(
                    data: JSONEncoder().encode(newValue),
                    encoding: .utf8
                )) ?? "[0,1,2,3,4,5,6]"
        }
    }

    // MARK: Built-in Labels

    var variableLabels: [String:String] {

        get {

            guard
                let data = variableLabelsJSON.data(using: .utf8),
                let dict = try? JSONDecoder()
                    .decode([String:String].self, from: data)
            else {
                return [:]
            }

            return dict
        }

        set {

            variableLabelsJSON =
                (try? String(
                    data: JSONEncoder().encode(newValue),
                    encoding: .utf8
                )) ?? "{}"
        }
    }

    // MARK: Built-in Colors

    var variableColors: [String:String] {

        get {

            guard
                let data = variableColorsJSON.data(using: .utf8),
                let dict = try? JSONDecoder()
                    .decode([String:String].self, from: data)
            else {
                return [:]
            }

            return dict
        }

        set {

            variableColorsJSON =
                (try? String(
                    data: JSONEncoder().encode(newValue),
                    encoding: .utf8
                )) ?? "{}"
        }
    }

    // MARK: Hidden Variables

    var hiddenVariables: [String] {

        get {

            guard
                let data = hiddenVariablesJSON.data(using: .utf8),
                let arr = try? JSONDecoder()
                    .decode([String].self, from: data)
            else {
                return []
            }

            return arr
        }

        set {

            hiddenVariablesJSON =
                (try? String(
                    data: JSONEncoder().encode(newValue),
                    encoding: .utf8
                )) ?? "[]"
        }
    }

    // MARK: Backup

    var isBackupDue: Bool {

        switch backupFrequency {

        case "weekly":

            guard let last = lastBackupDate
            else { return true }

            return Date().timeIntervalSince(last)
                >= 7 * 86400

        case "monthly":

            guard let last = lastBackupDate
            else { return true }

            return Date().timeIntervalSince(last)
                >= 30 * 86400

        default:

            return false
        }
    }
}
