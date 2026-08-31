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
    @State private var previewData: BackupManager.CSVPreviewData?
    @State private var selectedFile: URL?
    @State private var showPreview = false

    @State private var importMode: BackupManager.ImportMode = .updateExisting

    @State private var isExporting = false
    @State private var exportError: String?
    @State private var exportSuccess = false

    @State private var importMessage: String?
    @State private var deleteMessage: String?
    
    @State private var showDeleteAlert = false
    @State private var showFinalDeleteAlert = false
    
    @State private var showExportSelection = false
    @State private var selectedExportKeys: Set<String> = ["date"]


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
                            "Exportar CSV complet",
                            systemImage: "square.and.arrow.up"
                        )
                        .foregroundStyle(theme.accent)
                    }
                }
                
                Button {
                    showExportSelection = true
                } label: {
                    
                    Label(
                        "Exportar personalitzat",
                        systemImage: "slider.horizontal.3"
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
            }.listRowBackground(theme.card)
            
            Button {
                exportTemplate()
            } label: {

                Label(
                    "Descarregar plantilla CSV",
                    systemImage: "doc.badge.plus"
                )
                .foregroundStyle(theme.accent)
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
                    .listRowBackground(theme.card)
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
            
            Section("Zona de perill") {
                
                NavigationLink {
                    DeletePeriodView()
                } label: {

                    Label(
                        "Eliminar període",
                        systemImage: "calendar.badge.minus"
                    )
                }

                Button(
                    role: .destructive
                ) {
                    showDeleteAlert = true
                } label: {

                    Label(
                        "Eliminar totes les entrades",
                        systemImage: "trash"
                    )
                }

                if let deleteMessage {

                    Text(deleteMessage)
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
            allowedContentTypes: [
                .commaSeparatedText,
                .plainText
            ],
            allowsMultipleSelection: false
        ) { result in
            handleImport(result)
        }
        .onAppear {
            print("THEME =", settings.themeStyle)
        }
        .sheet(isPresented: $showPreview) {

            NavigationStack {

                VStack(spacing: 8) {

                    if let previewData {
                        
                        CSVPreview(
                            preview: previewData,
                            importMode: importMode
                        )
                    }

                    Group {

                        HStack{
                            Text("Registres detectats: ")
                            .font(.headline)

                            Text("\((previewData?.total ?? 0) + (previewData?.invalidRows ?? 0))")
                                .font(.title.bold())
                        }
                        
                        Text(
                            "\(previewData?.newEntries ?? 0) nous · "
                            + "\(previewData?.existingEntries ?? 0) existents · "
                            + "\(previewData?.invalidRows ?? 0) problemàtics"
                        )
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }

                    Picker(
                        "Mode d'importació",
                        selection: $importMode
                    ) {

                        Text("Afegir noves")
                            .tag(BackupManager.ImportMode.addNewOnly)

                        Text("Actualitzar")
                            .tag(BackupManager.ImportMode.updateExisting)

                        Text("Reemplaçar tot")
                            .tag(BackupManager.ImportMode.replace)
                    }.pickerStyle(.menu)
                    

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
        .sheet(isPresented: $showExportSelection) {

            ExportSelectionView(
                fields: CSVExporter.availableFields(
                    customVariables: customVariables,
                    settings: settings
                ),
                selectedKeys: $selectedExportKeys
            ) {

                runPartialExport()
            }
        }
        
        .onChange(of: importMessage) { _, newValue in
            guard newValue != nil else { return }

            DispatchQueue.main.asyncAfter(deadline: .now() + 4) {
                if importMessage == newValue {
                    importMessage = nil
                }
            }
        }
        .onChange(of: deleteMessage) { _, newValue in
            guard newValue != nil else { return }

            DispatchQueue.main.asyncAfter(deadline: .now() + 4) {
                if deleteMessage == newValue {
                    deleteMessage = nil
                }
            }
        }
        .onChange(of: exportSuccess) { _, newValue in
            guard newValue else { return }

            DispatchQueue.main.asyncAfter(deadline: .now() + 4) {
                if exportSuccess == newValue {
                    exportSuccess = false
                }
            }
        }
                .alert(
                    "Eliminar totes les dades?",
                    isPresented: $showDeleteAlert
                ) {

                    Button(
                        "Cancel·lar",
                        role: .cancel
                    ) { }

                    Button(
                        "Continuar",
                        role: .destructive
                    ) {
                        showFinalDeleteAlert = true
                    }

                } message: {

                    Text(
                        "S'eliminaran totes les entrades registrades."
                    )
                }

                .alert(
                    "Confirmació final",
                    isPresented: $showFinalDeleteAlert
                ) {

                    Button(
                        "Cancel·lar",
                        role: .cancel
                    ) { }

                    Button(
                        "ESBORRA-HO TOT",
                        role: .destructive
                    ) {
                        deleteAllEntries()
                    }

                } message: {

                    Text(
                        "Aquesta acció no es pot desfer. Recomanem fer un còpia de seguretat abans d'esborrar-ho tot."
                    )
                }
        
    }
    
    private func clearMessages() {
        importMessage = nil
        deleteMessage = nil
        exportError = nil
        exportSuccess = false
    }

    // MARK: EXPORT

    private func runExport() {

        clearMessages()
        isExporting = true

        Task {

            do {

                clearMessages()
                
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

    //MARK: Export parcial
    
    private func runPartialExport() {

        clearMessages()
        isExporting = true

        Task {

            do {

                try await BackupManager.shared.exportSelected(
                    entries: entries,
                    customVariables: customVariables,
                    settings: settings,
                    allowedKeys: selectedExportKeys,
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

        previewData = nil
        selectedFile = nil

        do {

            let urls = try result.get()

            guard let url = urls.first else {
                return
            }
            
            previewData =
                try BackupManager.shared.previewCSV(
                    from: url,
                    existingEntries: entries
                )
            
            selectedFile = url
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
                    settings: settings
                )
            
            clearMessages()
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
    
    private func deleteAllEntries() {

        do {

            let all =
                try ctx.fetch(
                    FetchDescriptor<DailyEntry>()
                )

            let count = all.count

            all.forEach {
                ctx.delete($0)
            }

            try ctx.save()

            clearMessages()
            deleteMessage = "✅ S'han eliminat \(count) entrades"

        } catch {

            exportError = error.localizedDescription
        }
    }

}
