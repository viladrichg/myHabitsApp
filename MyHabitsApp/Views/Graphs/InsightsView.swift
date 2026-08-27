import SwiftUI
import SwiftData

struct InsightsView: View {

    let entries: [DailyEntry]
    
    @Environment(\.appTheme) var theme

    @Query(sort: \DailyEntry.date, order: .reverse)
    private var allEntries: [DailyEntry]
    
    private var insightEntries: [DailyEntry] {

        guard let timeframe = settings?.chartTimeframe else {
            return entries
        }

        guard timeframe != "week",
              timeframe != "15days",
              timeframe != "month",
              timeframe != "all"
        else {
            return entries
        }

        guard
            let firstDate = entries
                .compactMap({ Date.from(isoDate: $0.date) })
                .min(),
            let lastDate = entries
                .compactMap({ Date.from(isoDate: $0.date) })
                .max()
        else {
            return entries
        }

        let cal = Calendar.current

        let startOfFirstMonth =
            cal.date(
                from: cal.dateComponents(
                    [.year, .month],
                    from: firstDate
                )
            )!

        return allEntries.filter {

            guard let date =
                Date.from(isoDate: $0.date)
            else {
                return false
            }

            return
                date >= startOfFirstMonth
                &&
                date <= lastDate
        }
    }


    @Query(sort: \CustomVariable.order)
    private var customVariables: [CustomVariable]

    @Query(sort: \AppSettings.createdAt)
    private var allSettings: [AppSettings]

    private var settings: AppSettings? {
        allSettings.first
    }

    @State private var selectedField = "positive1"

    private var currentStreak: Int {
        streakForField(selectedField)
    }
    
    private var bestStreak: Int {
        bestStreakForField(selectedField)
    }
    
    private var isNegativeVariable: Bool {
        selectedField == "negative1"
        ||
        selectedField == "negative2"
    }
    
    private var adherenceText: String {

        let totalDays = entries.count

        guard totalDays > 0 else {
            return "0%"
        }

        let activeDays =
            entries.filter {
                $0.isActive(field: selectedField)
            }.count

        let percentage =
            Int(
                (Double(activeDays)
                 / Double(totalDays))
                * 100
            )

        return "\(percentage)% (\(activeDays) / \(totalDays))"
    }
    
    private var weeklyAverageText: String {

        guard !entries.isEmpty else {
            return "0"
        }

        let activeDays =
            entries.filter {
                $0.isActive(field: selectedField)
            }.count

        let firstDate =
            entries
                .compactMap {
                    Date.from(isoDate: $0.date)
                }
                .min()

        let lastDate =
            entries
                .compactMap {
                    Date.from(isoDate: $0.date)
                }
                .max()

        guard let firstDate,
              let lastDate
        else {
            return "0"
        }

        let days =
            max(
                1,
                Calendar.current.dateComponents(
                    [.day],
                    from: firstDate,
                    to: lastDate
                ).day ?? 1
            )

        let weeks =
            Double(days) / 7.0

        let avg =
            Double(activeDays) / weeks

        return String(
            format: "%.1f",
            avg
        )
    }

    
    private func bestStreakForField(
        _ field: String
    ) -> Int {

        let activeDates = Set(
            allEntries
                .filter {
                    $0.isActive(field: field)
                }
                .map(\.date)
        )

        var best = 0
        var current = 0

        for entry in allEntries.sorted(by: { $0.date < $1.date }) {

            if activeDates.contains(entry.date) {

                current += 1
                best = max(best, current)

            } else {

                current = 0
            }
        }

        return best
    }
    
    private func streakForField(
        _ field: String
    ) -> Int {

        let activeDates = Set(
            allEntries
                .filter {
                    $0.isActive(field: field)
                }
                .map(\.date)
        )

        var streak = 0
        var current = Date()

        if !activeDates.contains(current.isoDate),
           let yesterday = Calendar.current.date(
                byAdding: .day,
                value: -1,
                to: current
           ) {

            current = yesterday
        }

        while activeDates.contains(current.isoDate) {

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
    
    //MARK: bestMonth
    
    private var bestMonthText: String {

        let grouped =
            Dictionary(
                grouping: insightEntries.filter {
                    $0.isActive(field: selectedField)
                }
            ) {
                String($0.date.prefix(7))
            }

        guard let best =
            grouped.max(
                by: { $0.value.count < $1.value.count }
            )
        else {
            return "-"
        }

        return "\(prettyMonth(best.key)) (\(best.value.count) dies)"
    }

    private var worstMonthText: String {

        let grouped =
            Dictionary(
                grouping: insightEntries.filter {
                    $0.isActive(field: selectedField)
                }
            ) {
                String($0.date.prefix(7))
            }

        guard let worst =
            grouped.min(
                by: { $0.value.count < $1.value.count }
            )
        else {
            return "-"
        }

        return "\(prettyMonth(worst.key)) (\(worst.value.count) dies)"
    }
    
    private var numericValues: [Int] {

        entries.compactMap { entry in

            if selectedField == "counter" {
                return entry.counter
            }

            if selectedField == "sleepQuality" {
                return entry.sleepQuality
            }

            guard let value =
                entry.customValues[selectedField]
            else {
                return nil
            }

            if let variable =
                customVariables.first(
                    where: {
                        $0.variableId == selectedField
                    }
                ),
               variable.ignoreZerosInStats,
               value == 0 {

                return nil
            }

            return value
        }
    }
    
    //MARK: Tendencia
    
    private var trendText: String {

        let data = entries

        guard data.count >= 8 else {
            return "-"
        }

        let middle = data.count / 2

        let firstHalf =
            Array(data.prefix(middle))

        let secondHalf =
            Array(data.suffix(data.count - middle))

        let firstCount =
            firstHalf.filter {
                $0.isActive(field: selectedField)
            }.count

        let secondCount =
            secondHalf.filter {
                $0.isActive(field: selectedField)
            }.count

        guard firstCount > 0 else {

            if secondCount > 0 {

                return isNegativeVariable
                    ? "↑ Més incidències"
                    : "↑ Nou"
            }

            return "→ Estable"
        }

        let change =
            (
                Double(secondCount - firstCount)
                / Double(firstCount)
            ) * 100

        let rounded =
            Int(change.rounded())

        if isNegativeVariable {

            if rounded > 0 {
                return "↑ Més cops (+\(rounded)%)"
            }

            if rounded < 0 {
                return "↓ Menys cops (\(rounded)%)"
            }

            return "→ Estable"
        }

        if rounded > 0 {
            return "↑ Millorant (+\(rounded)%)"
        }

        if rounded < 0 {
            return "↓ Empitjorant (\(rounded)%)"
        }

        return "→ Estable"
    }
    
    private var canShowMonthInsights: Bool {

        guard let timeframe =
            settings?.chartTimeframe
        else {
            return false
        }

        return [
            "3months",
            "6months",
            "year",
            "all"
        ].contains(timeframe)
    }
    
    private var availableVariables: [
        (
            id: String,
            label: String,
            type: String
        )
    ] {

        let sleepVariables = [
            (
                id: "sleep",
                label: "Hores de son",
                type: "sleep"
            ),
            (
                id: "sleepQuality",
                label: "Qualitat del son",
                type: "sleepQuality"
            )
        ]

        let builtInVariablesAll =
            builtInVariables
                .filter {
                    !$0.isHidden(using: settings)
                }
                .filter {
                    $0.type == "boolean"
                    || $0.type == "counter"
                }
                .map {
                    (
                        id: $0.fieldKey,
                        label: $0.displayLabel(using: settings),
                        type: $0.type
                    )
                }

        let customVariablesAll =
            customVariables
                .filter { !$0.isHidden }
                .map {
                    (
                        id: $0.variableId,
                        label: $0.label,
                        type: $0.type
                    )
                }

        return
            sleepVariables
            + builtInVariablesAll
            + customVariablesAll
    }
    
    private var selectedVariableType: String {

        availableVariables.first {
            $0.id == selectedField
        }?.type ?? "boolean"
    }

    //MARK: Counters
    
    private var numericAverage: String {

        guard !numericValues.isEmpty else {
            return "-"
        }

        let avg =
            Double(numericValues.reduce(0,+))
            / Double(numericValues.count)

        return String(format: "%.1f", avg)
    }
    
    private var numericMin: String {

        guard let value = numericValues.min() else {
            return "-"
        }

        return "\(value)"
    }
    
    private var numericMax: String {

        guard let value = numericValues.max() else {
            return "-"
        }

        return "\(value)"
    }
    
    private var numericTrendText: String {

        let data = numericValues

        guard data.count >= 8 else {
            return "-"
        }

        let middle = data.count / 2

        let firstHalf =
            Array(data.prefix(middle))

        let secondHalf =
            Array(data.suffix(data.count - middle))

        let firstAvg =
            Double(firstHalf.reduce(0,+))
            / Double(firstHalf.count)

        let secondAvg =
            Double(secondHalf.reduce(0,+))
            / Double(secondHalf.count)

        guard firstAvg > 0 else {
            return "→ Estable"
        }

        let change =
            ((secondAvg - firstAvg) / firstAvg)
            * 100

        let rounded =
            Int(change.rounded())

        if rounded > 0 {
            return "↑ Millorant (+\(rounded)%)"
        }

        if rounded < 0 {
            return "↓ Empitjorant (\(rounded)%)"
        }

        return "→ Estable"
    }

    private var numericBestMonthText: String {

        let grouped =
            Dictionary(
                grouping: insightEntries
            ) {
                String($0.date.prefix(7))
            }

        let monthlyAverages =
            grouped.compactMap { key, entries -> (String, Double)? in

                let values =
                    entries.compactMap { entry -> Int? in

                        if selectedField == "counter" {
                            return entry.counter
                        }

                        if selectedField == "sleepQuality" {

                            guard let value = entry.sleepQuality,
                                  value > 0
                            else {
                                return nil
                            }

                            return value
                        }

                        guard let value =
                            entry.customValues[selectedField]
                        else {
                            return nil
                        }

                        if let variable =
                            customVariables.first(
                                where: { $0.variableId == selectedField }
                            ),
                           variable.ignoreZerosInStats,
                           value == 0 {

                            return nil
                        }

                        return value
                    }

                guard !values.isEmpty else {
                    return nil
                }

                let avg =
                    Double(values.reduce(0,+))
                    / Double(values.count)

                return (key, avg)
            }

        guard let best =
            monthlyAverages.max(
                by: { $0.1 < $1.1 }
            )
        else {
            return "-"
        }

        return "\(prettyMonth(best.0)) (\(String(format: "%.1f", best.1)))"
    }
    
    private var numericWorstMonthText: String {

        let grouped =
            Dictionary(
                grouping: insightEntries
            ) {
                String($0.date.prefix(7))
            }

        let monthlyAverages =
            grouped.compactMap { key, entries -> (String, Double)? in

                let values =
                    entries.compactMap { entry -> Int? in

                        if selectedField == "counter" {
                            return entry.counter
                        }

                        if selectedField == "sleepQuality" {
                            return entry.sleepQuality
                        }

                        guard let value =
                            entry.customValues[selectedField]
                        else {
                            return nil
                        }

                        if let variable =
                            customVariables.first(
                                where: { $0.variableId == selectedField }
                            ),
                           variable.ignoreZerosInStats,
                           value == 0 {

                            return nil
                        }

                        return value
                    }

                guard !values.isEmpty else {
                    return nil
                }

                let avg =
                    Double(values.reduce(0,+))
                    / Double(values.count)

                return (key, avg)
            }

        guard let worst =
            monthlyAverages.min(
                by: { $0.1 < $1.1 }
            )
        else {
            return "-"
        }

        return "\(prettyMonth(worst.0)) (\(String(format: "%.1f", worst.1)))"
    }

    //MARK: dades sleep
    private var sleepValues: [Double] {

        entries.compactMap {
            $0.sleepHours
        }
    }
    
    private var sleepQualityValues: [Int] {

        entries.compactMap {
            $0.sleepQuality
        }
    }
    
    private var sleepAverage: String {

        guard !sleepValues.isEmpty else {
            return "-"
        }

        let avg =
            sleepValues.reduce(0,+)
            / Double(sleepValues.count)

        return String(format: "%.1f h", avg)
    }
    
    private var shortestNight: String {

        guard let value = sleepValues.min()
        else {
            return "-"
        }

        return String(format: "%.1f h", value)
    }
    
    private var longestNight: String {

        guard let value = sleepValues.max()
        else {
            return "-"
        }

        return String(format: "%.1f h", value)
    }
    
    private var sleepTrendText: String {

        let data = sleepValues

        guard data.count >= 8 else {
            return "-"
        }

        let middle = data.count / 2

        let firstHalf =
            Array(data.prefix(middle))

        let secondHalf =
            Array(data.suffix(data.count - middle))

        let firstAvg =
            firstHalf.reduce(0,+)
            / Double(firstHalf.count)

        let secondAvg =
            secondHalf.reduce(0,+)
            / Double(secondHalf.count)

        guard firstAvg > 0 else {
            return "→ Estable"
        }

        let change =
            ((secondAvg - firstAvg) / firstAvg)
            * 100

        let rounded =
            Int(change.rounded())

        if rounded > 0 {
            return "↑ Millorant (+\(rounded)%)"
        }

        if rounded < 0 {
            return "↓ Empitjorant (\(rounded)%)"
        }

        return "→ Estable"
    }
    
    private var sleepBestMonthText: String {

        let grouped =
            Dictionary(
                grouping: insightEntries.compactMap {
                    entry -> (String, Double)? in

                    guard let hours =
                        entry.sleepHours
                    else {
                        return nil
                    }

                    return (
                        String(entry.date.prefix(7)),
                        hours
                    )
                }
            ) { $0.0 }

        let monthlyAverages =
            grouped.compactMap {
                key,
                values -> (String, Double)? in

                let avg =
                    values.map(\.1).reduce(0,+)
                    / Double(values.count)

                return (key, avg)
            }

        guard let best =
            monthlyAverages.max(
                by: { $0.1 < $1.1 }
            )
        else {
            return "-"
        }

        return "\(prettyMonth(best.0)) (\(String(format: "%.1f h", best.1)))"
    }
    
    private var sleepWorstMonthText: String {

        let grouped =
            Dictionary(
                grouping: insightEntries.compactMap {
                    entry -> (String, Double)? in

                    guard let hours =
                        entry.sleepHours
                    else {
                        return nil
                    }

                    return (
                        String(entry.date.prefix(7)),
                        hours
                    )
                }
            ) { $0.0 }

        let monthlyAverages =
            grouped.compactMap {
                key,
                values -> (String, Double)? in

                let avg =
                    values.map(\.1).reduce(0,+)
                    / Double(values.count)

                return (key, avg)
            }

        guard let worst =
            monthlyAverages.min(
                by: { $0.1 < $1.1 }
            )
        else {
            return "-"
        }

        return "\(prettyMonth(worst.0)) (\(String(format: "%.1f h", worst.1)))"
    }
    
    //MARK: BODY
    
    var body: some View {
        
        VStack(
            alignment: .leading,
            spacing: 16
        ) {
            
            Text("Anàlisi avançat")
                .font(.headline)
            
            
            HStack {
                
                Text("Selecciona una variable: ")
                    .foregroundStyle(theme.secondary)
                
                Spacer()
                
                Picker("", selection: $selectedField) {

                    Section("Son") {

                        Text("Hores de son")
                            .tag("sleep")

                        Text("Qualitat del son")
                            .tag("sleepQuality")
                    }

                    Section("Booleanes") {

                        ForEach(
                            availableVariables.filter {
                                $0.type == "boolean"
                            },
                            id: \.id
                        ) { variable in

                            Text(variable.label)
                                .tag(variable.id)
                        }
                    }

                    Section("Comptadors") {

                        ForEach(
                            availableVariables.filter {
                                $0.type == "counter"
                            },
                            id: \.id
                        ) { variable in

                            Text(variable.label)
                                .tag(variable.id)
                        }
                    }

                    Section("Valoracions") {

                        ForEach(
                            availableVariables.filter {
                                $0.type == "rating"
                            },
                            id: \.id
                        ) { variable in

                            Text(variable.label)
                                .tag(variable.id)
                        }
                    }
                }
                .pickerStyle(.menu)
                .onChange(of: selectedField) { _, newValue in

                    settings?.lastAnalysisField = newValue
                }                
            }
            
            Divider()
            
            //MARK: case boolean
            if selectedVariableType == "boolean" {
                
                insightRow(
                    icon: "🔥",
                    title: "Ratxa actual",
                    value: "\(currentStreak) dies"
                )
                
                insightRow(
                    icon: "🏆",
                    title: isNegativeVariable
                    ? "Pitjor ratxa"
                    : "Millor ratxa",
                    value: "\(bestStreak) dies"
                )
                
                Capsule()
                    .fill(theme.border)
                    .frame(width: 180, height: 2)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                
                insightRow(
                    icon: "✅",
                    title: "Adherència",
                    value: "\(adherenceText)"
                )
                
                insightRow(
                    icon: "📅",
                    title: "Mitjana setmanal",
                    value: "\(weeklyAverageText) dies / set."
                )
                
                insightRow(
                    icon: "📈",
                    title: "Tendència",
                    value: trendText
                )
                
                if canShowMonthInsights {
                    
                    insightRow(
                        icon: isNegativeVariable
                        ? "✅"
                        : "🥇",
                        title: isNegativeVariable
                        ? "Mes més complicat"
                        : "Millor mes",
                        value: bestMonthText
                    )
                    
                    insightRow(
                        icon: isNegativeVariable
                        ? "🔥"
                        : "🥶",
                        title: isNegativeVariable
                        ? "Mes més controlat"
                        : "Pitjor mes",
                        value: worstMonthText
                    )
                }
            }
            
            //MARK: case counter i rating
            if selectedVariableType == "counter"
            || selectedVariableType == "rating"
            || selectedVariableType == "sleepQuality" {
                
                insightRow(
                    icon: "📊",
                    title: "Mitjana",
                    value: numericAverage
                )
                
                insightRow(
                    icon: "⬇️",
                    title: "Mínim",
                    value: numericMin
                )
                
                insightRow(
                    icon: "⬆️",
                    title: "Màxim",
                    value: numericMax
                )
                
                insightRow(
                    icon: "📈",
                    title: "Tendència",
                    value: numericTrendText
                )
                
                if canShowMonthInsights {
                    insightRow(
                        icon: "🥇",
                        title: "Millor mes",
                        value: numericBestMonthText
                    )
                    
                    insightRow(
                        icon: "🥶",
                        title: "Pitjor mes",
                        value: numericWorstMonthText
                    )
                }
                
                Text("La tendència i els mesos es calculen a partir de la mitjana dels valors.")
                    .font(.caption)
                    .foregroundStyle(theme.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 4)
            }
            
            //MARK: case SON
            
            if selectedVariableType == "sleep" {
                
                insightRow(
                    icon: "🌙",
                    title: "Mitjana",
                    value: sleepAverage
                )
                
                insightRow(
                    icon: "😴",
                    title: "Nit més curta",
                    value: shortestNight
                )
                
                insightRow(
                    icon: "🔋",
                    title: "Nit més llarga",
                    value: longestNight
                )
                
                insightRow(
                    icon: "📈",
                    title: "Tendència",
                    value: sleepTrendText
                )
                
                if canShowMonthInsights {
                    
                    insightRow(
                        icon: "🥇",
                        title: "Millor mes",
                        value: sleepBestMonthText
                    )
                    
                    insightRow(
                        icon: "🥶",
                        title: "Pitjor mes",
                        value: sleepWorstMonthText
                    )
                }
            }
        }
        .padding()
        .cardStyle()
        .onAppear {
            
            if let settings {
                selectedField = settings.lastAnalysisField
            }
        }
    }

    private func prettyMonth(
        _ yearMonth: String
    ) -> String {

        let parts = yearMonth.split(separator: "-")

        guard parts.count == 2,
              let month = Int(parts[1])
        else {
            return yearMonth
        }

        let months = [
            "Gener",
            "Febrer",
            "Març",
            "Abril",
            "Maig",
            "Juny",
            "Juliol",
            "Agost",
            "Setembre",
            "Octubre",
            "Novembre",
            "Desembre"
        ]

        return "\(months[month - 1]) \(parts[0])"
    }
    
    private func insightRow(
        icon: String,
        title: String,
        value: String
    ) -> some View {

        HStack {

            Text(icon)

            Text(title)

            Spacer()

            Text(value)
                .foregroundStyle(theme.secondary)
        }
    }
}
