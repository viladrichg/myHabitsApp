import SwiftUI
import SwiftData

struct BuiltInVariableEditorSheet: View {

    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var ctx

    @Bindable var settings: AppSettings

    let variable: BuiltInVariable

    @State private var label: String
    @State private var colorHex: String
    @State private var hidden: Bool

    init(
        variable: BuiltInVariable,
        settings: AppSettings
    ) {

        self.variable = variable
        self.settings = settings

        _label = State(
            initialValue:
                settings.variableLabels[
                    variable.fieldKey
                ] ?? variable.label
        )

        _colorHex = State(
            initialValue:
                settings.variableColors[
                    variable.fieldKey
                ] ?? variable.colorHex
        )

        _hidden = State(
            initialValue:
                settings.hiddenVariables.contains(
                    variable.fieldKey
                )
        )
    }

    private let colors = [
        "#06b6d4",
        "#f97316",
        "#84cc16",
        "#ec4899",
        "#a78bfa",
        "#14b8a6",
        "#f59e0b",
        "#ef4444",
        "#3b82f6",
        "#22c55e"
    ]

    var body: some View {

        NavigationStack {

            Form {

                Section("Nom") {

                    TextField(
                        "Nom",
                        text: $label
                    )
                }

                Section("Color") {

                    LazyVGrid(
                        columns: Array(
                            repeating: GridItem(.flexible()),
                            count: 5
                        )
                    ) {

                        ForEach(colors, id: \.self) { hex in

                            Circle()
                                .fill(Color(hex: hex))
                                .frame(width: 32, height: 32)

                                .overlay(
                                    Circle()
                                        .stroke(
                                            colorHex == hex
                                            ? Color.primary
                                            : Color.clear,
                                            lineWidth: 3
                                        )
                                )

                                .onTapGesture {
                                    colorHex = hex
                                }
                        }
                    }
                }

                Section("Opcions") {

                    Toggle(
                        "Ocultar variable",
                        isOn: $hidden
                    )

                    Button(
                        "Restaurar valors per defecte",
                        role: .destructive
                    ) {

                        label = variable.label
                        colorHex = variable.colorHex
                        hidden = false
                    }
                }
            }
            .navigationTitle(variable.label)

            .toolbar {

                ToolbarItem(
                    placement: .cancellationAction
                ) {

                    Button("Cancel·lar") {
                        dismiss()
                    }
                }

                ToolbarItem(
                    placement: .confirmationAction
                ) {

                    Button("Guardar") {

                        var labels =
                            settings.variableLabels

                        labels[
                            variable.fieldKey
                        ] = label

                        settings.variableLabels =
                            labels

                        var colors =
                            settings.variableColors

                        colors[
                            variable.fieldKey
                        ] = colorHex

                        settings.variableColors =
                            colors

                        var hiddenVariables =
                            settings.hiddenVariables

                        hiddenVariables.removeAll {
                            $0 == variable.fieldKey
                        }

                        if hidden {

                            hiddenVariables.append(
                                variable.fieldKey
                            )
                        }

                        settings.hiddenVariables =
                            hiddenVariables

                        try? ctx.save()

                        dismiss()
                    }
                }
            }
        }
    }
}
