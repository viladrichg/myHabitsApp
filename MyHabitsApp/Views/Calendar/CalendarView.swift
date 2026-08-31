import SwiftUI
import SwiftData
import Charts

struct CalendarView: View {
    @Environment(\.appTheme) var theme
    @Query(sort: \DailyEntry.date, order: .reverse) private var entries: [DailyEntry]
    @Query(sort: \CustomVariable.order)
    private var customVariables: [CustomVariable]
    @Query(sort: \AppSettings.createdAt)
    private var allSettings: [AppSettings]

    private var settings: AppSettings? {
        allSettings.first
    }
    
    enum SleepMetric: String, CaseIterable {
        case hours = "Hores"
        case quality = "Qualitat"
    }

    @State private var sleepMetric: SleepMetric = .hours
    
    @State private var calendarMode: CalendarMode = .month
    @State private var displayMonth = Date()
    @State private var selectedExpandedChart: ExpandedChart?
    private struct ExpandedChart: Identifiable {

        let id = UUID()

        let title: String

        let data: [(Date, Double)]

        let color: Color

        let unit: String
    }
    
    enum CalendarMode: String, CaseIterable {
        case month = "Mensual"
        case year = "Anual"
    }

    private struct SelectedDay: Identifiable {
        let id = UUID()
        let date: Date
    }

    @State private var selectedDay: SelectedDay?
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

    private var entriesByDate: [String: DailyEntry] {
        Dictionary(
            uniqueKeysWithValues:
                entries.map {
                    ($0.date, $0)
                }
        )
    }
    
    //MARK: body
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    if calendarMode == .month {
                        monthNavigator
                    }else {
                        yearNavigator
                    }
                    
                    Picker("", selection: $calendarMode) {
                        ForEach(CalendarMode.allCases, id: \.self) {
                            Text($0.rawValue)
                                .tag($0)
                        }
                    }
                    .pickerStyle(.segmented)
                    
                    if calendarMode == .month {
                        calendarGrid
                    } else {
                        yearCalendarView
                            .padding(.horizontal, -6)
                    }
                    
                    if calendarMode == .month {

                        sleepCard

                        if !(builtInVariables.first {
                            $0.fieldKey == "counter"
                        }?.isHidden(using: settings) ?? false) {

                            pitellsCard
                        }

                        ForEach(
                            customVariables.filter {
                                !$0.isHidden &&
                                ($0.type == "counter" || $0.type == "rating")
                            }
                        ) { variable in

                            customCounterCard(variable)
                        }

                        legendView
                    }
                }
                .padding()
            }
            .background(theme.bg.ignoresSafeArea())
            .navigationTitle("Calendari")
            .sheet(item: $selectedDay) { day in

                DataEntryView(
                    selectedTab: .constant(1),
                    initialDate: day.date
                )
            }

        }.sheet(item: $selectedExpandedChart) { chart in
            
            ExpandedChartView(
                content: .line(
                    title: chart.title,
                    points: chart.data,
                    color: chart.color,
                    unit: chart.unit
                ),
                lineChartStyle: settings?.lineChartStyle ?? "line"
            )
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
    
    private var yearNavigator: some View {
        HStack {

            Button {
                displayMonth =
                    cal.date(
                        byAdding: .year,
                        value: -1,
                        to: displayMonth
                    )!
            } label: {
                Image(systemName: "chevron.left")
            }

            Spacer()

            Text(String(year))
                .font(.headline)

            Spacer()

            Button {
                displayMonth =
                    cal.date(
                        byAdding: .year,
                        value: 1,
                        to: displayMonth
                    )!
            } label: {
                Image(systemName: "chevron.right")
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

        let cells =
            Array(repeating: 0, count: offset)
            + days

        return LazyVGrid(
            columns: Array(repeating: GridItem(.flexible()), count: 7),
            spacing: 4
        ) {

            ForEach(["Dl","Dt","Dc","Dj","Dv","Ds","Dg"], id: \.self) {
                Text($0)
                    .frame(maxWidth: .infinity)
                    .padding(.bottom, 8)
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

                    selectedDay = SelectedDay(date: d)

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

        let useHiddenVariables =
            settings?.showHiddenVariablesInCalendar ?? false

        let builtInActive =
            builtInVariables
                .filter {
                    $0.type == "boolean"
                }
                .filter {
                    useHiddenVariables ||
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
                    useHiddenVariables ||
                    !$0.isHidden
                }
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

        let useHiddenVariables =
            settings?.showHiddenVariablesInCalendar ?? false

        let negative1Visible =
            useHiddenVariables
            ||
            !(builtInVariables.first {
                $0.fieldKey == "negative1"
            }?.isHidden(using: settings) ?? false)

        let negative2Visible =
            useHiddenVariables
            ||
            !(builtInVariables.first {
                $0.fieldKey == "negative2"
            }?.isHidden(using: settings) ?? false)

        let habit1Visible =
            useHiddenVariables
            ||
            !(builtInVariables.first {
                $0.fieldKey == "habit1"
            }?.isHidden(using: settings) ?? false)

        let habit2Visible =
            useHiddenVariables
            ||
            !(builtInVariables.first {
                $0.fieldKey == "habit2"
            }?.isHidden(using: settings) ?? false)

        let positive1Visible =
            useHiddenVariables
            ||
            !(builtInVariables.first {
                $0.fieldKey == "positive1"
            }?.isHidden(using: settings) ?? false)

        let positive2Visible =
            useHiddenVariables
            ||
            !(builtInVariables.first {
                $0.fieldKey == "positive2"
            }?.isHidden(using: settings) ?? false)

        let positive3Visible =
            useHiddenVariables
            ||
            !(builtInVariables.first {
                $0.fieldKey == "positive3"
            }?.isHidden(using: settings) ?? false)

        let positive4Visible =
            useHiddenVariables
            ||
            !(builtInVariables.first {
                $0.fieldKey == "positive4"
            }?.isHidden(using: settings) ?? false)

        let sportsVisible =
            useHiddenVariables
            ||
            !(builtInVariables.first {
                $0.fieldKey == "sports"
            }?.isHidden(using: settings) ?? false)

        // MARK: Negatives

        if negative1Visible && e.negative1 {

            return builtInVariables.first {
                $0.fieldKey == "negative1"
            }?.displayColor(using: settings)
        }

        if negative2Visible && e.negative2 {

            return builtInVariables.first {
                $0.fieldKey == "negative2"
            }?.displayColor(using: settings)
        }

        // MARK: Dia perfecte

        let activityCount =
            [
                habit1Visible && e.habit1,
                habit2Visible && e.habit2,
                positive1Visible && e.positive1,
                positive2Visible && e.positive2,
                positive3Visible && e.positive3,
                positive4Visible && e.positive4,
                sportsVisible && !e.sports.isEmpty
            ]
            .filter { $0 }
            .count

        if settings?.perfectDayEnabled == true &&
           activityCount >= (
                settings?.perfectDayThreshold ?? 3
           ) {

            return Color(
                hex: settings?.perfectDayColorHex
                ?? "#22c55e"
            )
        }

        // MARK: Variables integrades

        if habit1Visible && e.habit1 {

            return builtInVariables.first {
                $0.fieldKey == "habit1"
            }?.displayColor(using: settings)
        }

        if habit2Visible && e.habit2 {

            return builtInVariables.first {
                $0.fieldKey == "habit2"
            }?.displayColor(using: settings)
        }

        if positive1Visible && e.positive1 {

            return builtInVariables.first {
                $0.fieldKey == "positive1"
            }?.displayColor(using: settings)
        }

        if positive2Visible && e.positive2 {

            return builtInVariables.first {
                $0.fieldKey == "positive2"
            }?.displayColor(using: settings)
        }

        if positive3Visible && e.positive3 {

            return builtInVariables.first {
                $0.fieldKey == "positive3"
            }?.displayColor(using: settings)
        }

        if positive4Visible && e.positive4 {

            return builtInVariables.first {
                $0.fieldKey == "positive4"
            }?.displayColor(using: settings)
        }

        if sportsVisible && !e.sports.isEmpty {

            return builtInVariables.first {
                $0.fieldKey == "sports"
            }?.displayColor(using: settings)
        }
        
        // MARK: Variables personalitzades

        let visibleCustomVariables =
            customVariables
                .filter {
                    useHiddenVariables || !$0.isHidden
                }
                .sorted {
                    $0.order < $1.order
                }

        for variable in visibleCustomVariables {

            let value =
                e.customValues[
                    variable.variableId
                ] ?? 0

            if value > 0 {

                return Color(
                    hex: variable.colorHex
                )
            }
        }

        return nil
    }

    // MARK: - Legend

    private var legendView: some View {

        let builtInRows =
            builtInVariables
                .filter {
                    $0.type == "boolean"
                }
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

        
        let useHiddenVariables =
            settings?.showHiddenVariablesInCalendar ?? false

        let customRows =
            customVariables
                .filter {
                    $0.type == "boolean"
                }
                .filter {
                    useHiddenVariables || !$0.isHidden
                }
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

    private var sleepQualityData: [(Date, Double)] {
        monthEntries.values
            .filter { !$0.isEmpty }
            .compactMap { entry in

                guard let date = Date.from(isoDate: entry.date),
                      let quality = entry.sleepQuality
                else { return nil }

                return (
                    date,
                    Double(quality)
                )
            }
            .sorted { $0.0 < $1.0 }
    }
    
    private var allSleepQualityData: [(Date, Double)] {

        entries
            .filter { !$0.isEmpty }
            .compactMap { entry in

                guard let date = Date.from(isoDate: entry.date),
                      let quality = entry.sleepQuality
                else { return nil }

                return (
                    date,
                    Double(quality)
                )
            }
            .sorted { $0.0 < $1.0 }
    }
    
    private var sleepData: [(Date, Double)] {

        monthEntries.values
            .filter { !$0.isEmpty }
            .compactMap { entry in

            guard let date = Date.from(isoDate: entry.date),
                  let wake = entry.sleepEnd?.parseHHmm()
            else { return nil }

            guard let previousDate = Calendar.current.date(
                byAdding: .day,
                value: -1,
                to: date
            ) else { return nil }

            guard let previousEntry = entries.first(
                where: { $0.date == previousDate.isoDate }
            ),
            let bed = previousEntry.sleepStart?.parseHHmm()
            else { return nil }

            let bedMinutes = bed.hour * 60 + bed.minute
            let wakeMinutes = wake.hour * 60 + wake.minute

            func sleepDuration(
                bed: Int,
                wake: Int
            ) -> Int {

                var duration = wake - bed

                if duration < 0 {
                    duration += 24 * 60
                }

                return duration
            }

            let normalDuration = sleepDuration(
                bed: bedMinutes,
                wake: wakeMinutes
            )

            let swappedDuration = sleepDuration(
                bed: wakeMinutes,
                wake: bedMinutes
            )

            let total: Int

            if normalDuration > 14 * 60 &&
               swappedDuration >= 3 * 60 &&
               swappedDuration <= 14 * 60 {

                total = swappedDuration

            } else {

                total = normalDuration
            }

            return (
                date,
                Double(total) / 60.0
            )

        }
        .sorted { $0.0 < $1.0 }
    }

    private var allSleepData: [(Date, Double)] {

        entries
            .filter { !$0.isEmpty }
            .compactMap { entry in

                guard let date = Date.from(isoDate: entry.date),
                      let wake = entry.sleepEnd?.parseHHmm()
                else { return nil }

                guard let previousDate = Calendar.current.date(
                    byAdding: .day,
                    value: -1,
                    to: date
                ) else { return nil }

                guard let previousEntry =
                    entriesByDate[previousDate.isoDate],
                let bed = previousEntry.sleepStart?.parseHHmm()
                else { return nil }

                let bedMinutes = bed.hour * 60 + bed.minute
                let wakeMinutes = wake.hour * 60 + wake.minute

                func sleepDuration(
                    bed: Int,
                    wake: Int
                ) -> Int {

                    var duration = wake - bed

                    if duration < 0 {
                        duration += 24 * 60
                    }

                    return duration
                }

                let normalDuration = sleepDuration(
                    bed: bedMinutes,
                    wake: wakeMinutes
                )

                let swappedDuration = sleepDuration(
                    bed: wakeMinutes,
                    wake: bedMinutes
                )

                let total: Int

                if normalDuration > 14 * 60 &&
                   swappedDuration >= 3 * 60 &&
                   swappedDuration <= 14 * 60 {

                    total = swappedDuration

                } else {

                    total = normalDuration
                }

                print(
                    "Sleep:",
                    previousEntry.date,
                    previousEntry.sleepStart ?? "-",
                    entry.date,
                    entry.sleepEnd ?? "-"
                )
                return (
                    date,
                    Double(total) / 60.0
                )
            }
            .sorted { $0.0 < $1.0 }
    }
    
    //MARK: SLEEP CARD
    
    private var sleepCard: some View {

        let data =
            sleepMetric == .hours
            ? sleepData
            : sleepQualityData

        let values = data.map(\.1)

        return VStack(alignment: .leading, spacing: 12) {

            Text("Son")
                .font(.headline)

            Picker("", selection: $sleepMetric) {
                Text("Hores de son")
                    .tag(SleepMetric.hours)

                Text("Qualitat")
                    .tag(SleepMetric.quality)
            }
            .pickerStyle(.segmented)
            .padding(.bottom, 16)

            if data.count >= 2 {

                Chart {

                    ForEach(data, id: \.0) { point in

                        if settings?.lineChartStyle == "bar" {

                            BarMark(
                                x: .value("Data", point.0),
                                y: .value("Hores", point.1)
                            )
                            .foregroundStyle(theme.accent)

                        } else {

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
                }
                .frame(height: 180)
                .onTapGesture {

                    if sleepMetric == .hours {

                        selectedExpandedChart = ExpandedChart(
                            title: "Hores de son",
                            data: allSleepData,
                            color: theme.accent,
                            unit: "h"
                        )

                    } else {

                        selectedExpandedChart = ExpandedChart(
                            title: "Qualitat del son",
                            data: allSleepQualityData,
                            color: theme.accent,
                            unit: ""
                        )

                    }
                }

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
                
                let lowTitle =
                    sleepMetric == .hours
                    ? "Nit del lloro"
                    : "Pitjor"
                
                let highTitle =
                    sleepMetric == .hours
                    ? "Dormilega"
                    : "Millor"
                
                let unit =
                    sleepMetric == .hours
                    ? "h"
                    : ""
                
                HStack(spacing: 12) {
                    
                    statBox(
                        title: lowTitle,
                        value: String(
                            format: unit.isEmpty ? "%.0f" : "%.1f%@",
                            values.min() ?? 0,
                            unit
                        ),
                        color: .red
                    )
                    
                    statBox(
                        title: "Mitjana",
                        value: String(
                            format: unit.isEmpty ? "%.1f" : "%.1f%@",
                            values.reduce(0,+) / Double(values.count),
                            unit
                        ),
                        color: .orange
                    )
                    
                    statBox(
                        title: highTitle,
                        value: String(
                            format: unit.isEmpty ? "%.0f" : "%.1f%@",
                            values.max() ?? 0,
                            unit
                        ),
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

        monthEntries.values
            .filter { !$0.isEmpty }
            .compactMap { entry in

            guard let date = Date.from(isoDate: entry.date)
                    
            else { return nil }

            
                guard let counter = entry.counter else {
                    return nil
                }

                return (
                    date,
                    Double(counter)
                )

        }
        .sorted { $0.0 < $1.0 }
    }
    
    private var allPitellsData: [(Date, Double)] {

        entries
            .filter { !$0.isEmpty }
            .compactMap { entry in

                guard let date = Date.from(isoDate: entry.date)
                else { return nil }

                guard let counter = entry.counter
                else { return nil }

                return (
                    date,
                    Double(counter)
                )
            }
            .sorted { $0.0 < $1.0 }
    }

    //MARK: pitells CARD
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

                        if settings?.lineChartStyle == "bar" {

                            BarMark(
                                x: .value("Data", point.0),
                                y: .value("Pitells", point.1)
                            )
                            .foregroundStyle(counterColor)

                        } else {

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
                }
                .frame(height: 180)
                .onTapGesture {

                    selectedExpandedChart = ExpandedChart(
                        title: builtInVariables.first {
                            $0.fieldKey == "counter"
                        }?.displayLabel(using: settings)
                        ?? "Pitells",
                        data: allPitellsData,
                        color: counterColor,
                        unit: ""
                    )
                }
                
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

    // MARK: CUSTOMDATA
    
    private func customCounterData(
        _ variable: CustomVariable
    ) -> [(Date, Double)] {

        monthEntries.values
            .filter { !$0.isEmpty }
            .compactMap { entry in

            guard let date =
                Date.from(isoDate: entry.date)
            else {
                return nil
            }

            let value =
                entry.customValues[
                    variable.variableId
                ] ?? 0

            if variable.ignoreZerosInStats &&
                value == 0 {

                return nil
            }

            return (
                date,
                Double(value)
            )
        }
        .sorted { $0.0 < $1.0 }
    }
    
    private func allCustomCounterData(
        _ variable: CustomVariable
    ) -> [(Date, Double)] {

        entries
            .filter { !$0.isEmpty }
            .compactMap { entry in

            guard let date =
                Date.from(isoDate: entry.date)
            else {
                return nil
            }

            let value =
                entry.customValues[
                    variable.variableId
                ] ?? 0

            if variable.ignoreZerosInStats &&
                value == 0 {

                return nil
            }

            return (
                date,
                Double(value)
            )
        }
        .sorted { $0.0 < $1.0 }
    }

    //MARK: GRAFICS VARIABLES PERSONALITZADES
    
    private func customCounterCard(
        _ variable: CustomVariable
    ) -> some View {

        let data =
            customCounterData(variable)

        let values =
            data.map(\.1)

        let statisticValues =
            variable.ignoreZerosInStats
            ? values.filter { $0 > 0 }
            : values

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

                        if settings?.lineChartStyle == "bar" {

                            BarMark(
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

                        } else {

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
                }
                
                .frame(height: 180)
                .onTapGesture {

                    selectedExpandedChart = ExpandedChart(
                        title: variable.label,
                        data: allCustomCounterData(variable),
                        color: Color(hex: variable.colorHex),
                        unit: variable.unit
                    )
                }
                
            } else {

                ContentUnavailableView(
                    "No hi ha prou dades",
                    systemImage: "chart.line.uptrend.xyaxis",
                    description: Text(
                        "Calen almenys dues entrades amb dades."
                    )
                )
            }

            if !statisticValues.isEmpty {

                HStack(spacing: 12) {

                    statBox(
                        title: "Mínim",
                        value: "\(Int(statisticValues.min() ?? 0)) \(variable.unit)",
                        color: .green
                    )

                    statBox(
                        title: "Mitjana",
                        value: String(
                            format: "%.1f %@",
                            statisticValues.reduce(0,+)
                            / Double(statisticValues.count),
                            variable.unit
                        ),
                        color: .orange
                    )

                    statBox(
                        title: "Màxim",
                        value: "\(Int(statisticValues.max() ?? 0)) \(variable.unit)",
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


    private var yearCalendarView: some View {

        LazyVGrid(
            columns: Array(
                repeating: GridItem(
                    .flexible(),
                    spacing: 0
                ),
                count: 3
            ),
            spacing: 15
        ) {

            ForEach(1...12, id: \.self) { month in

                Button {

                    var comps = DateComponents()

                    comps.year = year
                    comps.month = month
                    comps.day = 1

                    if let date = cal.date(from: comps) {

                        displayMonth = date
                        calendarMode = .month
                    }

                } label: {

                    VStack {

                        Text(monthName(month))
                            .font(.caption.bold())

                        let date = monthDate(for: month)

                        let days = daysInMonth(for: date)

                        let offset = firstWeekdayOfMonth(for: date)

                        let baseCells =
                            Array(repeating: 0, count: offset)
                            + days

                        let cells =
                            baseCells
                            + Array(
                                repeating: 0,
                                count: max(
                                    0,
                                    42 - baseCells.count
                                )
                            )

                        LazyVGrid(
                            columns: Array(
                                repeating: GridItem(
                                    .flexible(),
                                    spacing: 1.5
                                ),
                                count: 7
                            ),
                            spacing: 5
                        ) {

                            ForEach(
                                Array(cells.enumerated()),
                                id: \.offset
                            ) { _, value in

                                if value == 0 {

                                    Color.clear
                                        .frame(height: 10)

                                } else {

                                    RoundedRectangle(
                                        cornerRadius: 2
                                    )
                                    .fill(
                                        colorForDay(
                                            day: value,
                                            month: month
                                        )
                                    )
                                    .frame(height: 10)
                                }
                            }
                        }
                    }
                    .padding(1)
                    .cardStyle()
                }
                .buttonStyle(.plain)
            }
        }
    }
    
    private func colorForDay(
        day: Int,
        month: Int
    ) -> Color {

        let dateString =
            String(
                format: "%04d-%02d-%02d",
                year,
                month,
                day
            )

        guard let entry = entriesByDate[dateString] else {
            return theme.border.opacity(0.25)
        }
        
        return dominantColor(entry)
        ?? theme.border.opacity(0.25)
    }
    
    private func monthName(_ month: Int) -> String {

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

        return months[month - 1]
    }
    
    
    // MARK: - Calendar helpers

    private func monthDate(for month: Int) -> Date {

        var comps = DateComponents()

        comps.year = year
        comps.month = month
        comps.day = 1

        return cal.date(from: comps)!
    }

    private func daysInMonth(for date: Date) -> [Int] {

        let range = cal.range(
            of: .day,
            in: .month,
            for: date
        )!

        return Array(range)
    }

    private func firstWeekdayOfMonth(
        for date: Date
    ) -> Int {

        let weekday = cal.component(
            .weekday,
            from: date
        )

        return (weekday - cal.firstWeekday + 7) % 7
    }
    
    private func daysInMonth() -> [Int] {
        let range = cal.range(of: .day, in: .month, for: displayMonth)!
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
