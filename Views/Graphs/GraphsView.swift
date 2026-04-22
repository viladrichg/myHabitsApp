import SwiftUI
import SwiftData
import Charts

struct GraphsView: View {
    @Environment(\.appTheme) var theme
    @Query(sort: \DailyEntry.date, order: .reverse) private var entries: [DailyEntry]
    @Query(sort: \AppSettings.createdAt) private var allSettings: [AppSettings]
    @Query(sort: \CustomVariable.order) private var customVariables: [CustomVariable]

    private var settings: AppSettings? { allSettings.first }

    @State private var selectedField = "meditation"
    @State private var chartType: ChartType = .accumulated

    enum ChartType: String, CaseIterable {
        case accumulated = "Accumulated"
        case monthly     = "Monthly"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    // 1. Summary
                    SummaryCard(
                        entries: filteredEntries,
                        customVariables: customVariables
                    )

                    // 2. Trend / Ritme
                    TrendCard(
                        entries: filteredEntries,
                        selectedField: $selectedField,
                        timeframe: settings?.chartTimeframe ?? "month"
                    )

                    // 3. Multi-series chart
                    chartTypePickerView
                    MultiSeriesChartCard(
                        entries: filteredEntries,
                        chartType: chartType,
                        customVariables: customVariables
                    )
                }
                .padding()
            }
            .background(theme.bg.ignoresSafeArea())
            .navigationTitle("Graphs")
            .toolbar { timeframeToolbar }
        }
    }

    // MARK: - Filtered entries for current timeframe

    private var filteredEntries: [DailyEntry] {
        let dates = TrendCalculator.dates(for: settings?.chartTimeframe ?? "month")
        guard let start = dates.first, let end = dates.last else { return [] }
        let s = start.isoDate; let e = end.isoDate
        return entries.filter { $0.date >= s && $0.date <= e }
    }

    private var chartTypePickerView: some View {
        Picker("Chart Type", selection: $chartType) {
            ForEach(ChartType.allCases, id: \.self) { Text($0.rawValue).tag($0) }
        }
        .pickerStyle(.segmented)
        .padding(.horizontal)
    }

    @ToolbarContentBuilder
    private var timeframeToolbar: some ToolbarContent {
        ToolbarItem(placement: .navigationBarTrailing) {
            if let s = settings {
                Menu {
                    ForEach(["week","15days","month","3months","6months","year","all"], id: \.self) { tf in
                        Button(timeframeLabel(tf)) { s.chartTimeframe = tf }
                    }
                } label: {
                    Label(timeframeLabel(s.chartTimeframe), systemImage: "calendar.badge.clock")
                        .font(.caption)
                }
            }
        }
    }

    private func timeframeLabel(_ tf: String) -> String {
        switch tf {
        case "week":     return "1 week"
        case "15days":   return "15 days"
        case "month":    return "1 month"
        case "3months":  return "3 months"
        case "6months":  return "6 months"
        case "year":     return "1 year"
        default:         return "All time"
        }
    }
}