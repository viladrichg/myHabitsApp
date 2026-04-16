import SwiftData
import Foundation

@Model
final class DailyEntry {
    // Primary key — unique per day
    @Attribute(.unique) var date: String   // "YYYY-MM-DD"

    // Sleep
    var bedtime: String?       // "HH:mm"
    var wakeupTime: String?    // "HH:mm"
    var sleepQuality: Int?     // 1–10

    // Work (mutually exclusive in UI, not enforced at model level)
    var workedAtJob: Bool  = false
    var workedAtHome: Bool = false

    // Missed objectives
    var fum: Bool  = false
    var gat: Bool  = false

    // Activities
    var meditation: Bool = false
    var yoga: Bool       = false
    var dibuix: Bool     = false
    var llegir: Bool     = false

    // Counter (0–25)
    var counter: Int?

    // Sports — JSON array of sport names: ["Running","Swimming"]
    var sportsJSON: String = "[]"

    // Custom variables — JSON dict: {"cv_abc123": 1, "cv_xyz": 3}
    var customValuesJSON: String = "{}"

    // Notes
    var notes: String?

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

    /// Calculated sleep duration in hours (handles crossing midnight)
    var sleepHours: Double? {
        guard let bed = bedtime?.parseHHmm(),
              let wake = wakeupTime?.parseHHmm() else { return nil }
        var h = Double(wake.hour - bed.hour) + Double(wake.minute - bed.minute) / 60.0
        if h < 0 { h += 24 }
        return h
    }

    /// true if the given built-in field is active
    func isActive(field: String) -> Bool {
        switch field {
        case "workedAtJob":  return workedAtJob
        case "workedAtHome": return workedAtHome
        case "fum":          return fum
        case "gat":          return gat
        case "meditation":   return meditation
        case "yoga":         return yoga
        case "dibuix":       return dibuix
        case "llegir":       return llegir
        case "sports":       return !sports.isEmpty
        case "counter":      return (counter ?? 0) > 0
        default:
            // Custom variable stored as "cv_<variableId>"
            return (customValues[field] ?? 0) > 0
        }
    }
}
