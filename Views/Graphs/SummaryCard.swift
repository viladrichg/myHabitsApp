import SwiftUI

struct SummaryCard: View {
    @Environment(\.appTheme) var theme
    let entries: [DailyEntry]
    let customVariables: [CustomVariable]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Summary")
                .font(.headline)
                .foregroundStyle(theme.text)

            Text("\(entries.count) days tracked")
                .font(.subheadline)
                .foregroundStyle(theme.secondary)

            Divider().background(theme.border)

            ForEach(builtInVariables) { v in
                let count = entries.filter { $0.isActive(field: v.fieldKey) }.count
                let pct   = entries.isEmpty ? 0 : Double(count) / Double(entries.count)
                summaryRow(label: v.label, count: count, pct: pct, color: Color(hex: v.colorHex))
            }

            if !customVariables.isEmpty {
                Divider().background(theme.border)
                ForEach(customVariables) { v in
                    let count = entries.filter { $0.isActive(field: v.variableId) }.count
                    let pct   = entries.isEmpty ? 0 : Double(count) / Double(entries.count)
                    summaryRow(label: v.label, count: count, pct: pct, color: Color(hex: v.colorHex))
                }
            }
        }
        .padding()
        .cardStyle()
    }

    private func summaryRow(label: String, count: Int, pct: Double, color: Color) -> some View {
        HStack(spacing: 10) {
            Circle().fill(color).frame(width: 10, height: 10)
            Text(label)
                .font(.subheadline)
                .foregroundStyle(theme.text)
                .frame(width: 130, alignment: .leading)
            Spacer()
            Text("\(count)d")
                .font(.caption.weight(.semibold))
                .foregroundStyle(theme.secondary)
                .frame(width: 36, alignment: .trailing)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(theme.border).frame(height: 6)
                    Capsule().fill(color).frame(width: geo.size.width * pct, height: 6)
                }
            }
            .frame(height: 6)
            Text(String(format: "%.0f%%", pct * 100))
                .font(.caption)
                .foregroundStyle(theme.secondary)
                .frame(width: 38, alignment: .trailing)
        }
    }
}