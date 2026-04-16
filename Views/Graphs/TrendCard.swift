import SwiftUI
import Charts

/// Step 6 — Trend / Ritme
/// Shows the smoothed improvement rhythm for a selected field.
/// The Y axis is normalized 0–1: 1 = fastest improvement pace seen in the period.
struct TrendCard: View {
    @Environment(\.appTheme) var theme
    let entries: [DailyEntry]
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
                    Text("Trend / Ritme")
                        .font(.headline)
                        .foregroundStyle(theme.text)
                    Text("Improvement rhythm — smoothed slope")
                        .font(.caption)
                        .foregroundStyle(theme.secondary)
                }
                Spacer()
                fieldPicker
            }

            if trendPoints.isEmpty {
                Text("Not enough data for this period.")
                    .font(.subheadline)
                    .foregroundStyle(theme.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 40)
            } else {
                Chart(trendPoints) { pt in
                    AreaMark(
                        x: .value("Date", pt.date),
                        y: .value("Trend", pt.value)
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
                    AxisMarks(values: [0, 0.25, 0.5, 0.75, 1.0]) { val in
                        AxisGridLine().foregroundStyle(theme.border)
                        AxisValueLabel {
                            if let v = val.as(Double.self) {
                                Text(String(format: "%.0f%%", v * 100))
                                    .font(.caption2)
                                    .foregroundStyle(theme.secondary)
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
            ForEach(builtInVariables) { v in
                Button(v.label) { selectedField = v.fieldKey }
            }
        } label: {
            HStack(spacing: 4) {
                Text(currentFieldLabel)
                    .font(.caption)
                    .foregroundStyle(theme.accent)
                Image(systemName: "chevron.down")
                    .font(.caption2)
                    .foregroundStyle(theme.accent)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(theme.accent.opacity(0.1))
            .clipShape(Capsule())
        }
    }

    private var currentFieldLabel: String {
        builtInVariables.first(where: { $0.fieldKey == selectedField })?.label ?? selectedField
    }
}
