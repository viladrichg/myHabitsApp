import Foundation
import SwiftData
import UIKit

@MainActor
final class BackupManager {
    static let shared = BackupManager()
    private init() {}
    
    enum BackupError: Error {
        case noEntries
        case writeFailure(Error)
        case sharingUnavailable
    }
    
    enum ImportMode {
        case addNewOnly
        case updateExisting
        case replace
    }
    
    struct ImportResult {
        
        let inserted: Int
        let updated: Int
        let skipped: Int
    }
    
    struct CSVPreviewData {

        let total: Int

        let newEntries: Int

        let existingEntries: Int

        let firstDate: String?

        let lastDate: String?

        let conflictDates: [String]
    }
    
    
    // MARK: EXPORT
    
    func runBackup(
        entries: [DailyEntry],
        customVariables: [CustomVariable],
        settings: AppSettings,
        presentingViewController: UIViewController?
    ) async throws {
        
        guard !entries.isEmpty else {
            throw BackupError.noEntries
        }
        
        let csv = CSVExporter.export(
            entries: entries,
            customVariables: customVariables,
            settings: settings
        )
        
        let url = documentsURL(
            fileName: "backup_\(Date().isoDate).csv"
        )
        
        try csv.write(
            to: url,
            atomically: true,
            encoding: .utf8
        )
        
        guard let vc = UIApplication.shared.topMostViewController() else {
            throw BackupError.sharingUnavailable
        }
        
        await withCheckedContinuation { continuation in
            
            let activity = UIActivityViewController(
                activityItems: [url],
                applicationActivities: nil
            )
            
            activity.completionWithItemsHandler = { _,_,_,_ in
                continuation.resume()
            }
            
            vc.present(activity, animated: true)
        }
        
        settings.lastBackupDate = Date()
        settings.updatedAt = Date()
    }
    
    // MARK: TEMPLATE CSV ✅ NEW
    
    func exportTemplateCSV() async throws {
        
        let template =
"""
date,bedtime,wakeup_time,sleep_quality,worked_at_job,worked_at_home,fum,gat,meditation,yoga,dibuix,llegir,counter,sports,notes
2026-06-01,23:00,07:00,8,1,0,0,1,1,0,0,1,10,Running|Gym,Good day
2026-06-02,22:45,07:15,7,1,0,0,0,1,1,0,0,5,Yoga,Felt relaxed
2026-06-03,23:30,06:50,6,0,1,1,0,0,0,1,0,15,Cycling,Tired
2026-06-04,22:50,07:10,9,1,0,0,0,1,1,0,1,20,Gym,Excellent focus
2026-06-05,23:15,07:05,8,1,0,0,1,1,0,0,0,10,Running,Normal day
2026-06-06,00:00,08:00,7,0,1,0,0,0,1,1,0,5,Hiking,Weekend
2026-06-07,22:40,07:20,9,0,1,0,0,1,1,0,1,20,Yoga|Gym,Very productive
"""
        
        let url = documentsURL(
            fileName: "template_\(UUID().uuidString).csv"
        )
        
        try template.write(
            to: url,
            atomically: true,
            encoding: .utf8
        )
        
        guard let vc = UIApplication.shared.topMostViewController() else {
            throw BackupError.sharingUnavailable
        }
        
        await withCheckedContinuation { continuation in
            
            let activity = UIActivityViewController(
                activityItems: [url],
                applicationActivities: nil
            )
            
            activity.completionWithItemsHandler = { _,_,_,_ in
                continuation.resume()
            }
            
            vc.present(activity, animated: true)
        }
    }
    
    // MARK: PREVIEW

    func previewCSV(
        from url: URL,
        existingEntries: [DailyEntry]
    ) throws -> CSVPreviewData {
        
        let accessGranted =
        url.startAccessingSecurityScopedResource()
        
        defer {
            
            if accessGranted {
                url.stopAccessingSecurityScopedResource()
            }
        }
        
        let content = try String(
            contentsOf: url,
            encoding: .utf8
        )
        
        let lines = content.components(separatedBy: "\n")
        
        guard lines.count > 1 else {
            return CSVPreviewData(
                total: 0,
                newEntries: 0,
                existingEntries: 0,
                firstDate: nil,
                lastDate: nil,
                conflictDates: []
        
            )
        }
        
        guard lines.count > 2 else {
            return CSVPreviewData(
                total: 0,
                newEntries: 0,
                existingEntries: 0,
                firstDate: nil,
                lastDate: nil,
                conflictDates: []
            )
        }
        
        let labels = lines[0].components(separatedBy: ",")
        let headers = lines[1].components(separatedBy: ",")
        
        
        let requiredColumns = [
            "date"
        ]
        
        for column in requiredColumns {
            
            guard headers.contains(column) else {
                
                throw NSError(
                    domain: "CSV",
                    code: 2,
                    userInfo: [
                        NSLocalizedDescriptionKey:
                            "Falta la columna obligatòria '\(column)'"
                    ]
                )
            }
        }
        
        guard let dateIndex = headers.firstIndex(of: "date") else {
            
            return CSVPreviewData(
                total: 0,
                newEntries: 0,
                existingEntries: 0,
                firstDate: nil,
                lastDate: nil,
                conflictDates: []
            )
        }
        
        var dates: [String] = []
        var newEntries = 0
        var existingEntriesCount = 0
        var conflictDates: [String] = []
        
        for line in lines.dropFirst(2) where !line.isEmpty {
            
            let values = parse(line)
            
            guard values.count > dateIndex else {
                continue
            }
            
            let date = values[dateIndex]
            
            dates.append(date)

            if existingEntries.contains(where: { $0.date == date }) {

                existingEntriesCount += 1
                conflictDates.append(date)

            } else {

                newEntries += 1
            }
            
        }
        
        let sorted = dates.sorted()

        return CSVPreviewData(
            total: sorted.count,
            newEntries: newEntries,
            existingEntries: existingEntriesCount,
            firstDate: sorted.first,
            lastDate: sorted.last,
            conflictDates: conflictDates.sorted()
        )
    }
        
    // MARK: IMPORT

    func importCSV(
        from url: URL,
        context: ModelContext,
        mode: ImportMode
    ) throws -> ImportResult {

        let accessGranted =
            url.startAccessingSecurityScopedResource()

        defer {

            if accessGranted {
                url.stopAccessingSecurityScopedResource()
            }
        }

        let content = try String(
            contentsOf: url,
            encoding: .utf8
        )

        let lines = content.components(separatedBy: "\n")

        guard lines.count > 1 else {

            return ImportResult(
                inserted: 0,
                updated: 0,
                skipped: 0
            )
        }

        guard lines.count > 2 else {

            return ImportResult(
                inserted: 0,
                updated: 0,
                skipped: 0
            )
        }

        let labels = lines[0].components(separatedBy: ",")
        let headers = lines[1].components(separatedBy: ",")

        _ = labels

        var inserted = 0
        var updated = 0
        var skipped = 0

        if mode == .replace {

            let all = try context.fetch(
                FetchDescriptor<DailyEntry>()
            )

            all.forEach {
                context.delete($0)
            }
        }

        for line in lines.dropFirst(2) where !line.isEmpty {

            let values = parse(line)

            guard values.count == headers.count else {
                skipped += 1
                continue
            }

            let dict = Dictionary(
                uniqueKeysWithValues: zip(headers, values)
            )
    
            guard let date = dict["date"],
                  !date.isEmpty
            else {
                skipped += 1
                continue
            }

            let existing = try context.fetch(
                FetchDescriptor<DailyEntry>(
                    predicate: #Predicate {
                        $0.date == date
                    }
                )
            ).first

            if mode == .addNewOnly && existing != nil {

                skipped += 1
                continue
            }
            
            let entry = existing ?? DailyEntry(date: date)

            if existing == nil {

                context.insert(entry)
                inserted += 1

            } else {

                updated += 1
            }

            if let value = dict["bedTime"] {
                entry.bedTime = value
            }

            if let value = dict["wakeUpTime"] {
                entry.wakeUpTime = value
            }

            if let value = dict["sleepQuality"] {
                entry.sleepQuality = Int(value)
            }

            if let value = dict["workedAtJob"] {
                entry.workedAtJob = value == "1"
            }

            if let value = dict["workedAtHome"] {
                entry.workedAtHome = value == "1"
            }

            if let value = dict["fum"] {
                entry.fum = value == "1"
            }

            if let value = dict["gat"] {
                entry.gat = value == "1"
            }

            if let value = dict["meditation"] {
                entry.meditation = value == "1"
            }

            if let value = dict["yoga"] {
                entry.yoga = value == "1"
            }

            if let value = dict["dibuix"] {
                entry.dibuix = value == "1"
            }

            if let value = dict["llegir"] {
                entry.llegir = value == "1"
            }

            if let value = dict["counter"] {
                entry.counter = Int(value)
            }

            if let value = dict["notes"] {
                entry.notes = value
            }

            if let sports = dict["sports"] {

                entry.sports =
                    sports
                        .split(separator: "|")
                        .map(String.init)
            }

            var customValues = entry.customValues

            for (key, value) in dict {

                guard key.hasPrefix("cv_") else {
                    continue
                }

                customValues[key] = Int(value) ?? 0
            }

            entry.customValues = customValues
            entry.updatedAt = Date()
        }

        try context.save()

        return ImportResult(
            inserted: inserted,
            updated: updated,
            skipped: skipped
        )
    }
                // MARK: HELPERS

                private func parse(_ line: String) -> [String] {

                    var result: [String] = []
                    var current = ""
                    var insideQuotes = false

                    for char in line {

                        if char == "\"" {
                            insideQuotes.toggle()

                        } else if char == "," && !insideQuotes {
                            result.append(current)
                            current = ""

                        } else {
                            current.append(char)
                        }
                    }

                    result.append(current)
                    return result
                }

                private func documentsURL(fileName: String) -> URL {

                    FileManager.default.urls(
                        for: .documentDirectory,
                        in: .userDomainMask
                    )[0]
                    .appendingPathComponent(fileName)
                }
            }
