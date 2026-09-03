import SwiftData
import Foundation

@Model
final class AppSettings {

    // Appearance

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

    var createdAt: Date = Date()

    var updatedAt: Date = Date()

    // Built-in variable customization

    var variableLabelsJSON: String = "{}"

    var variableColorsJSON: String = "{}"

    var hiddenVariablesJSON: String = "[]"
    
    //ordre variables
    
    var sectionOrderJSON: String =
    #"["sleep","work","negative","positive","sports","counter","custom","notes"]"#
    
    var graphVisibleFieldsJSON: String = """
    ["positive1","habit1","habit2","negative1","sports"]
    """
    
    // visualització
    
    var lineChartStyle: String = "line"
    
    var perfectDayColorHex: String = "#22c55e"
    
    var perfectDayThreshold: Int = 3
    
    var lastAnalysisField: String = "positive1"
    
    var perfectDayEnabled: Bool = true
    
    var showHiddenVariablesInCalendar: Bool = false
    
    var hideSleepHours = false
    
    var hideSleepQuality = false
    
    var hideNotes = false
    
    init() {}

    enum NotificationMode: String, Codable {
        case morning
        case evening
        case both
    }
    
    var notificationMode: String = NotificationMode.both.rawValue
    
    // MARK: - Variable Labels

    var variableLabels: [String:String] {

        get {

            guard
                let data = variableLabelsJSON.data(using: .utf8),
                let value = try? JSONDecoder().decode(
                    [String:String].self,
                    from: data
                )
            else {
                return [:]
            }

            return value
        }

        set {

            variableLabelsJSON =
                (
                    try? String(
                        data: JSONEncoder().encode(newValue),
                        encoding: .utf8
                    )
                ) ?? "{}"
        }
    }

    // MARK: - Variable Colors

    var variableColors: [String:String] {

        get {

            guard
                let data = variableColorsJSON.data(using: .utf8),
                let value = try? JSONDecoder().decode(
                    [String:String].self,
                    from: data
                )
            else {
                return [:]
            }

            return value
        }

        set {

            variableColorsJSON =
                (
                    try? String(
                        data: JSONEncoder().encode(newValue),
                        encoding: .utf8
                    )
                ) ?? "{}"
        }
    }

    // MARK: - Hidden Variables

    var hiddenVariables: [String] {

        get {

            guard
                let data = hiddenVariablesJSON.data(using: .utf8),
                let value = try? JSONDecoder().decode(
                    [String].self,
                    from: data
                )
            else {
                return []
            }

            return value
        }

        set {

            hiddenVariablesJSON =
                (
                    try? String(
                        data: JSONEncoder().encode(newValue),
                        encoding: .utf8
                    )
                ) ?? "[]"
        }
    }
    
    // MARK: - Graph Visible Fields

    var graphVisibleFields: [String] {

        get {

            guard
                let data = graphVisibleFieldsJSON.data(using: .utf8),
                let value = try? JSONDecoder().decode(
                    [String].self,
                    from: data
                )
            else {
                return [
                    "positive1",
                    "habit1",
                    "habit2",
                    "negative1",
                    "sports"
                ]
            }

            return value
        }

        set {

            graphVisibleFieldsJSON =
                (
                    try? String(
                        data: JSONEncoder().encode(newValue),
                        encoding: .utf8
                    )
                ) ?? "[]"
        }
    }


    //MARK: Ordre de les seccions
    
    var sectionOrder: [String] {

        get {

            guard
                let data = sectionOrderJSON.data(using: .utf8),
                let value = try? JSONDecoder().decode(
                    [String].self,
                    from: data
                )
            else {
                return [
                    "sleep",
                    "work",
                    "negative",
                    "positive",
                    "sports",
                    "counter",
                    "custom",
                    "notes"
                ]
            }

            return value
        }

        set {

            sectionOrderJSON =
                (
                    try? String(
                        data: JSONEncoder().encode(newValue),
                        encoding: .utf8
                    )
                ) ?? #"["sleep","work","negative","positive","sports","counter","custom","notes"]"#
        }
    }
    
    // MARK: - Reminder Days

    var reminderDays: [Int] {

        get {

            guard
                let data = reminderDaysJSON.data(using: .utf8),
                let arr = try? JSONDecoder().decode(
                    [Int].self,
                    from: data
                )
            else {
                return [0,1,2,3,4,5,6]
            }

            return arr
        }

        set {

            reminderDaysJSON =
                (
                    try? String(
                        data: JSONEncoder().encode(newValue),
                        encoding: .utf8
                    )
                ) ?? "[0,1,2,3,4,5,6]"
        }
    }

    // MARK: - Backup

    var isBackupDue: Bool {

        switch backupFrequency {

        case "weekly":

            guard let last = lastBackupDate
            else { return true }

            return
                Date().timeIntervalSince(last)
                >= 7 * 86400

        case "monthly":

            guard let last = lastBackupDate
            else { return true }

            return
                Date().timeIntervalSince(last)
                >= 30 * 86400

        default:

            return false
        }
    }
}
