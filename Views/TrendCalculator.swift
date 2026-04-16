import Foundation

/// Computes the "Trend / Ritme" metric for a binary field.
///
/// Algorithm:
/// 1. Build cumulative count over the date range (null on missing days).
/// 2. For each consecutive pair of non-null points, compute
///    slope = Δvalue / Δdays.
/// 3. Clamp negative slopes to 0 (regression is not shown).
/// 4. Apply a simple moving average to smooth the result.
/// 5. Return (date, smoothedSlope) pairs for charting.
struct TrendCalculator {

    struct Point: Identifiable {
        var id: String { date }
        let date: Date
        let value: Double   // Smoothed, normalised slope (0…1)
    }

    static func compute(
        entries: [DailyEntry],
        fieldKey: String,
        dates: [Date],          // Ordered date range to evaluate
        smoothingWindow: Int = 5
    ) -> [Point] {
        guard dates.count >= 2 else { return [] }

        let entryByDate: [String: DailyEntry] = Dictionary(
            uniqueKeysWithValues: entries.map { ($0.date, $0) }
        )

        // Build cumulative series
        var cumulative: [(date: Date, value: Double)?] = []
        var running = 0.0
        for d in dates {
            if let e = entryByDate[d.isoDate] {
                if e.isActive(field: fieldKey) { running += 1 }
                cumulative.append((d, running))
            } else {
                cumulative.append(nil)
            }
        }

        // Compute per-interval raw slopes (between consecutive non-nil points)
        var raw: [(date: Date, slope: Double)] = []
        for i in 1 ..< cumulative.count {
            guard let cur = cumulative[i], let prev = cumulative[i - 1] else { continue }
            let daysDiff = Calendar.current
                .dateComponents([.day], from: prev.date, to: cur.date).day ?? 1
            guard daysDiff > 0 else { continue }
            let slope = max(0, (cur.value - prev.value) / Double(daysDiff))
            raw.append((cur.date, slope))
        }
        guard !raw.isEmpty else { return [] }

        // Normalize to 0…1 relative to max slope observed
        let maxSlope = raw.map(\.slope).max() ?? 1
        let normalised = raw.map { (date: $0.date, slope: maxSlope > 0 ? $0.slope / maxSlope : 0) }

        // Moving average
        let w = max(1, min(smoothingWindow, normalised.count))
        var smoothed: [Point] = []
        for i in 0 ..< normalised.count {
            let lo = max(0, i - w / 2)
            let hi = min(normalised.count - 1, i + w / 2)
            let window = normalised[lo ... hi]
            let avg = window.map(\.slope).reduce(0, +) / Double(window.count)
            smoothed.append(Point(date: normalised[i].date, value: avg))
        }
        return smoothed
    }

    // MARK: - Date range helpers

    static func dates(for timeframe: String) -> [Date] {
        let today = Date().startOfDay
        let cal   = Calendar.current
        switch timeframe {
        case "week":      return stride(today, days: 7)
        case "15days":    return stride(today, days: 15)
        case "month":     return stride(today, days: 30)
        case "3months":   return stride(today, days: 90)
        case "6months":   return stride(today, days: 180)
        case "year":      return stride(today, days: 365)
        default:          return stride(today, days: 365)
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
func sparseXLabels(from dates: [Date], maxLabels: Int = 6) -> [(date: Date, label: String)] {
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
