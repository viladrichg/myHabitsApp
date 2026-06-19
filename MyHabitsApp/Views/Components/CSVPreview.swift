import SwiftUI

struct CSVPreview: View {

    let dates: [String]

    var body: some View {

        VStack(alignment: .leading, spacing: 12) {

            Text("Preview")
                .font(.title3.weight(.semibold))

            Text("Total entries: \(dates.count)")

            if let first = dates.first, let last = dates.last {
                Text("Range: \(first) → \(last)")
            }

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(dates.prefix(20), id: \.self) { d in
                        Text(d)
                            .font(.caption)
                    }
                }
            }
            .frame(maxHeight: 150)
        }
        .padding()
    }
}
