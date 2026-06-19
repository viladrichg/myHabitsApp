import Foundation

struct CSVExporter {

    static func headers(customVariables: [CustomVariable]) -> [String] {

        var h = [
            "date", "bedtime", "wakeup_time", "sleep_quality",
            "worked_at_job", "worked_at_home",
            "fum", "gat",
            "meditation", "yoga", "dibuix", "llegir",
            "counter", "sports", "notes"
        ]

        for v in customVariables {
            h.append(v.variableId)
        }

        return h
    }

    static func export(
        entries: [DailyEntry],
        customVariables: [CustomVariable]
    ) -> String {

        let cols = headers(customVariables: customVariables)
        var lines: [String] = [cols.joined(separator: ",")]

        for e in entries {

            var row: [String] = [
                e.date,
                e.bedtime ?? "",
                e.wakeupTime ?? "",
                String(e.sleepQuality ?? 0),
                e.workedAtJob ? "1" : "0",
                e.workedAtHome ? "1" : "0",
                e.fum ? "1" : "0",
                e.gat ? "1" : "0",
                e.meditation ? "1" : "0",
                e.yoga ? "1" : "0",
                e.dibuix ? "1" : "0",
                e.llegir ? "1" : "0",
                String(e.counter ?? 0),
                e.sports.joined(separator: "|"), // ✅ SAME AS IMPORT
                e.notes ?? ""
            ]

            for v in customVariables {
                row.append(String(e.customValues[v.variableId] ?? 0))
            }

            lines.append(row.joined(separator: ","))
        }

        return lines.joined(separator: "\n")
    }
}
