import SwiftUI
import SwiftData

struct CustomVariablesView: View {

    @Environment(\.appTheme) var theme
    @Environment(\.modelContext) private var ctx

    @Query(sort: \CustomVariable.order)
    private var variables: [CustomVariable]
    @Query(sort: \AppSettings.createdAt)
    private var allSettings: [AppSettings]

    private var settings: AppSettings? {
        allSettings.first
    }
    @State private var showingAdd = false
    @State private var editingVariable: CustomVariable?
    @State private var editingBuiltIn: BuiltInVariable?

    @State private var newLabel = ""
    @State private var newType = "boolean"
    @State private var newColor = "#06b6d4"
    @State private var newUnit = ""

    private let colorOptions = [
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

        Form {

            Section("Variables integrades") {

                ForEach(builtInVariables) { v in

                    Button {

                        editingBuiltIn = v

                    } label: {

                        HStack {

                            Circle()
                                .fill(
                                    settings != nil
                                    ? v.displayColor(using: settings)
                                    : Color(hex: v.colorHex)
                                )
                                .frame(width: 14, height: 14)

                            VStack(alignment: .leading) {

                                Text(
                                    settings != nil
                                    ? v.displayLabel(using: settings)
                                    : v.label
                                )

                                Text(v.type)
                                    .font(.caption)
                                    .foregroundStyle(theme.secondary)
                            }

                            Spacer()

                            if settings?.hiddenVariables.contains(v.fieldKey) == true {

                                Image(systemName: "eye.slash")
                                    .foregroundStyle(theme.secondary)
                            }

                            Image(systemName: "pencil")
                                .foregroundStyle(theme.secondary)
                        }
                    }
                    .foregroundStyle(theme.text)
                }
            }
            .listRowBackground(theme.card)

            Section("Variables personalitzades") {

                ForEach(variables) { variable in

                    Button {

                        editingVariable = variable

                    } label: {

                        HStack {

                            Circle()
                                .fill(Color(hex: variable.colorHex))
                                .frame(width: 14, height: 14)

                            VStack(alignment: .leading) {

                                Text(variable.label)

                                Text(variable.type)
                                    .font(.caption)
                                    .foregroundStyle(theme.secondary)
                            }

                            Spacer()

                            Image(systemName: "pencil")
                                .foregroundStyle(theme.secondary)
                        }
                    }
                    .foregroundStyle(theme.text)
                }
                .onDelete(perform: deleteVariables)

                Button {

                    showingAdd = true

                } label: {

                    Label("Afegir variable", systemImage: "plus")
                        .foregroundStyle(theme.accent)
                }
            }
            .listRowBackground(theme.card)
        }
        .scrollContentBackground(.hidden)
        .background(theme.bg.ignoresSafeArea())

        .navigationTitle("Variables personalitzades")

        .toolbar {
            EditButton()
        }

        .sheet(isPresented: $showingAdd) {
            addSheet
        }

        .sheet(item: $editingVariable) { variable in
            EditVariableSheet(variable: variable)
        }
        .sheet(item: $editingBuiltIn) { variable in

            if let settings {

                BuiltInVariableEditorSheet(
                    variable: variable,
                    settings: settings
                )
            }
        }
    }

    // MARK: ADD

    private var addSheet: some View {

        NavigationStack {

            Form {

                Section("Variable nova") {

                    TextField(
                        "Label",
                        text: $newLabel
                    )

                    Picker(
                        "Type",
                        selection: $newType
                    ) {

                        Text("Booleà")
                            .tag("boolean")

                        Text("Comptador")
                            .tag("counter")
                    }
                    
                    TextField(
                        "Unitat (kg, km, %, L...)",
                        text: $newUnit
                    )

                    colorPicker(
                        selected: $newColor
                    )
                }
            }
            .navigationTitle("Afegir Variable")

            .toolbar {

                ToolbarItem(
                    placement: .cancellationAction
                ) {
                    Button("Cancel·lar") {
                        showingAdd = false
                    }
                }

                ToolbarItem(
                    placement: .confirmationAction
                ) {

                    Button("Afegir") {

                        let trimmed =
                        newLabel.trimmingCharacters(
                            in: .whitespaces
                        )

                        guard !trimmed.isEmpty else {
                            return
                        }

                        let variable =
                        CustomVariable(
                            label: trimmed,
                            type: newType,
                            colorHex: newColor,
                            unit: newUnit,
                            order: variables.count
                        )

                        ctx.insert(variable)

                        try? ctx.save()

                        newLabel = ""
                        newUnit = ""
                        showingAdd = false
                    }
                }
            }
        }
    }

    private func colorPicker(
        selected: Binding<String>
    ) -> some View {

        LazyVGrid(
            columns: Array(
                repeating: GridItem(.flexible()),
                count: 5
            )
        ) {

            ForEach(colorOptions, id: \.self) { hex in

                Circle()
                    .fill(Color(hex: hex))
                    .frame(width: 32, height: 32)

                    .overlay(
                        Circle()
                            .stroke(
                                selected.wrappedValue == hex
                                ? Color.primary
                                : Color.clear,
                                lineWidth: 3
                            )
                    )

                    .onTapGesture {
                        selected.wrappedValue = hex
                    }
            }
        }
    }

    private func deleteVariables(
        at offsets: IndexSet
    ) {

        offsets.forEach {
            ctx.delete(variables[$0])
        }

        try? ctx.save()
    }
}

private struct EditVariableSheet: View {

    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var ctx

    @Bindable var variable: CustomVariable

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

                TextField(
                    "Label",
                    text: $variable.label
                )
                TextField(
                    "Unitat",
                    text: $variable.unit
                )

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
                                        variable.colorHex == hex
                                        ? Color.primary
                                        : Color.clear,
                                        lineWidth: 3
                                    )
                            )

                            .onTapGesture {
                                variable.colorHex = hex
                            }
                    }
                }
            }
            .navigationTitle("Editar variable")

            .toolbar {

                ToolbarItem(
                    placement: .confirmationAction
                ) {

                    Button("Guardar") {

                        try? ctx.save()

                        dismiss()
                    }
                }
            }
        }
    }
}
