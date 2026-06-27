import SwiftUI
import SwiftData
import UniformTypeIdentifiers

struct BackupSettingsView: View {

    @Environment(\.appTheme) var theme
    @Environment(\.modelContext) private var ctx

    @Bindable var settings: AppSettings

    @Query private var entries: [DailyEntry]
    @Query private var customVariables: [CustomVariable]

    @State private var showingImporter = false
    @State private var previewDates: [String] = []
    @State private var selectedFile: URL?
    @State private var showPreview = false

    @State private var importMode: BackupManager.ImportMode = .merge
    @State private var fromDate = Date()
    @State private var toDate = Date()

    @State private var isExporting = false
    @State private var exportError: String?
    @State private var exportSuccess = false

    @State private var importMessage: String?

    var body: some View {

        Form {

            Section("Exportació") {

                Button {
                    runExport()
                } label: {

                    if isExporting {

                        HStack {
                            ProgressView()
                            Text("Preparant exportació...")
                        }

                    } else {

                        Label(
                            "Exportar CSV",
                            systemImage: "square.and.arrow.up"
                        )
                        .foregroundStyle(theme.accent)
                    }
                }

                Button {
                    exportTemplate()
                } label: {

                    Label(
                        "Descarregar plantilla CSV",
                        systemImage: "doc.badge.plus"
                    )
                    .foregroundStyle(theme.accent)
                }

                if let exportError {

                    Text("Error: \(exportError)")
                        .font(.caption)
                        .foregroundStyle(.red)
                }

                if exportSuccess {

                    Text("✅ Exportació preparada")
                        .font(.caption)
                        .foregroundStyle(.green)
                }
            }
            .listRowBackground(theme.card)

            Section("Importació") {

                Button {
                    showingImporter = true
                } label: {

                    Label(
                        "Importar CSV",
                        systemImage: "square.and.arrow.down"
                    )
                    .foregroundStyle(theme.accent)
                }

                Text("""
Importa un CSV generat per l'aplicació o utilitza la plantilla com a guia.
""")
                .font(.caption)
                .foregroundStyle(theme.secondary)

                if let importMessage {

                    Text(importMessage)
                        .font(.caption)
                        .foregroundStyle(.green)
                }
            }
            .listRowBackground(theme.card)
        }
        .scrollContentBackground(.hidden)
        .background(theme.bg.ignoresSafeArea())
        .navigationTitle("Còpies de seguretat")

        .fileImporter(
            isPresented: $showingImporter,
            allowedContentTypes: [.commaSeparatedText],
            allowsMultipleSelection: false
        ) { result in
            handleImport(result)
        }

        .sheet(isPresented: $showPreview) {

            NavigationStack {

                VStack(spacing: 20) {

                    CSVPreview(dates: previewDates)

                    Group {

                        Text("Registres detectats")
                            .font(.headline)

                        Text("\(previewDates.count)")
                            .font(.largeTitle.bold())
                    }

                    Picker(
                        "Mode d'importació",
                        selection: $importMode
                    ) {

                        Text("Fusionar")
                            .tag(BackupManager.ImportMode.merge)

                        Text("Substituir")
                            .tag(BackupManager.ImportMode.replace)
                    }
                    .pickerStyle(.segmented)

                    VStack {

                        DatePicker(
                            "Des de",
                            selection: $fromDate,
                            displayedComponents: .date
                        )

                        DatePicker(
                            "Fins a",
                            selection: $toDate,
                            displayedComponents: .date
                        )
                    }

                    Button("Confirmar importació") {
                        confirmImport()
                    }
                    .buttonStyle(.borderedProminent)

                    Button("Cancel·lar") {
                        showPreview = false
                    }
                }
                .padding()
                .navigationTitle("Previsualització")
                .navigationBarTitleDisplayMode(.inline)
            }
        }
    }

    // MARK: EXPORT

    private func runExport() {

        isExporting = true
        exportError = nil
        exportSuccess = false

        Task {

            do {

                try await BackupManager.shared.runBackup(
                    entries: entries,
                    customVariables: customVariables,
                    settings: settings,
                    presentingViewController: nil
                )

                exportSuccess = true

            } catch BackupManager.BackupError.noEntries {

                exportError = "No hi ha dades per exportar"

            } catch {

                exportError = error.localizedDescription
            }

            isExporting = false
        }
    }

    // MARK: TEMPLATE

    private func exportTemplate() {

        Task {

            do {

                try await BackupManager.shared.exportTemplateCSV()

            } catch {

                exportError = error.localizedDescription
            }
        }
    }

    // MARK: IMPORT

    private func handleImport(_ result: Result<[URL], Error>) {

        previewDates = []
        selectedFile = nil

        do {

            let urls = try result.get()

            guard let url = urls.first else {
                return
            }

            selectedFile = url

            previewDates =
                try BackupManager.shared.previewCSV(
                    from: url
                )

            if let first = previewDates.first,
               let last = previewDates.last,
               let d1 = Date.from(isoDate: first),
               let d2 = Date.from(isoDate: last) {

                fromDate = d1
                toDate = d2
            }

            showPreview = true

        } catch {

            exportError = error.localizedDescription
        }
    }
    private func confirmImport() {

        guard let file = selectedFile else {
            return
        }

        do {

            let result =
                try BackupManager.shared.importCSV(
                    from: file,
                    context: ctx,
                    mode: importMode,
                    dateRange: fromDate...toDate
                )

            importMessage = """
    ✅ Importació completada

    Nous: \(result.inserted)
    Actualitzats: \(result.updated)
    Ignorats: \(result.skipped)
    """

            showPreview = false

        } catch {

            exportError = error.localizedDescription
        }
    }

}
