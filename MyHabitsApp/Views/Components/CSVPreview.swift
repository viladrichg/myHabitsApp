import SwiftUI

struct CSVPreview: View {

    let preview: BackupManager.CSVPreviewData
    
    let importMode: BackupManager.ImportMode
    
    var body: some View {

        VStack(alignment: .leading, spacing: 12) {

            switch importMode {

            case .addNewOnly:
                
                HStack {
                    Text("🟢 S'importaran:")
                        .foregroundStyle(.green)
                        .bold()
                    Text("\(preview.newEntries) registres")
                }

                HStack {
                    Text("⚪ S'ignoraran:")
                        .foregroundStyle(.gray)
                        .bold()
                    Text("\(preview.existingEntries) registres existents")
                }

            case .updateExisting:

                HStack {
                    Text("🟢 Nous:")
                        .foregroundStyle(.green)
                        .bold()
                         Text("\(preview.newEntries) registres")
                }

                HStack {
                    Text("🟡 S'actualitzaran:")
                        .foregroundStyle(.yellow)
                        .bold()
                    Text("\(preview.existingEntries) registres")
                }
            case .replace:

                HStack {
                    Text("🔴 Se substituiran:")
                        .foregroundStyle(.red)
                        .bold()
                    Text("\(preview.total) registres")
                }
            }

            if let first = preview.firstDate,
               let last = preview.lastDate {
                
                HStack {
                    Text("📆 Interval: ")
                        .bold()
                    Text("\(first) → \(last)")
                }
            }
            
            switch importMode {

            case .addNewOnly:

                Text(
                    "Només s'importaran les dates que no existeixin. Les dates existents es mantindran sense canvis."
                )
                .font(.caption)
                .foregroundStyle(.secondary)

            case .updateExisting:

                Text(
                    "Les dates noves s'importaran i les existents se substituiran. Les dades no presents al fitxer es mantindran sense canvis."
                )
                .font(.caption)
                .foregroundStyle(.secondary)

            case .replace:

                Text(
                    "S'eliminaran TOTES les dades actuals i es remplaçaran per les del fitxer importat."
                )
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            
            
            //MARK: validationMessages
            
            if preview.invalidRows > 0 {

                Rectangle()
                    .fill(.gray.opacity(0.25))
                    .frame(height: 2)
                    .padding(.vertical, 10)

                Text("⚠️ Problemes detectats en: \(preview.invalidRows) files")
                    .foregroundStyle(.orange)
                    .font(.headline)
            }
            
            if !preview.validationMessages.isEmpty {

                ScrollView {

                    VStack(alignment: .leading, spacing: 6) {

                        ForEach(preview.validationMessages, id: \.self) { message in

                            Text("• \(message)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
                .frame(maxHeight: 250)
            }
            
            //MARK: duplicationDates
            if !preview.duplicatedDates.isEmpty {

                Rectangle()
                    .fill(.gray.opacity(0.25))
                    .frame(height: 2)
                    .padding(.vertical, 4)
                
                Text("⚠️ Dates duplicades: \(preview.duplicatedDates.count)")
                    .foregroundStyle(.orange)
                    .font(.headline)
                
                ScrollView {

                    VStack(alignment: .leading, spacing: 6) {

                        ForEach(preview.duplicatedDates, id: \.self) { date in

                            Text("• \(date)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
                .frame(maxHeight: 200)
            }

            Rectangle()
                .fill(.gray.opacity(0.25))
                .frame(height: 2)
                .padding(.vertical, 20)
            
            if preview.invalidRows == 0 {

                Text("✅ No s'han detectat errors")
                    .foregroundStyle(.green)
                    .font(.caption)
            }
        }
        .padding()
    }
}
