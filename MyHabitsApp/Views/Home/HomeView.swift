import SwiftUI
import SwiftData

struct HomeView: View {
    @Environment(\.appTheme) var theme
    @Environment(\.modelContext) private var ctx
    @Query(sort: \DailyEntry.date, order: .reverse) private var entries: [DailyEntry]

    private var todayEntry: DailyEntry? {
        entries.first(where: { $0.date == Date().isoDate })
    }

    private var last30: [DailyEntry] {
        let cutoff = Calendar.current.date(byAdding: .day, value: -30, to: Date())!.isoDate
        return entries.filter { $0.date >= cutoff }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Greeting
                    greetingSection

                    // Today's summary
                    todaySummarySection

                    // 30-day overview
                    overviewSection
                }
                .padding()
            }
            .background(theme.bg.ignoresSafeArea())
            .navigationTitle("Inici")
            .navigationBarTitleDisplayMode(.large)
        }
    }

    // MARK: - Sections

    private var greetingSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(greetingText)
                .font(.title2.weight(.semibold))
                .foregroundStyle(theme.text)
            Text(Date().formatted(date: .complete, time: .omitted))
                .font(.subheadline)
                .foregroundStyle(theme.secondary)
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

    private var overviewSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Últims 30 dies (\(last30.count) entrades)")
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ForEach(builtInVariables.prefix(6)) { v in
                    let count = last30.filter { $0.isActive(field: v.fieldKey) }.count
                    miniStatCell(label: v.label, count: count, total: last30.count, color: Color(hex: v.colorHex))
                }
            }
        }
    }

    // MARK: - Helpers

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
        return e.bedtime != nil ? e.bedtime! : "–"
    }

    private func workText(_ e: DailyEntry) -> String {

        if e.workedAtJob && e.workedAtHome {
            return "Feina + Casa"
        }

        if e.workedAtJob {
            return "Casa"
        }

        if e.workedAtHome {
            return "Feina"
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
