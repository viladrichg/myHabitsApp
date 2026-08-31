import Foundation

struct DateRangeHelper {

    // MARK: - Date range helpers

    static func dates(for timeframe: String) -> [Date] {
        let today = Date().startOfDay
        switch timeframe {
        case "week":      return stride(today, days: 7)
        case "15days":    return stride(today, days: 15)
        case "month":     return stride(today, days: 30)
        case "3months":   return stride(today, days: 90)
        case "6months":   return stride(today, days: 180)
        case "year":      return stride(today, days: 365)
        default:          return stride(today, days: 10000)
        }
    }

    private static func stride(_ end: Date, days: Int) -> [Date] {
        let cal = Calendar.current
        let start = cal.date(byAdding: .day, value: -(days - 1), to: end)!
        var result: [Date] = []
        var cur = start
        while cur <= end {
            result.append(cur)
            cur = cal.date(byAdding: .day, value: 1, to: cur)!
        }
        return result
    }
}

// MARK: - X-Axis label helper

/// Returns at most `maxLabels` evenly-spaced dates from the range,
/// formatted as "dd/MM/yyyy". Used by all chart views.
func sparseXLabels(from dates: [Date], maxLabels: Int = 10) -> [(date: Date, label: String)] {
    guard !dates.isEmpty else { return [] }
    let step = max(1, dates.count / max(1, maxLabels - 1))
    var result: [(Date, String)] = []
    for i in stride(from: 0, to: dates.count, by: step) {
        result.append((dates[i], dates[i].displayDate))
    }
    // Always include last date
    if result.last?.0 != dates.last {
        result.append((dates.last!, dates.last!.displayDate))
    }
    return result
}
