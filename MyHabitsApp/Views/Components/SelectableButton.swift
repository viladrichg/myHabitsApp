import SwiftUI

struct SelectableButton: View {
    let title: String
    let isActive: Bool

    // ✅ CHANGE: ara el color ve de fora (no només theme)
    var color: Color

    let action: () -> Void

    @Environment(\.appTheme) var theme

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.body.weight(.medium))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)

                // ✅ CHANGE: color sempre present (no només actiu)
                .background(
                    isActive
                    ? color
                    : color.opacity(0.2)
                )

                // ✅ CHANGE: color text consistent
                .foregroundStyle(
                    isActive
                    ? Color.white
                    : color
                )

                .clipShape(RoundedRectangle(cornerRadius: 12))

                // ✅ CHANGE: millor contorn
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(
                            isActive
                            ? color
                            : theme.border,
                            lineWidth: 1.5
                        )
                )
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.15), value: isActive) // ✅ CHANGE
    }
}
