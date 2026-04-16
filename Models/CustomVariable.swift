import SwiftData
import Foundation

/// A user-defined tracked variable ("boolean" or "counter").
/// The `variableId` is the stable key used in DailyEntry.customValuesJSON
/// and takes the form "cv_<uuid>".
@Model
final class CustomVariable {
    @Attribute(.unique) var variableId: String
    var label: String
    var colorHex: String
    var type: String    // "boolean" | "counter"
    var order: Int
    var createdAt: Date = Date()

    init(label: String, type: String = "boolean", colorHex: String, order: Int) {
        self.variableId = "cv_\(UUID().uuidString.lowercased())"
        self.label      = label
        self.type       = type
        self.colorHex   = colorHex
        self.order      = order
    }
}

// MARK: - Built-in variable definitions (not stored, always present)

struct BuiltInVariable: Identifiable {
    var id: String { fieldKey }
    let fieldKey:  String   // matches DailyEntry field name
    let label:     String
    let colorHex:  String
    let type:      String   // "boolean" | "counter"
}

let builtInVariables: [BuiltInVariable] = [
    .init(fieldKey: "workedAtJob",  label: "Worked at Job",  colorHex: "#0077BB", type: "boolean"),
    .init(fieldKey: "workedAtHome", label: "Worked at Home", colorHex: "#EE7733", type: "boolean"),
    .init(fieldKey: "fum",          label: "Fum",            colorHex: "#CC3311", type: "boolean"),
    .init(fieldKey: "gat",          label: "Gat",            colorHex: "#EE3377", type: "boolean"),
    .init(fieldKey: "meditation",   label: "Meditation",     colorHex: "#009988", type: "boolean"),
    .init(fieldKey: "yoga",         label: "Yoga",           colorHex: "#33BBEE", type: "boolean"),
    .init(fieldKey: "dibuix",       label: "Dibuix",         colorHex: "#CCBB44", type: "boolean"),
    .init(fieldKey: "llegir",       label: "Llegir",         colorHex: "#0077BB", type: "boolean"),
    .init(fieldKey: "sports",       label: "Sports (any)",   colorHex: "#6366f1", type: "boolean"),
    .init(fieldKey: "counter",      label: "Counter",        colorHex: "#8b5cf6", type: "counter"),
]
