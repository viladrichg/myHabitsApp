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
                key: "bedTime",
                value: { $0.bedTime ?? "" }
            ),

            .init(
                title: "Hora llevar-se",
                key: "wakeUpTime",
                value: { $0.wakeUpTime ?? "" }
            ),

            .init(
                title: "Qualitat son",
                key: "sleepQuality",
                value: { String($0.sleepQuality ?? 0) }
            )
        ]

        for variable in builtInVariables {

            if variable.isHidden(using: settings) {
                continue
            }

            switch variable.fieldKey {

            case "habit1":

                columns.append(
                    .init(
                        title: variable.displayLabel(using: settings),
                        key: "habit1",
                        value: {
                            $0.habit1 ? "1" : "0"
                        }
                    )
                )

            case "habit2":

                columns.append(
                    .init(
                        title: variable.displayLabel(using: settings),
                        key: "habit2",
                        value: {
                            $0.habit2 ? "1" : "0"
                        }
                    )
                )

            case "negative1":

                columns.append(
                    .init(
                        title: variable.displayLabel(using: settings),
                        key: "negative1",
                        value: {
                            $0.negative1 ? "1" : "0"
                        }
                    )
                )

            case "negative2":

                columns.append(
                    .init(
                        title: variable.displayLabel(using: settings),
                        key: "negative2",
                        value: {
                            $0.negative2 ? "1" : "0"
                        }
                    )
                )

            case "positive1":

                columns.append(
                    .init(
                        title: variable.displayLabel(using: settings),
                        key: "positive1",
                        value: {
                            $0.positive1 ? "1" : "0"
                        }
                    )
                )

            case "positive2":

                columns.append(
                    .init(
                        title: variable.displayLabel(using: settings),
                        key: "positive2",
                        value: {
                            $0.positive2 ? "1" : "0"
                        }
                    )
                )

            case "positive3":

                columns.append(
                    .init(
                        title: variable.displayLabel(using: settings),
                        key: "positive3",
                        value: {
                            $0.positive3 ? "1" : "0"
                        }
                    )
                )

            case "positive4":

                columns.append(
                    .init(
                        title: variable.displayLabel(using: settings),
                        key: "positive4",
                        value: {
                            $0.positive4 ? "1" : "0"
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
                key: "sports",
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

        let sortedEntries = entries.sorted {
            $0.date > $1.date
        }

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

        for entry in sortedEntries {

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
