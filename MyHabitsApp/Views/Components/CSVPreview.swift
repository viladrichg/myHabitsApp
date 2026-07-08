import SwiftUI

struct CSVPreview: View {

    let preview: BackupManager.CSVPreviewData

    var body: some View {

        VStack(alignment: .leading, spacing: 12) {

            Text("Preview")
                .font(.title3.weight(.semibold))

            Text("📅 Entrades detectades: \(preview.total)")

            Text("🟢 Noves: \(preview.newEntries)")

            Text("🟡 S'actualitzaran: \(preview.existingEntries)")

            if let first = preview.firstDate,
               let last = preview.lastDate {

                Text("📆 Interval: \(first) → \(last)")
            }
        }
        .padding()    }
}
