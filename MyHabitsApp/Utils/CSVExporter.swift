import Foundation

struct CSVExporter {

    struct CSVColumn {

        let title: String
        let key: String
        let value: (DailyEntry) -> String
    }

    static func columns(
        customVariables: [CustomVariable],
        settings: AppSettings?
    ) -> [CSVColumn] {

        var columns: [CSVColumn] = [

            .init(
                title: "Data",
                key: "date",
                value: { $0.date }
            ),

            .init(
                title: "Hora dormir",
                key: "bedtime",
                value: { $0.bedtime ?? "" }
            ),

            .init(
                title: "Hora llevar-se",
                key: "wake-up",
                value: { $0.wakeupTime ?? "" }
            ),

            .init(
                title: "Qualitat son",
                key: "sleep",
                value: { String($0.sleepQuality ?? 0) }
            )
        ]

        for variable in builtInVariables {

            if variable.isHidden(using: settings) {
                continue
            }

            switch variable.fieldKey {

            case "workedAtJob":

                columns.append(
                    .init(
                        title: variable.displayLabel(using: settings),
                        key: "workedAtJob",
                        value: {
                            $0.workedAtJob ? "1" : "0"
                        }
                    )
                )

            case "workedAtHome":

                columns.append(
                    .init(
                        title: variable.displayLabel(using: settings),
                        key: "workedAtHome",
                        value: {
                            $0.workedAtHome ? "1" : "0"
                        }
                    )
                )

            case "fum":

                columns.append(
                    .init(
                        title: variable.displayLabel(using: settings),
                        key: "fum",
                        value: {
                            $0.fum ? "1" : "0"
                        }
                    )
                )

            case "gat":

                columns.append(
                    .init(
                        title: variable.displayLabel(using: settings),
                        key: "gat",
                        value: {
                            $0.gat ? "1" : "0"
                        }
                    )
                )

            case "meditation":

                columns.append(
                    .init(
                        title: variable.displayLabel(using: settings),
                        key: "meditation",
                        value: {
                            $0.meditation ? "1" : "0"
                        }
                    )
                )

            case "yoga":

                columns.append(
                    .init(
                        title: variable.displayLabel(using: settings),
                        key: "yoga",
                        value: {
                            $0.yoga ? "1" : "0"
                        }
                    )
                )

            case "dibuix":

                columns.append(
                    .init(
                        title: variable.displayLabel(using: settings),
                        key: "dibuix",
                        value: {
                            $0.dibuix ? "1" : "0"
                        }
                    )
                )

            case "llegir":

                columns.append(
                    .init(
                        title: variable.displayLabel(using: settings),
                        key: "llegir",
                        value: {
                            $0.llegir ? "1" : "0"
                        }
                    )
                )

            case "counter":

                columns.append(
                    .init(
                        title: variable.displayLabel(using: settings),
                        key: "counter",
                        value: {
                            String($0.counter ?? 0)
                        }
                    )
                )

            default:
                break
            }
        }

        columns.append(
            .init(
                title: "Esports",
                key: "esports",
                value: {
                    $0.sports.joined(separator: "|")
                }
            )
        )

        columns.append(
            .init(
                title: "Notes",
                key: "notes",
                value: {
                    $0.notes ?? ""
                }
            )
        )

        for variable in customVariables {

            let title: String

            if variable.unit.isEmpty {

                title = variable.label

            } else {

                title = "\(variable.label) (\(variable.unit))"
            }

            columns.append(
                .init(
                    title: title,
                    key: variable.variableId,
                    value: { entry in

                        String(
                            entry.customValues[
                                variable.variableId
                            ] ?? 0
                        )
                    }
                )
            )
        }

        return columns
    }

    static func export(
        entries: [DailyEntry],
        customVariables: [CustomVariable],
        settings: AppSettings?
    ) -> String {

        let columns =
            columns(
                customVariables: customVariables,
                settings: settings
            )

        var lines: [String] = [

            columns
                .map(\.title)
                .joined(separator: ","),

            columns
                .map(\.key)
                .joined(separator: ",")
        ]

        for entry in entries {

            let row =
                columns.map {
                    escapeCSV(
                        $0.value(entry)
                    )
                }

            lines.append(
                row.joined(separator: ",")
            )
        }

        return lines.joined(separator: "\n")
    }

    private static func escapeCSV(
        _ value: String
    ) -> String {

        if value.contains(",")
            || value.contains("\"")
            || value.contains("\n") {

            let escaped =
                value.replacingOccurrences(
                    of: "\"",
                    with: "\"\""
                )

            return "\"\(escaped)\""
        }

        return value
    }
}
