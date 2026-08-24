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
    @State private var expandedMultiSeries: ExpandedMultiSeries?

    enum ChartType: String, CaseIterable {
        case accumulated = "Acumulat"
        case monthly     = "Mensual"
    }

    private struct ExpandedMultiSeries: Identifiable {

        let id = UUID()

        let series: [
            (
                field: String,
                label: String,
                color: Color,
                points: [(Date, Double)]
            )
        ]
    }


    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {

                    SummaryCard(
                        entries: filteredEntries,
                        customVariables: customVariables
                    )

                    MultiSeriesChartCard(
                        entries: entries,
                        chartType: $chartType,
                        customVariables: customVariables,
                        onOpenFullscreen: { series in

                            expandedMultiSeries = ExpandedMultiSeries(
                                series: series
                            )
                        }
                    )
                    
                    InsightsView(
                        entries: filteredEntries
                    )
                }
                .padding()
            }
            .background(theme.bg.ignoresSafeArea())
            .navigationTitle("Gràfics")
            .toolbar {
                timeframeToolbar
            }
        }
        .sheet(item: $expandedMultiSeries) { data in

            ExpandedChartView(
                content: .multiSeries(
                    title: chartType.rawValue,
                    series: data.series
                )
            )
        }
    }

    // MARK: - Filtered entries for current timeframe

    private var filteredEntries: [DailyEntry] {

        let today = Date().isoDate

        if settings?.chartTimeframe == "all" {

            return entries
                .filter {
                    $0.date <= today
                }
                .sorted {
                    $0.date < $1.date
                }
        }

        let dates = TrendCalculator.dates(
            for: settings?.chartTimeframe ?? "month"
        )

        guard let start = dates.first,
              let end = dates.last
        else {
            return []
        }

        return entries
            .filter {
                $0.date >= start.isoDate &&
                $0.date <= min(end.isoDate, today)
            }
            .sorted {
                $0.date < $1.date
            }
    }
    
    @ToolbarContentBuilder
    private var timeframeToolbar: some ToolbarContent {
        
        ToolbarItem(
            placement: .navigationBarTrailing
        ) {
            
            if let s = settings {
                Menu {
                    ForEach(
                        [
                            "week", "15days", "month", "3months", "6months", "year", "all"
                        ],
                        id: \.self
                    ) { tf in
                        
                        Button {
                            
                            s.chartTimeframe = tf
                            
                        } label: {
                            
                            Label(
                                timeframeLabel(tf),
                                systemImage:
                                    s.chartTimeframe == tf
                                    ? "checkmark"
                                    : ""
                            )
                        }
                    }
                    
                } label: {
                    
                    Label(
                        timeframeLabel(s.chartTimeframe),
                        systemImage: "calendar.badge.clock"
                    )
                    .font(.caption)
                }
            }
        }
    }
    
    private func timeframeLabel(_ tf: String) -> String {

        switch tf {

        case "week":
            return "1 setmana"

        case "15days":
            return "15 dies"

        case "month":
            return "1 mes"

        case "3months":
            return "3 mesos"

        case "6months":
            return "6 mesos"

        case "year":
            return "1 any"

        default:
            return "Tot"
        }
    }
}
