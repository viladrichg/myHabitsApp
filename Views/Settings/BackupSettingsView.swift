import SwiftUI
import SwiftData

struct BackupSettingsView: View {
    @Environment(\.appTheme) var theme
    @Environment(\.modelContext) private var ctx
    @Bindable var settings: AppSettings
    @Query(sort: \DailyEntry.date, order: .reverse) private var entries: [DailyEntry]
    @Query(sort: \CustomVariable.order) private var customVariables: [CustomVariable]

    @State private var isExporting   = false
    @State private var exportError: String? = nil
    @State private var exportSuccess = false
    @State private var existingBackups: [URL] = []

    var body: some View {
        Form {
            Section("Automatic Backups") {
                Picker("Frequency", selection: $settings.backupFrequency) {
                    Text("Off").tag("none")
                    Text("Weekly").tag("weekly")
                    Text("Monthly").tag("monthly")
                }
                if let last = settings.lastBackupDate {
                    LabeledContent("Last backup", value: last.displayDate)
                }
                Text("Files are saved to the app's Documents folder and can be accessed via the Files app.")
                    .font(.caption)
                    .foregroundStyle(theme.secondary)
            }
            .listRowBackground(theme.card)

            Section("Manual Export") {
                Button {
                    runManualBackup()
                } label: {
                    if isExporting {
                        HStack {
                            ProgressView().tint(theme.accent)
                            Text("Preparing…").foregroundStyle(theme.secondary)
                        }
                    } else {
                        Label("Export CSV via Share Sheet", systemImage: "square.and.arrow.up")
                            .foregroundStyle(theme.accent)
                    }
                }
                .disabled(isExporting)

                if let err = exportError {
                    Text("Error: \(err)")
                        .font(.caption)
                        .foregroundStyle(.red)
                }
                if exportSuccess {
                    Text("✅ Backup shared successfully.")
                        .font(.caption)
                        .foregroundStyle(.green)
                }
            }
            .listRowBackground(theme.card)

            Section("Existing Backups (\(existingBackups.count))") {
                ForEach(existingBackups, id: \.path) { url in
                    Text(url.lastPathComponent)
                        .font(.caption)
                        .foregroundStyle(theme.secondary)
                }
                if existingBackups.isEmpty {
                    Text("No backups yet.")
                        .font(.caption)
                        .foregroundStyle(theme.secondary)
                }
            }
            .listRowBackground(theme.card)
        }
        .scrollContentBackground(.hidden)
        .background(theme.bg.ignoresSafeArea())
        .navigationTitle("Backup & Export")
        .onAppear { existingBackups = BackupManager.shared.listBackups() }
    }

    // MARK: - Manual backup

    private func runManualBackup() {
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let vc = scene.windows.first?.rootViewController
        else { return }

        isExporting   = true
        exportError   = nil
        exportSuccess = false

        Task {
            do {
                try await BackupManager.shared.runBackup(
                    entries: entries,
                    customVariables: customVariables,
                    settings: settings,
                    presentingViewController: vc
                )
                exportSuccess   = true
                existingBackups = BackupManager.shared.listBackups()
            } catch BackupManager.BackupError.noEntries {
                exportError = "No entries to export."
            } catch {
                exportError = error.localizedDescription
            }
            isExporting = false
        }
    }
}