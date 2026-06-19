import SwiftUI

struct SelectableRow: View {
    let title: String
    let isActive: Bool
    let action: () -> Void

    @Environment(\.appTheme) var theme

    var body: some View {
        Button(action: action) {
            HStack {
                Text(title)
                    .foregroundStyle(theme.text)

                Spacer()

                if isActive {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(theme.accent)
                } else {
                    Circle()
                        .stroke(theme.border, lineWidth: 1.5)
                        .frame(width: 18, height: 18)
                }
            }
            .padding()
            .background(theme.card)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }
}
