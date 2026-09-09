
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

    var ignoreZerosInStats: Bool = true
    
    var isHidden: Bool = false

    var createdAt: Date = Date()

    init(
        label: String,
        type: String = "boolean",
        colorHex: String,
        unit: String = "",
        order: Int,
        ignoreZerosInStats: Bool = true,
        isHidden: Bool = false
    ) {
        self.variableId = "cv_\(UUID().uuidString.prefix(8).lowercased())"
        self.label = label
        self.type = type
        self.colorHex = colorHex
        self.unit = unit
        self.order = order
        self.ignoreZerosInStats = ignoreZerosInStats
        self.isHidden = isHidden
    }
}
// MARK: - Built-in Variables

struct BuiltInVariable: Identifiable {

    var id: String { fieldKey }

    let fieldKey: String
    let label: String
    let colorHex: String
    let type: String

    func displayLabel(using settings: AppSettings?) -> String {

        settings?
            .variableLabels[fieldKey]
        ?? label
    }

    func displayColorHex(using settings: AppSettings?) -> String {

        settings?
            .variableColors[fieldKey]
        ?? colorHex
    }

    func displayColor(using settings: AppSettings?) -> Color {

        Color(
            hex: displayColorHex(
                using: settings
            )
        )
    }

    func isHidden(using settings: AppSettings?) -> Bool {

        settings?
            .hiddenVariables
            .contains(fieldKey)
        ?? false
    }
}

let builtInVariables: [BuiltInVariable] = [

    .init(
        fieldKey: "habit1",
        label: "Hàbit 1",
        colorHex: "#0077BB",
        type: "boolean"
    ),

    .init(
        fieldKey: "habit2",
        label: "Hàbit 2",
        colorHex: "#EE7733",
        type: "boolean"
    ),

    .init(
        fieldKey: "negative1",
        label: "Mal hàbit 1",
        colorHex: "#CC3311",
        type: "boolean"
    ),

    .init(
        fieldKey: "negative2",
        label: "Mal hàbit 2",
        colorHex: "#EE3377",
        type: "boolean"
    ),

    .init(
        fieldKey: "positive1",
        label: "Variable 1",
        colorHex: "#009988",
        type: "boolean"
    ),

    .init(
        fieldKey: "positive2",
        label: "Variable 2",
        colorHex: "#33BBEE",
        type: "boolean"
    ),

    .init(
        fieldKey: "positive3",
        label: "Variable 3",
        colorHex: "#CCBB44",
        type: "boolean"
    ),

    .init(
        fieldKey: "positive4",
        label: "Variable 4",
        colorHex: "#0077BB",
        type: "boolean"
    ),

    .init(
        fieldKey: "sports",
        label: "Llista",
        colorHex: "#6366f1",
        type: "boolean"
    ),

    .init(
        fieldKey: "counter",
        label: "Comptador",
        colorHex: "#8b5cf6",
        type: "counter"
    )
]
