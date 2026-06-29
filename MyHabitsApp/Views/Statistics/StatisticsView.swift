import SwiftUI
import SwiftData
import Charts

struct StatisticsView: View {
    @Environment(\.appTheme) var theme
    @Query(sort: \DailyEntry.date, order: .reverse) private var entries: [DailyEntry]
    @Query(sort: \CustomVariable.order)
    private var customVariables: [CustomVariable]
    @Query(sort: \AppSettings.createdAt)
    private var allSettings: [AppSettings]

    private var settings: AppSettings? {
        allSettings.first
    }
    
    @State private var displayMonth = Date()
    @State private var selectedDayDate: Date?
    @State private var showEditor = false


    private var cal: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = Locale(identifier: "ca_ES")
        calendar.firstWeekday = 2 // Dilluns
        return calendar
    }
    private var year:  Int { cal.component(.year,  from: displayMonth) }
    private var month: Int { cal.component(.month, from: displayMonth) }

    private var monthEntries: [String: DailyEntry] {
        Dictionary(uniqueKeysWithValues:
            entries
                .filter { $0.date.hasPrefix(String(format: "%04d-%02d", year, month)) }
                .map { ($0.date, $0) }
        )
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    monthNavigator
                    calendarGrid
                    sleepCard

                    if !(builtInVariables.first {
                        $0.fieldKey == "counter"
                    }?.isHidden(using: settings) ?? false) {

                        pitellsCard
                    }

                    ForEach(
                        customVariables.filter {
                            $0.type == "counter"
                        }
                    ) { variable in

                        customCounterCard(variable)
                    }

                    legendView
                }
                .padding()
            }
            .background(theme.bg.ignoresSafeArea())
            .navigationTitle("Calendari")
            .sheet(isPresented: $showEditor) {

                if let selectedDayDate {

                    DataEntryView(
                        selectedTab: .constant(1),
                        initialDate: selectedDayDate
                    )
                }
            }

        }
    }

    // MARK: - Month navigator

    private var monthNavigator: some View {
        HStack {
            Button { shiftMonth(-1) } label: {
                Image(systemName: "chevron.left").foregroundStyle(theme.accent)
            }
            Spacer()
            Text(monthLabel)
                .font(.headline)
                .foregroundStyle(theme.text)
            Spacer()
            Button { shiftMonth(1) } label: {
                Image(systemName: "chevron.right").foregroundStyle(theme.accent)
            }
        }
        .padding(.horizontal)
    }

    private var monthLabel: String {

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

        return "\(months[month - 1]) \(year)"
    }
    
    // MARK: - Calendar grid

    private var calendarGrid: some View {

        let days = daysInMonth()
        let offset = firstWeekdayOfMonth()

        let cells = Array(repeating: 0, count: offset) + days

        return LazyVGrid(
            columns: Array(repeating: GridItem(.flexible()), count: 7),
            spacing: 4
        ) {

            ForEach(["Dl","Dt","Dc","Dj","Dv","Ds","Dg"], id: \.self) {
                Text($0)
                    .frame(maxWidth: .infinity)
            }

            ForEach(Array(cells.enumerated()), id: \.offset) { _, value in

                if value == 0 {

                    Color.clear
                        .frame(height: 44)

                } else {

                    dayCell(day: value)
                }
            }
        }
    }

    private func dayCell(day: Int) -> some View {

            let dateStr = String(
                format: "%04d-%02d-%02d",
                year,
                month,
                day
            )

            let e = monthEntries[dateStr]

            let isToday = dateStr == Date().isoDate

            let activityColor = e.flatMap {
                dominantColor($0)
            }

            let safeColor: Color =
                activityColor
                ?? (isToday
                    ? theme.accent.opacity(0.2)
                    : theme.card)

            let safeTextColor: Color =
                activityColor != nil
                ? .white
                : theme.text

            return Button {

                var comps = DateComponents()

                comps.year = year
                comps.month = month
                comps.day = day

                if let d = Calendar.current.date(from: comps) {

                    selectedDayDate = d

                    DispatchQueue.main.async {

                        showEditor = true
                    }
                }

            } label: {

                ZStack {

                    RoundedRectangle(cornerRadius: 8)
                        .fill(safeColor)

                    VStack(spacing: 1) {

                        Text("\(day)")
                            .font(
                                .caption.weight(
                                    isToday
                                    ? .bold
                                    : .regular
                                )
                            )
                            .foregroundStyle(safeTextColor)

                        if let e = e {
                            activityDots(e)
                        }
                    }
                }
            }
            .buttonStyle(.plain)
            .frame(height: 44)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(
                        isToday
                        ? theme.accent
                        : .clear,
                        lineWidth: 1.5
                    )
            )
        }


    private func activityDots(_ e: DailyEntry) -> some View {

        let builtInActive =
            builtInVariables
                .filter {
                    !$0.isHidden(using: settings)
                }
                .filter {
                    e.isActive(field: $0.fieldKey)
                }
                .map {
                    $0.displayColor(using: settings)
                }

        let customActive =
            customVariables
                .filter {
                    e.isActive(field: $0.variableId)
                }
                .map {
                    Color(hex: $0.colorHex)
                }

        let colors = builtInActive + customActive

        return HStack(spacing: 2) {

            ForEach(
                Array(colors.prefix(4).enumerated()),
                id: \.offset
            ) { _, color in

                Circle()
                    .fill(color)
                    .frame(width: 4, height: 4)
            }
        }
    }
    
    private func dominantColor(_ e: DailyEntry) -> Color? {

        if e.fum {
            return .red
        }

        if e.gat {
            return Color(hex: "#FF69B4")
        }

        let hasWork =
            e.workedAtJob ||
            e.workedAtHome

        let hasActivities =
            e.meditation ||
            e.yoga ||
            e.dibuix ||
            e.llegir ||
            !e.sports.isEmpty

        // Dia perfecte
        if hasWork && hasActivities {
            return .green
        }

        // Només hàbits
        if hasActivities {
            return .yellow
        }

        // Casa preval sobre feina
        if e.workedAtHome {
            return .orange
        }

        if e.workedAtJob {
            return .blue
        }

        return nil
    }

    // MARK: - Legend

    private var legendView: some View {

        let builtInRows =
            builtInVariables
                .filter {
                    !($0.isHidden(using: settings))
                }
                .map { v in

                    (
                        label: v.displayLabel(using: settings),
                        color: v.displayColor(using: settings),
                        count:
                            monthEntries.values.filter {
                                $0.isActive(field: v.fieldKey)
                            }.count
                    )
                }

        let customRows =
            customVariables
                .filter { $0.type == "boolean" }
                .map { v in

                (
                    label: v.label,
                    color: Color(hex: v.colorHex),
                    count:
                        monthEntries.values.filter {
                            $0.isActive(field: v.variableId)
                        }.count
                )
            }

        let rows = builtInRows + customRows

        return LazyVGrid(
            columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ],
            spacing: 8
        ) {

            ForEach(
                Array(rows.enumerated()),
                id: \.offset
            ) { _, row in

                HStack(spacing: 6) {

                    Circle()
                        .fill(row.color)
                        .frame(width: 10, height: 10)

                    Text(row.label)
                        .font(.caption)
                        .foregroundStyle(theme.secondary)

                    Spacer()

                    Text("\(row.count)")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(theme.text)
                }
            }
        }
        .padding()
        .cardStyle()
    }

    
    // MARK: - Sleep

    private var sleepData: [(Date, Double)] {

        monthEntries.values.compactMap { entry in

            guard let date = Date.from(isoDate: entry.date),
                  let wake = entry.wakeupTime?.parseHHmm()
            else { return nil }

            guard let previousDate = Calendar.current.date(
                byAdding: .day,
                value: -1,
                to: date
            ) else { return nil }

            guard let previousEntry = entries.first(
                where: { $0.date == previousDate.isoDate }
            ),
            let bed = previousEntry.bedtime?.parseHHmm()
            else { return nil }

            let bedMinutes = bed.hour * 60 + bed.minute
            let wakeMinutes = wake.hour * 60 + wake.minute

            var total = wakeMinutes - bedMinutes

            if total < 0 {
                total += 24 * 60
            }

            return (
                date,
                Double(total) / 60.0
            )

        }
        .sorted { $0.0 < $1.0 }
    }

    private var sleepCard: some View {

        let values = sleepData.map(\.1)

        return VStack(alignment: .leading, spacing: 12) {

            Text("Hores de son")
                .font(.headline)

            if sleepData.count >= 2 {

                Chart {

                    ForEach(sleepData, id: \.0) { point in

                        LineMark(
                            x: .value("Data", point.0),
                            y: .value("Hores", point.1)
                        )

                        PointMark(
                            x: .value("Data", point.0),
                            y: .value("Hores", point.1)
                        )
                    }
                }
                .frame(height: 180)

            } else {

                ContentUnavailableView(
                    "No hi ha prou dades",
                    systemImage: "bed.double",
                    description: Text(
                        "Calen almenys dues nits amb hora d'anar a dormir i hora de llevar-se."
                    )
                )
            }

            if !values.isEmpty {

                HStack(spacing: 12) {

                    statBox(
                        title: "Nit del lloro",
                        value: String(format: "%.1fh", values.min() ?? 0),
                        color: .red
                    )

                    statBox(
                        title: "Mitjana",
                        value: String(
                            format: "%.1fh",
                            values.reduce(0,+) / Double(values.count)
                        ),
                        color: .orange
                    )

                    statBox(
                        title: "Dormilega",
                        value: String(format: "%.1fh", values.max() ?? 0),
                        color: .green
                    )
                }
            }
        }
        .padding()
        .cardStyle()
    }

    // MARK: - Pitells

    private var pitellsData: [(Date, Double)] {

        monthEntries.values.compactMap { entry in

            guard let date = Date.from(isoDate: entry.date)
            else { return nil }

            return (
                date,
                Double(entry.counter ?? 0)
            )

        }
        .sorted { $0.0 < $1.0 }
    }

    private var pitellsCard: some View {

        let counterColor =
            builtInVariables.first {
                $0.fieldKey == "counter"
            }?.displayColor(using: settings)
            ?? theme.accent
        let values = pitellsData.map(\.1)

        return VStack(alignment: .leading, spacing: 12) {

            Text(
                builtInVariables.first {
                    $0.fieldKey == "counter"
                }?.displayLabel(using: settings)
                ?? "Pitells"
            )
                .font(.headline)

            if pitellsData.count >= 2 {

                Chart {

                    ForEach(pitellsData, id: \.0) { point in

                        LineMark(
                            x: .value("Data", point.0),
                            y: .value("Pitells", point.1)
                        )
                        .foregroundStyle(counterColor)

                        PointMark(
                            x: .value("Data", point.0),
                            y: .value("Pitells", point.1)
                        )
                        .foregroundStyle(counterColor)
                    }
                }
                .frame(height: 180)

            } else {

                ContentUnavailableView(
                    "No hi ha prou dades",
                    systemImage: "chart.line.uptrend.xyaxis",
                    description: Text(
                        "Calen almenys dues entrades amb dades."
                    )
                )
            }

            if !values.isEmpty {

                HStack(spacing: 12) {

                    statBox(
                        title: "Buda",
                        value: "\(Int(values.min() ?? 0))",
                        color: .green
                    )

                    statBox(
                        title: "Mitjana",
                        value: String(
                            format: "%.1f",
                            values.reduce(0,+) / Double(values.count)
                        ),
                        color: .orange
                    )

                    statBox(
                        title: "Drama",
                        value: "\(Int(values.max() ?? 0))",
                        color: .red
                    )
                }
            }
        }
        .padding()
        .cardStyle()
    }

    private func customCounterData(
        _ variable: CustomVariable
    ) -> [(Date, Double)] {

        monthEntries.values.compactMap { entry in

            guard let date =
                Date.from(isoDate: entry.date)
            else {
                return nil
            }

            let value =
                entry.customValues[
                    variable.variableId
                ] ?? 0

            return (
                date,
                Double(value)
            )

        }
        .sorted { $0.0 < $1.0 }
    }
    
    private func customCounterCard(
        _ variable: CustomVariable
    ) -> some View {

        let data =
            customCounterData(variable)

        let values =
            data.map(\.1)

        return VStack(
            alignment: .leading,
            spacing: 12
        ) {

            Text(variable.label)
                .font(.headline)

            if data.count >= 2 {

                Chart {

                    ForEach(
                        data,
                        id: \.0
                    ) { point in

                        LineMark(
                            x: .value(
                                "Data",
                                point.0
                            ),
                            y: .value(
                                variable.label,
                                point.1
                            )
                        )
                        .foregroundStyle(
                            Color(
                                hex: variable.colorHex
                            )
                        )

                        PointMark(
                            x: .value(
                                "Data",
                                point.0
                            ),
                            y: .value(
                                variable.label,
                                point.1
                            )
                        )
                        .foregroundStyle(
                            Color(
                                hex: variable.colorHex
                            )
                        )
                    }
                }
                .frame(height: 180)

            } else {

                ContentUnavailableView(
                    "No hi ha prou dades",
                    systemImage: "chart.line.uptrend.xyaxis",
                    description: Text(
                        "Calen almenys dues entrades amb dades."
                    )
                )
            }

            if !values.isEmpty {

                HStack(spacing: 12) {

                    statBox(
                        title: "Mínim",
                        value: "\(Int(values.min() ?? 0)) \(variable.unit)",
                        color: .green
                    )

                    statBox(
                        title: "Mitjana",
                        value: String(
                            format: "%.1f %@",
                            values.reduce(0,+)
                            / Double(values.count),
                            variable.unit
                        ),
                        color: .orange
                    )

                    statBox(
                        title: "Màxim",
                        value: "\(Int(values.max() ?? 0)) \(variable.unit)",
                        color: .red
                    )
                }
            }
        }
        .padding()
        .cardStyle()
    }
    
    // MARK: - Stat Box

    private func statBox(
        title: String,
        value: String,
        color: Color
    ) -> some View {

        VStack(spacing: 6) {

            Text(title)
                .font(.caption)
                .foregroundStyle(color)

            Text(value)
                .font(.headline.bold())
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(color.opacity(0.12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(color.opacity(0.4))
        )
        .clipShape(
            RoundedRectangle(cornerRadius: 12)
        )
    }

    // MARK: - Calendar helpers

    private func daysInMonth() -> [Int] {
        let range = cal.range(of: .day, in: .month, for: displayMonth)!
        print(Array(range))
        return Array(range)
    }

    private func firstWeekdayOfMonth() -> Int {
        var c = DateComponents()
        c.year = year
        c.month = month
        c.day = 1

        let first = cal.date(from: c)!
        let weekday = cal.component(.weekday, from: first)

        return (weekday - cal.firstWeekday + 7) % 7
    }

    private func shiftMonth(_ delta: Int) {
        displayMonth = cal.date(byAdding: .month, value: delta, to: displayMonth)!
    }
}
