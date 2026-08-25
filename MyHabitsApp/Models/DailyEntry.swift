import SwiftData
import Foundation

@Model
final class DailyEntry {
    // Primary key — unique per day
    @Attribute(.unique) var date: String   // "YYYY-MM-DD"

    // Sleep
    var sleepStart: String?       // "HH:mm"
    var sleepEnd: String?    // "HH:mm"
    var sleepQuality: Int?     // 1–10

    // Work (mutually exclusive in UI, not enforced at model level)
    var habit1: Bool  = false
    var habit2: Bool = false

    // Missed objectives
    var negative1: Bool  = false
    var negative2: Bool  = false

    // Activities
    var positive1: Bool = false
    var positive2: Bool       = false
    var positive3: Bool     = false
    var positive4: Bool     = false

    // Counter (0–25)
    var counter: Int?

    // Sports — JSON array of sport names: ["Running","Swimming"]
    var sportsJSON: String = "[]"

    // Custom variables — JSON dict: {"cv_abc123": 1, "cv_xyz": 3}
    var customValuesJSON: String = "{}"

    // Notes
    var notes: String?
    
    var isEmpty: Bool {

        sleepQuality == nil &&
        sleepEnd == nil &&
        sleepStart == nil &&
        habit1 == false &&
        habit2 == false &&
        negative1 == false &&
        negative2 == false &&
        positive1 == false &&
        positive2 == false &&
        positive3 == false &&
        positive4 == false &&
        sports.isEmpty &&
        counter == nil &&
        customValues.values.allSatisfy { $0 == 0 } &&
        (notes?.isEmpty ?? true)
    }
    
    var createdAt: Date = Date()
    var updatedAt: Date = Date()

    init(date: String) {
        self.date = date
    }

    // MARK: - Computed helpers

    var sports: [String] {
        get {
            guard let data = sportsJSON.data(using: .utf8),
                  let arr = try? JSONDecoder().decode([String].self, from: data)
            else { return [] }
            return arr
        }
        set {
            sportsJSON = (try? String(data: JSONEncoder().encode(newValue), encoding: .utf8)) ?? "[]"
        }
    }

    var customValues: [String: Int] {
        get {
            guard let data = customValuesJSON.data(using: .utf8),
                  let dict = try? JSONDecoder().decode([String: Int].self, from: data)
            else { return [:] }
            return dict
        }
        set {
            customValuesJSON = (try? String(data: JSONEncoder().encode(newValue), encoding: .utf8)) ?? "{}"
        }
    }

    /// Sleep duration based on bedtime and wake-up
    var sleepHours: Double? {

        guard let bed = sleepStart?.parseHHmm(),
              let wake = sleepEnd?.parseHHmm()
        else {
            return nil
        }

        let bedMinutes =
            bed.hour * 60 +
            bed.minute

        let wakeMinutes =
            wake.hour * 60 +
            wake.minute

        var totalMinutes =
            wakeMinutes - bedMinutes

        if totalMinutes < 0 {
            totalMinutes += 24 * 60
        }

        return Double(totalMinutes) / 60.0
    }
    
    var sleepHoursText: String {

        guard let sleepHours else {
            return "-"
        }

        let totalMinutes =
            Int(sleepHours * 60)

        let hours =
            totalMinutes / 60

        let minutes =
            totalMinutes % 60

        
        return String(
            format: "%dh %02dm",
            hours,
            minutes
        )

    }


    /// true if the given built-in field is active
    func isActive(field: String) -> Bool {
        switch field {
        case "habit1":       return habit1
        case "habit2":       return habit2
        case "negative1":    return negative1
        case "negative2":    return negative2
        case "positive1":    return positive1
        case "positive2":    return positive2
        case "positive3":    return positive3
        case "positive4":    return positive4
        case "sports":       return !sports.isEmpty
        case "counter":      return (counter ?? 0) > 0
        default:
            // Custom variable stored as "cv_<variableId>"
            return (customValues[field] ?? 0) > 0
        }
    }
}
