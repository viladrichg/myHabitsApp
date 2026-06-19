import SwiftUI
import SwiftData

struct CustomVariablesView: View {

    @Environment(\.appTheme) var theme
    @Environment(\.modelContext) private var ctx

    @Query(sort: \CustomVariable.order)
    private var variables: [CustomVariable]

    @State private var showingAdd = false
    @State private var editingVariable: CustomVariable?

    @State private var newLabel = ""
    @State private var newType = "boolean"
    @State private var newColor = "#06b6d4"

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

            Section("Built-in") {

                ForEach(builtInVariables) { v in

                    HStack {

                        Circle()
                            .fill(Color(hex: v.colorHex))
                            .frame(width: 14, height: 14)

                        VStack(alignment: .leading) {

                            Text(v.label)

                            Text(v.type)
                                .font(.caption)
                                .foregroundStyle(theme.secondary)
                        }

                        Spacer()
                    }
                }
            }
            .listRowBackground(theme.card)

            Section("Custom Variables") {

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

                    Label("Add Variable", systemImage: "plus")
                        .foregroundStyle(theme.accent)
                }
            }
            .listRowBackground(theme.card)
        }
        .scrollContentBackground(.hidden)
        .background(theme.bg.ignoresSafeArea())

        .navigationTitle("Custom Variables")

        .toolbar {
            EditButton()
        }

        .sheet(isPresented: $showingAdd) {
            addSheet
        }

        .sheet(item: $editingVariable) { variable in
            EditVariableSheet(variable: variable)
        }
    }

    // MARK: ADD

    private var addSheet: some View {

        NavigationStack {

            Form {

                Section("New Variable") {

                    TextField(
                        "Label",
                        text: $newLabel
                    )

                    Picker(
                        "Type",
                        selection: $newType
                    ) {

                        Text("Boolean")
                            .tag("boolean")

                        Text("Counter")
                            .tag("counter")
                    }

                    colorPicker(
                        selected: $newColor
                    )
                }
            }
            .navigationTitle("Add Variable")

            .toolbar {

                ToolbarItem(
                    placement: .cancellationAction
                ) {
                    Button("Cancel") {
                        showingAdd = false
                    }
                }

                ToolbarItem(
                    placement: .confirmationAction
                ) {

                    Button("Add") {

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
                            order: variables.count
                        )

                        ctx.insert(variable)

                        try? ctx.save()

                        newLabel = ""
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
            .navigationTitle("Edit Variable")

            .toolbar {

                ToolbarItem(
                    placement: .confirmationAction
                ) {

                    Button("Save") {

                        try? ctx.save()

                        dismiss()
                    }
                }
            }
        }
    }
}
