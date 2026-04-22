import Foundation
import SwiftData

/// Step 4 — Backup strategy
///
/// WHY this approach is correct for iOS:
/// • iOS apps cannot send email in the background without user interaction.
/// • The UIActivityViewController (share sheet) gives the user full control:
///   AirDrop, Files, Mail, Dropbox, iCloud Drive, WhatsApp — anything.
/// • Writing to the Documents folder first means the file is accessible via
///   the Files app if the user enables "Files app access" in Info.plist.
/// • No server, no network permission needed.
@MainActor
final class BackupManager {
    static let shared = BackupManager()
    private init() {}

    enum BackupError: Error {
        case noEntries
        case writeFailure(Error)
        case sharingUnavailable
    }

    // MARK: - Manual backup (called from Settings)

    func runBackup(
        entries: [DailyEntry],
        customVariables: [CustomVariable],
        settings: AppSettings,
        presentingViewController: UIViewController?
    ) async throws {
        guard !entries.isEmpty else { throw BackupError.noEntries }

        let csv      = CSVExporter.export(entries: entries, customVariables: customVariables)
        let fileName = "daily_tracker_backup_\(Date().isoDate).csv"
        let url      = documentsURL(fileName: fileName)

        do {
            try csv.write(to: url, atomically: true, encoding: .utf8)
        } catch {
            throw BackupError.writeFailure(error)
        }

        // Share sheet
        guard let vc = presentingViewController else {
            throw BackupError.sharingUnavailable
        }

        await withCheckedContinuation { continuation in
            let activity = UIActivityViewController(
                activityItems: [url],
                applicationActivities: nil
            )
            activity.completionWithItemsHandler = { _, _, _, _ in
                continuation.resume()
            }
            vc.present(activity, animated: true)
        }

        // Record timestamp
        settings.lastBackupDate = Date()
        settings.updatedAt = Date()
    }

    // MARK: - Scheduled backup check (call from app launch)

    func checkScheduledBackup(
        settings: AppSettings,
        entries: [DailyEntry],
        customVariables: [CustomVariable]
    ) {
        guard settings.isBackupDue else { return }
        // Write silently to Documents; user can share from Files app later.
        let csv      = CSVExporter.export(entries: entries, customVariables: customVariables)
        let fileName = "daily_tracker_auto_\(Date().isoDate).csv"
        let url      = documentsURL(fileName: fileName)
        try? csv.write(to: url, atomically: true, encoding: .utf8)
        settings.lastBackupDate = Date()
    }

    // MARK: - List existing backups

    func listBackups() -> [URL] {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return (try? FileManager.default.contentsOfDirectory(
            at: docs, includingPropertiesForKeys: [.creationDateKey], options: .skipsHiddenFiles
        ))?.filter { $0.pathExtension == "csv" }
          .sorted { ($0.path) > ($1.path) } ?? []
    }

    // MARK: - Private

    private func documentsURL(fileName: String) -> URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent(fileName)
    }
}