import SwiftUI

struct ExportSelectionView: View {

    let fields: [CSVExporter.ExportField]
    @Binding var selectedKeys: Set<String>

    let onExport: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {

        NavigationStack {

            List {

                ForEach(fields) { field in

                    Toggle(
                        field.title,
                        isOn: Binding(
                            get: {
                                selectedKeys.contains(field.key)
                            },
                            set: { selected in

                                if selected {
                                    selectedKeys.insert(field.key)
                                } else {

                                    if field.key != "date" {
                                        selectedKeys.remove(field.key)
                                    }
                                }
                            }
                        )
                    )
                }
            }
            .navigationTitle("Exportació")
            .toolbar {

                ToolbarItem(placement: .cancellationAction) {

                    Button("Cancel·lar") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {

                    Button("Exportar") {
                        onExport()
                    }
                }
            }
        }
        .onAppear {

            if selectedKeys.isEmpty {
                selectedKeys.insert("date")
            }
        }
    }
}
