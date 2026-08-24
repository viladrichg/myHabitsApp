import SwiftUI
import SwiftData
import Charts

struct MultiSeriesChartCard: View {
    @Environment(\.appTheme) var theme
    let entries: [DailyEntry]
    @Binding var chartType: GraphsView.ChartType
    let customVariables: [CustomVariable]
    let onOpenFullscreen: ((
        [(field: String,
          label: String,
          color: Color,
          points: [(Date, Double)])]
    ) -> Void)?
    
    @Query(sort: \AppSettings.createdAt)
    private var allSettings: [AppSettings]

    private var settings: AppSettings? {
        allSettings.first
    }
    
    @State private var scrollPosition: Date = .now

    // Which fields are toggled on
    @State private var visibleFields: Set<String> = [
        "meditation",
        "workedAtJob",
        "workedAtHome",
        "fum",
        "sports"
    ]
    private var dates: [Date] {
        entries.compactMap { Date.from(isoDate: $0.date) }.sorted()
    }

    @State private var zoomIndex = 0

    private let zoomLevels: [Double] = [
        1.0,
        0.75,
        0.5,
        0.25
    ]
    
    private var xLabels: [(date: Date, label: String)] {
        sparseXLabels(from: visibleDates, maxLabels: 5)
    }

    private var seriesData: [(field: String, label: String, color: Color, points: [(Date, Double)])] {

        let builtIn =
            builtInVariables
                .filter {
                    $0.type == "boolean"
                }
                .filter {
                    !($0.isHidden(using: settings))
                }
                .filter {
                    visibleFields.contains($0.fieldKey)
                }

                .map { v in
                    (
                        v.fieldKey,
                        v.displayLabel(using: settings),
                        v.displayColor(using: settings),
                        buildSeries(fieldKey: v.fieldKey)
                    )
                }

        let custom =
            customVariables
                .filter { $0.type == "boolean" }
                .filter { visibleFields.contains($0.variableId) }
                .map { v in
                    (
                        v.variableId,
                        v.label,
                        Color(hex: v.colorHex),
                        buildSeries(fieldKey: v.variableId)
                    )
                }

        return builtIn + custom
    }

    private var visibleDays: Double {

        switch settings?.chartTimeframe {

        case "week":
            return 7 * 24 * 60 * 60

        case "15days":
            return 15 * 24 * 60 * 60

        case "month":
            return 30 * 24 * 60 * 60

        case "3months":
            return 90 * 24 * 60 * 60

        case "6months":
            return 180 * 24 * 60 * 60

        case "year":
            return 365 * 24 * 60 * 60

        default:
            guard
                let first = dates.first,
                let last = dates.last
            else {
                return 30 * 24 * 60 * 60
            }

            return last.timeIntervalSince(first)
        }
    }
    
    
    private var visibleSeriesData:
    [(field: String,
      label: String,
      color: Color,
      points: [(Date, Double)])] {

        guard let visibleStartDate else {
            return seriesData
        }

        return seriesData.map { series in
            (
                field: series.field,
                label: series.label,
                color: series.color,
                points: series.points.filter {
                    $0.0 >= visibleStartDate
                }
            )
        }
    }
    
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {

            Picker(
                "",
                selection: $chartType
            ) {
                ForEach(
                    GraphsView.ChartType.allCases,
                    id: \.self
                ) {
                    Text($0.rawValue)
                        .tag($0)
                }
            }
            .pickerStyle(.segmented)
            .padding(.bottom, 16)
            .padding(.top, 8)
            
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(
                            builtInVariables.filter {
                                $0.type == "boolean"
                                &&
                                !$0.isHidden(using: settings)
                            }
                        ) { v in
                            
                            Toggle(
                                v.displayLabel(using: settings),
                                isOn: Binding(
                                    get: { visibleFields.contains(v.fieldKey) },
                                    set: { on in
                                        if on {
                                            visibleFields.insert(v.fieldKey)
                                        } else {
                                            visibleFields.remove(v.fieldKey)
                                        }
                                    }
                                )
                            )
                            .toggleStyle(
                                ChipToggleStyle(
                                    color: Color(hex: v.colorHex)
                                )
                            )
                        }
                        
                        ForEach(
                            customVariables.filter {
                                !$0.isHidden &&
                                $0.type == "boolean"
                            }
                        ) { v in
                            
                            Toggle(
                                v.label,
                                isOn: Binding(
                                    get: { visibleFields.contains(v.variableId) },
                                    set: { on in
                                        if on {
                                            visibleFields.insert(v.variableId)
                                        } else {
                                            visibleFields.remove(v.variableId)
                                        }
                                    }
                                )
                            )
                            .toggleStyle(
                                ChipToggleStyle(
                                    color: Color(hex: v.colorHex)
                                )
                            )
                        }
                    }
                    .padding(.horizontal, 2)
                }

            if seriesData.isEmpty || dates.isEmpty {
                Text("Selecciona els camps que vols mostrar.")
                    .font(.subheadline)
                    .foregroundStyle(theme.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 40)
            } else {
                
                let allValues = visibleSeriesData
                    .flatMap(\.points)
                    .map(\.1)

                let maxValue = allValues.max() ?? 1

                let upperBound = max(
                    10,
                    maxValue * 1.15)
                
                
                Chart {
                    
                    ForEach(visibleSeriesData, id: \.field) { series in
                        ForEach(series.points, id: \.0) { (date, value) in
                            LineMark(
                                x: .value("Data", date),
                                y: .value(series.label, value)
                            )
                            .foregroundStyle(series.color)
                            .lineStyle(.init(lineWidth: 2))
                            .foregroundStyle(by: .value("Variable", series.label))
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
                        AxisGridLine().foregroundStyle(theme.text.opacity(0.25))
                        AxisTick().foregroundStyle(theme.border)
                        AxisValueLabel {
                            if let d = val.as(Date.self) {
                                Text(d.displayDate)
                                    .font(.caption2)
                                    .foregroundStyle(theme.secondary)
                            }
                        }
                    }
                }
                .chartYScale(
                    domain: 0...upperBound
                )
                .chartXScale(
                    domain: (visibleDates.first ?? .now)...(visibleDates.last ?? .now)
                )
                .chartLegend(.hidden)  // We use the chips above
                .frame(height: 260)
                .onTapGesture {
                    onOpenFullscreen?(seriesData)
                }
            }
        }
        .padding()
        .cardStyle()
    }

    private var visibleDates: [Date] {

        guard let visibleStartDate else {
            return dates
        }

        return dates.filter {
            $0 >= visibleStartDate
        }
    }
    
    private var visibleStartDate: Date? {

        guard let last = dates.last else { return nil }

        let days: Int

        switch settings?.chartTimeframe {
        case "week": days = 7
        case "15days": days = 15
        case "month": days = 30
        case "3months": days = 90
        case "6months": days = 180
        case "year": days = 365
        default:
            return dates.first
        }

        return Calendar.current.date(
            byAdding: .day,
            value: -days,
            to: last
        )
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
