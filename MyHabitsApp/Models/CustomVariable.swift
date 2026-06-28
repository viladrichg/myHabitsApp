import SwiftData
import SwiftUI
import Foundation

@Model
final class CustomVariable {

    @Attribute(.unique)
    var variableId: String

    var label: String

    var colorHex: String

    var type: String

    var unit: String = ""

    var order: Int

    var createdAt: Date = Date()

    init(
        label: String,
        type: String = "boolean",
        colorHex: String,
        unit: String = "",
        order: Int
    ) {
        self.variableId = "cv_\(UUID().uuidString.lowercased())"
        self.label = label
        self.type = type
        self.colorHex = colorHex
        self.unit = unit
        self.order = order
    }
}

struct BuiltInVariable: Identifiable {

    var id: String { fieldKey }

    let fieldKey: String
    let label: String
    let colorHex: String
    let type: String
}

let builtInVariables: [BuiltInVariable] = [

    .init(
        fieldKey: "workedAtJob",
        label: "Feina",
        colorHex: "#0077BB",
        type: "boolean"
    ),

    .init(
        fieldKey: "workedAtHome",
        label: "Casa",
        colorHex: "#EE7733",
        type: "boolean"
    ),

    .init(
        fieldKey: "fum",
        label: "Fum",
        colorHex: "#CC3311",
        type: "boolean"
    ),

    .init(
        fieldKey: "gat",
        label: "Gat",
        colorHex: "#EE3377",
        type: "boolean"
    ),

    .init(
        fieldKey: "meditation",
        label: "Meditació",
        colorHex: "#009988",
        type: "boolean"
    ),

    .init(
        fieldKey: "yoga",
        label: "Ioga",
        colorHex: "#33BBEE",
        type: "boolean"
    ),

    .init(
        fieldKey: "dibuix",
        label: "Dibuix",
        colorHex: "#CCBB44",
        type: "boolean"
    ),

    .init(
        fieldKey: "llegir",
        label: "Llegir",
        colorHex: "#0077BB",
        type: "boolean"
    ),

    .init(
        fieldKey: "sports",
        label: "Esport",
        colorHex: "#6366f1",
        type: "boolean"
    ),

    .init(
        fieldKey: "counter",
        label: "Pitells",
        colorHex: "#8b5cf6",
        type: "counter"
    )
]
