import SwiftUI
import SwiftData

struct DeletePeriodView: View {

    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var ctx

    @Query(
        sort: \DailyEntry.date
    )
    private var entries: [DailyEntry]

    @State private var startDate = Date()
    @State private var endDate = Date()

    @State private var showAlert = false

    private var affectedEntries: [DailyEntry] {

        let start = startDate.isoDate
        let end = endDate.isoDate

        return entries.filter {
            $0.date >= start &&
            $0.date <= end
        }
    }

    var body: some View {

        Form {

            Section("Període") {

                DatePicker(
                    "Data inici",
                    selection: $startDate,
                    displayedComponents: .date
                )

                DatePicker(
                    "Data final",
                    selection: $endDate,
                    displayedComponents: .date
                )
            }

            Section("Impacte") {

                Text(
                    "Entrades afectades: \(affectedEntries.count)"
                )

                Text(
                    "⚠️ Aquesta acció no es pot desfer."
                )
                .foregroundStyle(.orange)
            }

            Section {

                Button(
                    "Eliminar període",
                    role: .destructive
                ) {
                    showAlert = true
                }
                .disabled(
                    affectedEntries.isEmpty
                )
            }
        }
        .navigationTitle("Eliminar període")
        .alert(
            "Confirmar eliminació",
            isPresented: $showAlert
        ) {

            Button(
                "Cancel·lar",
                role: .cancel
            ) { }

            Button(
                "Eliminar",
                role: .destructive
            ) {

                for entry in affectedEntries {
                    ctx.delete(entry)
                }

                try? ctx.save()

                dismiss()
            }

        } message: {

            Text(
                "S'eliminaran \(affectedEntries.count) entrades."
            )
        }
    }
}
