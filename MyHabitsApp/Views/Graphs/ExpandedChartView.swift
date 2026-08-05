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
    @Environment(\.horizontalSizeClass)
    private var horizontalSizeClass
    
    @State private var zoomDays = 30
    
    let content: ExpandedChartContent
    
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
    
    private var visibleDomain: TimeInterval {

        switch zoomDays {

        case 7:
            return 7 * 86400

        case 30:
            return 30 * 86400

        case 90:
            return 90 * 86400

        default:
            return 3650 * 86400
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
        
        Text(title)
            .font(.title.bold())

        Picker("", selection: $zoomDays) {

            Text("7d").tag(7)

            Text("30d").tag(30)

            Text("90d").tag(90)

            Text("Tot").tag(3650)
        }
        .pickerStyle(.segmented)

        Chart {

            ForEach(
                points,
                id: \.0
            ) { point in

                LineMark(
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
        .chartScrollableAxes(.horizontal)
        .chartXVisibleDomain(length: visibleDomain)
        .frame(height: chartHeight)

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

        horizontalSizeClass == .regular
        ? 650
        : 450
    }
    
    
    // MARK: TrendChart

    @ViewBuilder
    private func trendChart(
        title: String,
        points: [TrendCalculator.Point]
    ) -> some View {

        Text(title)
            .font(.title.bold())

        Picker("", selection: $zoomDays) {

            Text("7d").tag(7)
            Text("30d").tag(30)
            Text("90d").tag(90)
            Text("Tot").tag(3650)
        }
        .pickerStyle(.segmented)

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
        .chartScrollableAxes(.horizontal)
        .chartXVisibleDomain(length: visibleDomain)
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
        
        Picker("", selection: $zoomDays) {

            Text("7d")
                .tag(7)

            Text("30d")
                .tag(30)

            Text("90d")
                .tag(90)

            Text("Tot")
                .tag(3650)
        }
        .pickerStyle(.segmented)
        
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
        .chartForegroundStyleScale(
            domain: series.map(\.label),
            range: series.map(\.color)
        )
        .chartLegend(
            position: .bottom
        )
        .chartScrollableAxes(.horizontal)
        .chartXVisibleDomain(length: visibleDomain)
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
