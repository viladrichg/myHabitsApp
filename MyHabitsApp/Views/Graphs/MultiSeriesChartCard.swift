import SwiftUI
import Charts

struct MultiSeriesChartCard: View {
    @Environment(\.appTheme) var theme
    let entries: [DailyEntry]
    let chartType: GraphsView.ChartType
    let customVariables: [CustomVariable]

    // Which fields are toggled on
    @State private var visibleFields: Set<String> = Set(builtInVariables.prefix(4).map(\.fieldKey))

    private var dates: [Date] {
        entries.compactMap { Date.from(isoDate: $0.date) }.sorted()
    }

    private var xLabels: [(date: Date, label: String)] {
        sparseXLabels(from: dates, maxLabels: 6)
    }

    private var seriesData: [(field: String, label: String, color: Color, points: [(Date, Double)])] {
        builtInVariables
            .filter { visibleFields.contains($0.fieldKey) }
            .map { v in
                let pts = buildSeries(fieldKey: v.fieldKey)
                return (v.fieldKey, v.label, Color(hex: v.colorHex), pts)
            }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(chartType.rawValue)
                .font(.headline)
                .foregroundStyle(theme.text)

            // Toggle chips
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(builtInVariables) { v in
                        Toggle(v.label, isOn: Binding(
                            get: { visibleFields.contains(v.fieldKey) },
                            set: { on in
                                if on { visibleFields.insert(v.fieldKey) }
                                else  { visibleFields.remove(v.fieldKey) }
                            }
                        ))
                        .toggleStyle(ChipToggleStyle(color: Color(hex: v.colorHex)))
                    }
                }
                .padding(.horizontal, 2)
            }

            if seriesData.isEmpty || dates.isEmpty {
                Text("Select fields above to display.")
                    .font(.subheadline)
                    .foregroundStyle(theme.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 40)
            } else {
                Chart {
                    ForEach(seriesData, id: \.field) { series in
                        ForEach(series.points, id: \.0) { (date, value) in
                            LineMark(
                                x: .value("Date", date),
                                y: .value(series.label, value)
                            )
                            .foregroundStyle(series.color)
                            .lineStyle(.init(lineWidth: 2))
                            .foregroundStyle(by: .value("Field", series.label))
                        }
                    }
                }
                .chartForegroundStyleScale(
                    domain: seriesData.map(\.label),
                    range: seriesData.map(\.color)
                )
                .chartYAxis {
                    AxisMarks { val in
                        AxisGridLine().foregroundStyle(theme.border)
                        AxisValueLabel()
                            .foregroundStyle(theme.secondary)
                            .font(.caption2)
                    }
                }
                .chartXAxis {
                    AxisMarks(values: xLabels.map(\.date)) { val in
                        AxisGridLine().foregroundStyle(theme.border.opacity(0.5))
                        AxisTick().foregroundStyle(theme.border)
                        AxisValueLabel {
                            if let d = val.as(Date.self) {
                                Text(d.displayDate)
                                    .font(.caption2)
                                    .foregroundStyle(theme.secondary)
                                    .rotationEffect(.degrees(-30))
                            }
                        }
                    }
                }
                .chartLegend(.hidden)  // We use the chips above
                .frame(height: 220)
            }
        }
        .padding()
        .cardStyle()
    }

    // MARK: - Series builder

    private func buildSeries(fieldKey: String) -> [(Date, Double)] {
        let entryByDate = Dictionary(uniqueKeysWithValues: entries.map { ($0.date, $0) })
        var cumulative  = 0.0
        var monthBucket = 0.0
        var currentMonth = ""
        var result: [(Date, Double)] = []

        for date in dates {
            let iso = date.isoDate
            guard let e = entryByDate[iso] else { continue }
            let active = e.isActive(field: fieldKey) ? 1.0 : 0.0

            switch chartType {
            case .accumulated:
                cumulative += active
                result.append((date, cumulative))
            case .monthly:
                let m = String(iso.prefix(7))
                if m != currentMonth { monthBucket = 0; currentMonth = m }
                monthBucket += active
                result.append((date, monthBucket))
            }
        }
        return result
    }
}

// MARK: - Chip toggle style

private struct ChipToggleStyle: ToggleStyle {
    let color: Color
    func makeBody(configuration: Configuration) -> some View {
        Button {
            configuration.isOn.toggle()
        } label: {
            configuration.label
                .font(.caption)
                .foregroundStyle(configuration.isOn ? .white : color)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(configuration.isOn ? color : color.opacity(0.15))
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}
