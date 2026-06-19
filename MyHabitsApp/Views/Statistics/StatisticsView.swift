import SwiftUI
import SwiftData
import Charts

struct StatisticsView: View {
    @Environment(\.appTheme) var theme
    @Query(sort: \DailyEntry.date, order: .reverse) private var entries: [DailyEntry]

    @State private var displayMonth = Date()
    @State private var selectedDayDate: Date?
    @State private var showEditor = false


    private var cal: Calendar { Calendar.current }
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
                    pitellsCard
                    legendView
                }
                .padding()
            }
            .background(theme.bg.ignoresSafeArea())
            .navigationTitle("Calendar")
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
        let f = DateFormatter()
        f.dateFormat = "MMMM yyyy"
        return f.string(from: displayMonth)
    }

    // MARK: - Calendar grid

    private var calendarGrid: some View {
        let days = daysInMonth()
        let firstWeekday = firstWeekdayOfMonth() // 0=Mon
        return LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7),
            spacing: 4
        ) {
            // Weekday headers
            ForEach(["Mo","Tu","We","Th","Fr","Sa","Su"], id: \.self) { d in
                Text(d).font(.caption2).foregroundStyle(theme.secondary).frame(maxWidth: .infinity)
            }
            // Empty leading cells
            ForEach(0..<firstWeekday, id: \.self) { _ in Color.clear.frame(height: 44) }
            // Day cells
            ForEach(days, id: \.self) { day in
                dayCell(day: day)
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
                    showEditor = true
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
        let active = builtInVariables.filter { e.isActive(field: $0.fieldKey) }
        return HStack(spacing: 2) {
            ForEach(active.prefix(4)) { v in
                Circle().fill(Color(hex: v.colorHex)).frame(width: 4, height: 4)
            }
        }
    }

    private func dominantColor(_ e: DailyEntry) -> Color? {
        // Green-ish if very active, neutral otherwise
        let count = builtInVariables.filter { e.isActive(field: $0.fieldKey) }.count
        if count >= 3 { return Color(hex: "#009988").opacity(0.7) }
        if count >= 1 { return Color(hex: "#0077BB").opacity(0.5) }
        return nil
    }

    // MARK: - Legend

    private var legendView: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
            ForEach(builtInVariables) { v in
                HStack(spacing: 6) {
                    Circle().fill(Color(hex: v.colorHex)).frame(width: 10, height: 10)
                    Text(v.label).font(.caption).foregroundStyle(theme.secondary)
                    Spacer()
                    let count = monthEntries.values.filter { $0.isActive(field: v.fieldKey) }.count
                    Text("\(count)").font(.caption.weight(.semibold)).foregroundStyle(theme.text)
                }
            }
        }
        .padding()
        .cardStyle()
    }

    
    // MARK: - Sleep

    private var sleepData: [(Date, Double)] {

        entries.compactMap { entry in
           
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

            return (date, Double(total) / 60.0)
        }
    }

    private var sleepCard: some View {

        let values = sleepData.map(\.1)

        return VStack(alignment: .leading, spacing: 12) {

            Text("Sleep Hours")
                .font(.headline)

            Chart {

                ForEach(sleepData, id: \.0) { point in

                    LineMark(
                        x: .value("Date", point.0),
                        y: .value("Hours", point.1)
                    )

                    PointMark(
                        x: .value("Date", point.0),
                        y: .value("Hours", point.1)
                    )
                }
            }
            .frame(height: 180)

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

        entries.compactMap { entry in

            guard let date = Date.from(isoDate: entry.date)
            else { return nil }

            return (
                date,
                Double(entry.counter ?? 0)
            )
        }
    }

    private var pitellsCard: some View {

        let values = pitellsData.map(\.1)

        return VStack(alignment: .leading, spacing: 12) {

            Text("Pitells")
                .font(.headline)

            Chart {

                ForEach(pitellsData, id: \.0) { point in

                    LineMark(
                        x: .value("Date", point.0),
                        y: .value("Pitells", point.1)
                    )

                    PointMark(
                        x: .value("Date", point.0),
                        y: .value("Pitells", point.1)
                    )
                }
            }
            .frame(height: 180)

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
        return Array(range)
    }

    private func firstWeekdayOfMonth() -> Int {
        var c = DateComponents(); c.year = year; c.month = month; c.day = 1
        let first = cal.date(from: c)!
        // Weekday: 1=Sun … 7=Sat → convert to 0=Mon … 6=Sun
        let raw = cal.component(.weekday, from: first)
        return (raw + 5) % 7   // 0=Monday
    }

    private func shiftMonth(_ delta: Int) {
        displayMonth = cal.date(byAdding: .month, value: delta, to: displayMonth)!
    }
}
