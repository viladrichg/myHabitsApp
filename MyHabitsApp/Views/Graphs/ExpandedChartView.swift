import SwiftUI
import Charts

enum ExpandedChartContent {

    case line(
        title: String,
        points: [(Date, Double)],
        color: Color,
        unit: String
    )

    case trend(
        title: String,
        points: [TrendCalculator.Point]
    )
    
    case multiSeries(
        title: String,
        series: [
            (
                field: String,
                label: String,
                color: Color,
                points: [(Date, Double)]
            )
        ]
    )

}

struct ExpandedChartView: View {
    
    @Environment(\.dismiss) private var dismiss
    @Environment(\.verticalSizeClass)
    private var verticalSizeClass
    
    let content: ExpandedChartContent
    
    @State private var scrollPosition: Date = .now
    
    @State private var selectedRange: ChartRange = .month
    
    enum ChartRange: String, CaseIterable {
        case days15 = "15D"
        case month = "1M"
        case threeMonths = "3M"
        case year = "1A"
        case all = "Tot"

        var days: Int? {
            switch self {
            case .days15: return 15
            case .month: return 30
            case .threeMonths: return 90
            case .year: return 365
            case .all: return nil
            }
        }
    }
    
    private func visibleDomainLength(
        for points: [(Date, Double)]
    ) -> TimeInterval {

        switch selectedRange {

        case .days15:
            return 15 * 24 * 60 * 60

        case .month:
            return 30 * 24 * 60 * 60

        case .threeMonths:
            return 90 * 24 * 60 * 60

        case .year:
            return 365 * 24 * 60 * 60

        case .all:

            guard
                let first = points.first?.0,
                let last = points.last?.0
            else {
                return 30 * 24 * 60 * 60
            }

            return last.timeIntervalSince(first)
        }
    }
    
    var body: some View {
        
        NavigationStack {
                    
                    VStack(spacing: 20) {
                        
                        HStack {

                            Spacer()

                            Button {

                                dismiss()

                            } label: {

                                Image(systemName: "xmark.circle.fill")
                                    .font(.title)
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.top,8)
                        }
                        
                        switch content {
                            
                        case let .line(
                            title,
                            points,
                            color,
                            unit
                        ):
                            
                            lineChart(
                                title: title,
                                points: points,
                                color: color,
                                unit: unit
                            )
                            
                        case let .trend(
                            title,
                            points
                        ):
                            
                            trendChart(
                                title: title,
                                points: points
                            )
                            
                        case let .multiSeries(
                            title,
                            series
                        ):
                            
                            multiSeriesChart(
                                title: title,
                                series: series
                            )
                        }
                    }
                    .padding()
                    
                }
            
    }
    
    // MARK: LineChart
    @ViewBuilder
    private func lineChart(
        title: String,
        points: [(Date, Double)],
        color: Color,
        unit: String
    ) -> some View {
        
        let values = points.map { $0.1 }
        let minValue = values.min() ?? 0
        let maxValue = values.max() ?? 1

        let range = max(maxValue - minValue, 1)

        let padding: Double =
            (selectedRange == .days15 ||
             selectedRange == .month)
            ? range * 0.1
            : range * 0.1
        
        Text(title)
            .font(.title.bold())
        
        Picker("", selection: $selectedRange) {
            ForEach(ChartRange.allCases, id: \.self) { range in
                Text(range.rawValue)
                    .tag(range)
            }
        }
        .pickerStyle(.segmented)

        Chart {

            ForEach(points, id: \.0) { point in

                if selectedRange == .days15 ||
                   selectedRange == .month {

                    LineMark(
                        x: .value("Data", point.0),
                        y: .value(title, point.1)
                    )
                    .foregroundStyle(color)
                }

                PointMark(
                    x: .value(
                        "Data",
                        point.0
                    ),
                    y: .value(
                        title,
                        point.1
                    )
                )
                .foregroundStyle(color)
            }
        }
        .onAppear {
            if let lastDate = points.last?.0 {
                scrollPosition = lastDate
            }
        }
        .chartScrollPosition(x: $scrollPosition)
        .chartScrollableAxes(.horizontal)
        .chartXVisibleDomain(length: visibleDomainLength(for: points))
        .frame(height: chartHeight)
        .chartYScale(domain: (minValue - padding)...(maxValue + padding))
        .chartXAxis {

            AxisMarks { value in

                AxisGridLine()

                AxisTick()

                AxisValueLabel {

                    if let date = value.as(Date.self) {

                        switch selectedRange {

                        case .days15, .month:

                            Text(
                                date.formatted(
                                    .dateTime
                                        .day()
                                        .month(.abbreviated)
                                        .year()
                                )
                            )

                        case .threeMonths:

                            Text(
                                date.formatted(
                                    .dateTime
                                        .month(.abbreviated)
                                        .year()
                                )
                            )

                        case .year:

                            Text(
                                date.formatted(
                                    .dateTime
                                        .month(.abbreviated)
                                        .year()
                                )
                            )

                        case .all:

                            Text(
                                date.formatted(
                                    .dateTime
                                        .year()
                                )
                            )
                        }
                    }
                }
                .font(.caption2)
            }
        }

        if !values.isEmpty {

            HStack(spacing: 12) {

                statBox(
                    title: "Mínim",
                    value: String(
                        format: "%.1f%@",
                        values.min() ?? 0,
                        unit
                    ),
                    color: .green
                )

                statBox(
                    title: "Mitjana",
                    value: String(
                        format: "%.1f%@",
                        values.reduce(0,+)
                        / Double(values.count),
                        unit
                    ),
                    color: .orange
                )

                statBox(
                    title: "Màxim",
                    value: String(
                        format: "%.1f%@",
                        values.max() ?? 0,
                        unit
                    ),
                    color: .red
                )
            }
        }
    }
    
    
    private var chartHeight: CGFloat {

        verticalSizeClass == .regular
        ? 500
        : 350
    }
    
    
    // MARK: TrendChart

    @ViewBuilder
    private func trendChart(
        title: String,
        points: [TrendCalculator.Point]
    ) -> some View {

        Text(title)
            .font(.title.bold())

        Chart(points) { point in

            AreaMark(
                x: .value(
                    "Data",
                    point.date
                ),
                y: .value(
                    "Tendència",
                    point.value
                )
            )

            LineMark(
                x: .value(
                    "Data",
                    point.date
                ),
                y: .value(
                    "Tendència",
                    point.value
                )
            )
        }
        .frame(height: chartHeight)
    }
    
    // MARK: MultiSeriesChart


    @ViewBuilder
    private func multiSeriesChart(
        title: String,
        series: [
            (
                field: String,
                label: String,
                color: Color,
                points: [(Date, Double)]
            )
        ]
    ) -> some View {

        Text(title)
            .font(.title.bold())
        
        Text("Gira el dispositiu per veure més detall")
            .font(.caption)
            .foregroundStyle(.secondary)
        
        Chart {

            ForEach(series, id: \.field) { item in

                ForEach(
                    item.points,
                    id: \.0
                ){ point in

                    LineMark(
                        x: .value(
                            "Data",
                            point.0
                        ),
                        y: .value(
                            item.label,
                            point.1
                        )
                    )
                    .foregroundStyle(
                        by: .value(
                            "Variable",
                            item.label
                        )
                    )
                    .lineStyle(.init(lineWidth: 3))
                }
            }
        }
        
        .chartScrollableAxes(.horizontal)
        .chartXVisibleDomain(length: 30 * 24 * 60 * 60)
        .chartForegroundStyleScale(
            domain: series.map(\.label),
            range: series.map(\.color)
        )
        .chartLegend(position: .bottom)
        .frame(height: chartHeight)
    }
    
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
}
