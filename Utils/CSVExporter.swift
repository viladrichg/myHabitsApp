import Foundation

/// Generates RFC 4180 CSV from DailyEntry records.
/// Format is compatible with the React Native app's export so existing
/// data can be migrated.
struct CSVExporter {

    // MARK: - Headers

    static func headers(customVariables: [CustomVariable]) -> [String] {
        var h = [
            "date", "bedtime", "wakeup_time", "sleep_quality",
            "worked_at_job", "worked_at_home",
            "fum", "gat",
            "meditation", "yoga", "dibuix", "llegir",
            "counter", "sports", "notes"
        ]
        for v in customVariables.sorted(by: { $0.order < $1.order }) {
            h.append(v.variableId)
        }
        return h
    }

    // MARK: - Export

    static func export(entries: [DailyEntry],
                       customVariables: [CustomVariable]) -> String {
        let cols = headers(customVariables: customVariables)
        var lines: [String] = [cols.map(quote).joined(separator: ",")]

        let sorted = entries.sorted { $0.date > $1.date }
        for e in sorted {
            var row: [String] = [
                e.date,
                e.bedtime    ?? "",
                e.wakeupTime ?? "",
                e.sleepQuality.map { String($0) } ?? "",
                e.workedAtJob  ? "1" : "0",
                e.workedAtHome ? "1" : "0",
                e.fum       ? "1" : "0",
                e.gat       ? "1" : "0",
                e.meditation ? "1" : "0",
                e.yoga       ? "1" : "0",
                e.dibuix     ? "1" : "0",
                e.llegir     ? "1" : "0",
                e.counter.map { String($0) } ?? "",
                e.sports.joined(separator: ";"),   // semicolon-separated for readability
                e.notes ?? ""
            ]
            let cvs = e.customValues
            for v in customVariables.sorted(by: { $0.order < $1.order }) {
                row.append(String(cvs[v.variableId] ?? 0))
            }
            lines.append(row.map(quote).joined(separator: ","))
        }
        return lines.joined(separator: "\n")
    }

    // MARK: - RFC 4180 quoting

    private static func quote(_ s: String) -> String {
        guard s.contains(",") || s.contains("\"") || s.contains("\n") else { return s }
        return "\"\(s.replacingOccurrences(of: "\"", with: "\"\""))\""
    }
}