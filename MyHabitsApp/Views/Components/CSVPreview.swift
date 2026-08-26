import SwiftUI

struct CSVPreview: View {

    let preview: BackupManager.CSVPreviewData
    
    let importMode: BackupManager.ImportMode
    
    var body: some View {

        VStack(alignment: .leading, spacing: 12) {

            Text("Previsualització")
                .font(.title3.weight(.semibold))

            switch importMode {

            case .addNewOnly:

                Text("🟢 S'importaran: \(preview.newEntries) registres")

                Text("⚪ S'ignoraran: \(preview.existingEntries) registres existents")

            case .updateExisting:

                Text("🟢 Nous: \(preview.newEntries) registres")

                Text("🟡 S'actualitzaran: \(preview.existingEntries) registres")

            case .replace:

                Text("🔴 Se substituiran: \(preview.total) registres")
            }

            if let first = preview.firstDate,
               let last = preview.lastDate {

                Text("📆 Interval: \(first) → \(last)")
            }

            Divider()

            switch importMode {

            case .addNewOnly:

                Text(
                    "Només s'importaran les dates que no existeixin. Les dates existents es mantindran sense canvis."
                )
                .font(.caption)
                .foregroundStyle(.secondary)

            case .updateExisting:

                Text(
                    "Les dates existents es substituiran amb les dades del fitxer. Les dates noves també s'importaran. Les dates no presents al fitxer es conservaran."
                )
                .font(.caption)
                .foregroundStyle(.secondary)

            case .replace:

                Text(
                    "S'eliminaran totes les dades actuals. Només es conservaran les dades presents al fitxer."
                )
                .font(.caption)
                .foregroundStyle(.secondary)
            }
        }
        .padding()
    }
}
