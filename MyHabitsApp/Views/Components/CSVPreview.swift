import SwiftUI

struct CSVPreview: View {

    let preview: BackupManager.CSVPreviewData

    var body: some View {

        VStack(alignment: .leading, spacing: 12) {

            Text("Preview")
                .font(.title3.weight(.semibold))

            Text("📅 Entrades detectades: \(preview.total)")

            Text("🟢 Noves: \(preview.newEntries)")

            Text("🟡 Ja existents: \(preview.existingEntries)")

            if let first = preview.firstDate,
               let last = preview.lastDate {

                Text("📆 Interval: \(first) → \(last)")
            }

            if preview.existingEntries > 0 {

                Divider()

                Text("⚠️ Hi ha \(preview.existingEntries) dates que ja existeixen")
                    .font(.headline)

                Text("Les entrades existents es substituiran durant la importació.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
    }
}
