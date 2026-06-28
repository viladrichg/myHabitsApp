import SwiftUI
import Charts

/// Step 6 — Trend / Ritme
/// Shows the smoothed improvement rhythm for a selected field.
/// The Y axis is normalized 0–1: 1 = fastest improvement pace seen in the period.
struct TrendCard: View {
    @Environment(\.appTheme) var theme

    let entries: [DailyEntry]
    let customVariables: [CustomVariable]

    @Binding var selectedField: String

    let timeframe: String

    private var dates: [Date] { TrendCalculator.dates(for: timeframe) }

    private var trendPoints: [TrendCalculator.Point] {
        TrendCalculator.compute(
            entries: entries,
            fieldKey: selectedField,
            dates: dates,
            smoothingWindow: 7
        )
    }

    // Sparse X-axis labels (max 6, dd/MM/yyyy)
    private var xLabels: [(date: Date, label: String)] {
        sparseXLabels(from: dates, maxLabels: 6)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Tendència")
                        .font(.headline)
                        .foregroundStyle(theme.text)
                    Text("Evolució de l'hàbit")
                        .font(.caption)
                        .foregroundStyle(theme.secondary)
                }
                Spacer()
                fieldPicker
            }

            if trendPoints.isEmpty {
                Text("No hi ha prou dades en aquest període.")
                    .font(.subheadline)
                    .foregroundStyle(theme.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 40)
            } else {
                Chart(trendPoints) { pt in
                    AreaMark(
                        x: .value("Data", pt.date),
                        y: .value("Tendència", pt.value)
                    )
                    .foregroundStyle(
                        LinearGradient(
                            colors: [theme.accent.opacity(0.5), theme.accent.opacity(0.05)],
                            startPoint: .top, endPoint: .bottom
                        )
                    )
                    LineMark(
                        x: .value("Date", pt.date),
                        y: .value("Trend", pt.value)
                    )
                    .foregroundStyle(theme.accent)
                    .lineStyle(.init(lineWidth: 2))
                }
                .chartYScale(domain: 0...1)
                .chartYAxis {
                    AxisMarks(values: [0, 0.5, 1.0]) { value in

                        AxisGridLine()
                            .foregroundStyle(theme.border)

                        AxisValueLabel {

                            if let v = value.as(Double.self) {

                                if v < 0.25 {

                                    Text("Baix")

                                } else if v < 0.75 {

                                    Text("Mitjà")

                                } else {

                                    Text("Alt")
                                }
                            }
                        }
                    }
                }
                .chartXAxis {
                    // Show only sparse labels with tick marks
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
                .frame(height: 180)
            }
        }
        .padding()
        .cardStyle()
    }

    private var fieldPicker: some View {
        Menu {

            Section("Integrades") {

                ForEach(builtInVariables) { v in
                    Button(v.label) {
                        selectedField = v.fieldKey
                    }
                }
            }

            if !customVariables.isEmpty {

                Section("Personalitzades") {

                    ForEach(
                        customVariables.filter {
                            $0.type == "boolean"
                        }
                    ) { v in

                        Button(v.label) {
                            selectedField = v.variableId
                        }
                    }
                }
            }

        } label: {

            HStack(spacing: 4) {

                Text(currentFieldLabel)

                Image(systemName: "chevron.down")
            }
            .font(.caption)
            .foregroundStyle(theme.accent)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(theme.accent.opacity(0.1))
            .clipShape(Capsule())
        }
    }

    private var currentFieldLabel: String {

        if let builtIn = builtInVariables.first(
            where: { $0.fieldKey == selectedField }
        ) {
            return builtIn.label
        }

        if let custom = customVariables.first(
            where: { $0.variableId == selectedField }
        ) {
            return custom.label
        }

        return selectedField
    }
}
