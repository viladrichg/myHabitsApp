import SwiftUI
import SwiftData

struct SportDetailView: View {

    let sportName: String

    @Query(sort: \DailyEntry.date, order: .reverse)
    private var entries: [DailyEntry]

    private var matchingEntries: [DailyEntry] {

        entries.filter { entry in

            let sports = entry.sports.flatMap {

                $0.split(separator: ",")
                    .map {
                        $0.trimmingCharacters(
                            in: .whitespacesAndNewlines
                        )
                    }
            }

            return sports.contains {
                $0.caseInsensitiveCompare(
                    sportName
                ) == .orderedSame
            }
        }
    }

    private var sportDates: [Date] {

        matchingEntries.compactMap {
            Date.from(isoDate: $0.date)
        }
        .sorted()
    }

    private var currentStreak: Int {

        let dates =
            Set(
                sportDates.map(\.isoDate)
            )

        var streak = 0
        var current = Date()

        while dates.contains(current.isoDate) {

            streak += 1

            guard let previous =
                Calendar.current.date(
                    byAdding: .day,
                    value: -1,
                    to: current
                )
            else {
                break
            }

            current = previous
        }

        return streak
    }

    private var bestStreak: Int {

        guard !sportDates.isEmpty else {
            return 0
        }

        var best = 1
        var current = 1

        for i in 1..<sportDates.count {

            let diff =
                Calendar.current.dateComponents(
                    [.day],
                    from: sportDates[i - 1],
                    to: sportDates[i]
                ).day ?? 0

            if diff == 1 {

                current += 1
                best = max(best, current)

            } else {

                current = 1
            }
        }

        return best
    }
    
    private var last30Count: Int {

        let cutoff = Calendar.current.date(
            byAdding: .day,
            value: -30,
            to: Date()
        )!

        return sportDates.filter {
            $0 >= cutoff
        }.count
    }

    private var last90Count: Int {

        let cutoff = Calendar.current.date(
            byAdding: .day,
            value: -90,
            to: Date()
        )!

        return sportDates.filter {
            $0 >= cutoff
        }.count
    }

    private var thisYearCount: Int {

        let year =
            Calendar.current.component(
                .year,
                from: Date()
            )

        return sportDates.filter {

            Calendar.current.component(
                .year,
                from: $0
            ) == year

        }.count
    }
    private var lastDateText: String {

        guard let last = matchingEntries.first?.date
        else {
            return "-"
        }

        return last
    }

    var body: some View {

        List {

            Section("Resum") {

                LabeledContent(
                    "Total",
                    value: "\(matchingEntries.count)"
                )

                LabeledContent(
                    "Ratxa actual",
                    value: "\(currentStreak)"
                )

                LabeledContent(
                    "Millor ratxa",
                    value: "\(bestStreak)"
                )
                
                LabeledContent(
                    "Últim cop",
                    value: lastDateText
                )
                
                LabeledContent(
                    "Últims 30 dies",
                    value: "\(last30Count)"
                )

                LabeledContent(
                    "Últims 90 dies",
                    value: "\(last90Count)"
                )

                LabeledContent(
                    "Aquest any",
                    value: "\(thisYearCount)"
                )            }

            Section("Dies") {

                ForEach(
                    matchingEntries,
                    id: \.date
                ) { entry in

                    Text(entry.date)
                }
            }
        }
        .navigationTitle(sportName)
    }
}
