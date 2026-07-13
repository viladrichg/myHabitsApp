import SwiftUI
import SwiftData

struct HomeView: View {
    @Environment(\.appTheme) var theme
    @Environment(\.modelContext) private var ctx
    @Query(sort: \DailyEntry.date, order: .reverse) private var entries: [DailyEntry]
    @Query(sort: \AppSettings.createdAt)
    private var allSettings: [AppSettings]
    @Query(sort: \CustomVariable.order)
    private var customVariables: [CustomVariable]
    @State private var showSportsList = false

    private var settings: AppSettings? {
        allSettings.first
    }

    private var todayEntry: DailyEntry? {
        entries.first(where: { $0.date == Date().isoDate })
    }

    private var last30: [DailyEntry] {
        let cutoff = Calendar.current.date(
            byAdding: .day,
            value: -30,
            to: Date()
        )!.isoDate

        return entries.filter {
            $0.date >= cutoff
        }
    }

    private var currentStreak: Int {

        let dates = Set(entries.map(\.date))

        var streak = 0
        var current = Date()

        while dates.contains(current.isoDate) {

            streak += 1

            guard let previous = Calendar.current.date(
                byAdding: .day,
                value: -1,
                to: current
            ) else {
                break
            }

            current = previous
        }

        return streak
    }

    private var bestStreak: Int {

        let sorted =
            entries.compactMap {
                Date.from(isoDate: $0.date)
            }
            .sorted()

        guard !sorted.isEmpty else {
            return 0
        }

        var best = 1
        var current = 1

        for i in 1..<sorted.count {

            let diff =
                Calendar.current.dateComponents(
                    [.day],
                    from: sorted[i - 1],
                    to: sorted[i]
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


    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    greetingSection

                    streakSection
                    
                    sportsSection

                    habitsStreakSection
                    
                    todaySummarySection

                    overviewSection
                }
                .padding()
            }
            .background(theme.bg.ignoresSafeArea())
            .navigationTitle("Inici")
            .navigationBarTitleDisplayMode(.large)
            .sheet(isPresented: $showSportsList) {

                SportsListView()
            }
        }
    }

    // MARK: - Sections

    private var greetingSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(greetingText)
                .font(.title2.weight(.semibold))
                .foregroundStyle(theme.text)
            Text(catalanDate)
                .font(.subheadline)
                .foregroundStyle(theme.secondary)
        }
    }

    private var streakSection: some View {

        HStack(spacing: 12) {

            statCell(
                label: "Ratxa actual",
                value: "🔥 \(currentStreak)"
            )

            statCell(
                label: "Millor ratxa",
                value: "🏆 \(bestStreak)"
            )
        }
    }
    
    private var sportsSection: some View {

        VStack(alignment: .leading, spacing: 12) {

            sectionHeader("🔥 Esports")

            VStack(spacing: 10) {

                ForEach(
                    Array(topSports.prefix(3).enumerated()),
                    id: \.element.name
                ) { index, sport in

                    HStack {

                        if index == 0 {

                            Text("🥇")

                        } else if index == 1 {

                            Text("🥈")

                        } else {

                            Text("🥉")
                        }

                        Text(sport.name)

                        Spacer()

                        Text("\(sport.count)")
                            .foregroundStyle(theme.secondary)
                    }
                }

                Button {

                    showSportsList = true

                } label: {

                    HStack {

                        Text("Veure tots els esports")

                        Spacer()

                        Image(systemName: "chevron.right")
                    }
                }
                .padding(.top, 4)
            }
            .padding()
            .cardStyle()
        }
    }
    
    private var todaySummarySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Avui")
            if let e = todayEntry {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    statCell(label: "Hores dormides", value: sleepText(e))
                    statCell(label: "Treballat",  value: workText(e))
                    statCell(label: "Activitats", value: activitiesText(e))
                    statCell(label: "Esports", value: sportsText(e))
                }
            } else {
                Text("Avui no hi ha dades. Fes clic a 'Avui' per afegir-ne.")
                    .font(.subheadline)
                    .foregroundStyle(theme.secondary)
                    .padding()
                    .frame(maxWidth: .infinity)
                    .cardStyle()
            }
        }
    }
    
    private var habitsStreakSection: some View {

        VStack(alignment: .leading, spacing: 12) {

            sectionHeader("🔥 Ratxes")

            VStack(spacing: 10) {

                ForEach(
                    Array(habitStreaks.prefix(5).enumerated()),
                    id: \.offset
                ) { _, item in

                    HStack {

                        Text(item.label)

                        Spacer()

                        Text("🔥 \(item.streak)")
                            .foregroundStyle(theme.accent)
                    }
                }
            }
            .padding()
            .cardStyle()
        }
    }
    private var overviewSection: some View {

        let visibleBuiltIns =
            builtInVariables
                .filter {
                    !($0.isHidden(using: settings))
                }

        return VStack(
            alignment: .leading,
            spacing: 12
        ) {

            sectionHeader(
                "Últims 30 dies (\(last30.count) entrades)"
            )

            LazyVGrid(
                columns: [
                    GridItem(.flexible()),
                    GridItem(.flexible()),
                    GridItem(.flexible())
                ],
                spacing: 10
            ) {

                ForEach(
                    visibleBuiltIns.prefix(6)
                ) { v in

                    let count =
                        last30.filter {
                            $0.isActive(
                                field: v.fieldKey
                            )
                        }.count

                    miniStatCell(
                        label: v.displayLabel(
                            using: settings
                        ),
                        count: count,
                        total: last30.count,
                        color: v.displayColor(
                            using: settings
                        )
                    )
                }
            }
        }
    }
    
    private var catalanDate: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ca_ES")
        formatter.dateStyle = .long

        return formatter.string(from: Date())
    }
    
    private var topSports: [(name: String, count: Int)] {

        var counts: [String:Int] = [:]

        for entry in entries {

            for sport in entry.sports {

                let parts = sport
                    .split(separator: ",")
                    .map {
                        $0.trimmingCharacters(
                            in: .whitespacesAndNewlines
                        )
                    }

                for part in parts where !part.isEmpty {

                    counts[part, default: 0] += 1
                }
            }
        }

        return counts
            .map { (name: $0.key, count: $0.value) }
            .sorted { $0.count > $1.count }
    }
    
    // MARK: - Helpers

    private var habitStreaks: [(label: String, streak: Int)] {

        var result: [(label: String, streak: Int)] = []

        let builtIns =
            builtInVariables.filter {
                $0.type == "boolean"
                &&
                !$0.isHidden(using: settings)
            }

        for variable in builtIns {

            result.append((
                label: variable.displayLabel(using: settings),
                streak: streakForField(variable.fieldKey)
            ))
        }

        for variable in customVariables
            .filter({ $0.type == "boolean" }) {

            result.append((
                label: variable.label,
                streak: streakForField(variable.variableId)
            ))
        }

        return result
            .filter { $0.streak > 0 }
            .sorted { $0.streak > $1.streak }
    }
    
    private func streakForField(
        _ field: String
    ) -> Int {

        let activeDates =
            Set(
                entries
                    .filter {
                        $0.isActive(field: field)
                    }
                    .map(\.date)
            )

        var streak = 0
        var current = Date()

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
    private var greetingText: String {
        let h = Calendar.current.component(.hour, from: Date())
        switch h {
        case 5..<12: return "Bon dia"
        case 12..<18: return "Bona tarda"
        default: return "Bona nit"
        }
    }

    private func sleepText(_ e: DailyEntry) -> String {
        if let h = e.sleepHours { return String(format: "%.1f h", h) }
        return e.bedTime != nil ? e.bedTime! : "–"
    }

    private func workText(
        _ e: DailyEntry
    ) -> String {

        let workLabel =
            builtInVariables.first {
                $0.fieldKey == "workedAtJob"
            }?.displayLabel(
                using: settings
            ) ?? "Feina"

        let homeLabel =
            builtInVariables.first {
                $0.fieldKey == "workedAtHome"
            }?.displayLabel(
                using: settings
            ) ?? "Casa"

        if e.workedAtJob && e.workedAtHome {
            return "\(workLabel) + \(homeLabel)"
        }

        if e.workedAtJob {
            return workLabel
        }

        if e.workedAtHome {
            return homeLabel
        }

        return "-"
    }

    private func activitiesText(_ e: DailyEntry) -> String {
        let active = [e.meditation, e.yoga, e.dibuix, e.llegir].filter { $0 }.count
        return "\(active)/4"
    }
    
    private func sportsText(_ e: DailyEntry) -> String {

        let s = e.sports

        return s.isEmpty
            ? "-"
            : s.prefix(2).joined(separator: ", ")
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.headline)
            .foregroundStyle(theme.text)
    }

    private func statCell(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption).foregroundStyle(theme.secondary)
            Text(value).font(.body.weight(.medium)).foregroundStyle(theme.text)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle()
    }

    private func miniStatCell(label: String, count: Int, total: Int, color: Color) -> some View {
        VStack(spacing: 4) {
            Text("\(count)")
                .font(.title2.weight(.bold))
                .foregroundStyle(color)
            Text(label)
                .font(.caption2)
                .foregroundStyle(theme.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            if total > 0 {
                ProgressView(value: Double(count), total: Double(total))
                    .tint(color)
                    .scaleEffect(y: 0.7)
            }
        }
        .padding(10)
        .cardStyle()
    }
}
