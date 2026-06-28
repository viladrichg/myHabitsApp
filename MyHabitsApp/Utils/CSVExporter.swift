import Foundation

struct CSVExporter {

    struct CSVColumn {

        let title: String
        let value: (DailyEntry) -> String
    }

    static func columns(
        customVariables: [CustomVariable],
        settings: AppSettings?
    ) -> [CSVColumn] {

        var columns: [CSVColumn] = [

            .init(
                title: "Data",
                value: { $0.date }
            ),

            .init(
                title: "Hora dormir",
                value: { $0.bedtime ?? "" }
            ),

            .init(
                title: "Hora llevar-se",
                value: { $0.wakeupTime ?? "" }
            ),

            .init(
                title: "Qualitat son",
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
                        value: {
                            $0.workedAtJob ? "1" : "0"
                        }
                    )
                )

            case "workedAtHome":

                columns.append(
                    .init(
                        title: variable.displayLabel(using: settings),
                        value: {
                            $0.workedAtHome ? "1" : "0"
                        }
                    )
                )

            case "fum":

                columns.append(
                    .init(
                        title: variable.displayLabel(using: settings),
                        value: {
                            $0.fum ? "1" : "0"
                        }
                    )
                )

            case "gat":

                columns.append(
                    .init(
                        title: variable.displayLabel(using: settings),
                        value: {
                            $0.gat ? "1" : "0"
                        }
                    )
                )

            case "meditation":

                columns.append(
                    .init(
                        title: variable.displayLabel(using: settings),
                        value: {
                            $0.meditation ? "1" : "0"
                        }
                    )
                )

            case "yoga":

                columns.append(
                    .init(
                        title: variable.displayLabel(using: settings),
                        value: {
                            $0.yoga ? "1" : "0"
                        }
                    )
                )

            case "dibuix":

                columns.append(
                    .init(
                        title: variable.displayLabel(using: settings),
                        value: {
                            $0.dibuix ? "1" : "0"
                        }
                    )
                )

            case "llegir":

                columns.append(
                    .init(
                        title: variable.displayLabel(using: settings),
                        value: {
                            $0.llegir ? "1" : "0"
                        }
                    )
                )

            case "counter":

                columns.append(
                    .init(
                        title: variable.displayLabel(using: settings),
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
                value: {
                    $0.sports.joined(separator: "|")
                }
            )
        )

        columns.append(
            .init(
                title: "Notes",
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
