import SwiftUI

struct ColorPalette: View {

    let colors = [
        "#3B82F6", // blau
        "#F97316", // taronja
        "#EF4444", // vermell
        "#F472B6", // rosa
        "#22C55E", // verd
        "#A78BFA", // lila
        "#06B6D4"  // blau cel
    ]

    @Binding var selectedHex: String

    var body: some View {

        HStack {
            ForEach(colors, id: \.self) { hex in

                Circle()
                    .fill(Color(hex: hex))
                    .frame(width: 28, height: 28)

                    .overlay(
                        Circle()
                            .stroke(
                                selectedHex == hex ? Color.primary : Color.clear,
                                lineWidth: 2
                            )
                    )

                    .onTapGesture {
                        selectedHex = hex
                    }
            }
        }
    }
}
