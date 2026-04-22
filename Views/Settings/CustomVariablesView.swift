import SwiftUI
import SwiftData

struct CustomVariablesView: View {
    @Environment(\.appTheme) var theme
    @Environment(\.modelContext) private var ctx
    @Query(sort: \CustomVariable.order) private var variables: [CustomVariable]

    @State private var showingAdd = false
    @State private var newLabel   = ""
    @State private var newType    = "boolean"
    @State private var newColor   = "#06b6d4"

    private let colorOptions = [
        "#06b6d4","#f97316","#84cc16","#ec4899","#a78bfa",
        "#14b8a6","#f59e0b","#ef4444","#3b82f6","#22c55e",
    ]

    var body: some View {
        Form {
            Section("Built-in (read-only)") {
                ForEach(builtInVariables) { v in
                    HStack {
                        Circle().fill(Color(hex: v.colorHex)).frame(width: 12, height: 12)
                        Text(v.label).foregroundStyle(theme.text)
                        Spacer()
                        Text(v.type).font(.caption).foregroundStyle(theme.secondary)
                    }
                }
            }
            .listRowBackground(theme.card)

            Section("Custom Variables") {
                ForEach(variables) { v in
                    HStack {
                        Circle().fill(Color(hex: v.colorHex)).frame(width: 12, height: 12)
                        VStack(alignment: .leading) {
                            Text(v.label).foregroundStyle(theme.text)
                            Text(v.type).font(.caption).foregroundStyle(theme.secondary)
                        }
                        Spacer()
                        Text(v.variableId).font(.caption2).foregroundStyle(theme.border)
                    }
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
        .toolbar { EditButton() }
        .sheet(isPresented: $showingAdd) { addSheet }
    }

    private var addSheet: some View {
        NavigationStack {
            Form {
                Section("New Variable") {
                    TextField("Label", text: $newLabel)
                    Picker("Type", selection: $newType) {
                        Text("Boolean (on/off)").tag("boolean")
                        Text("Counter (0–25)").tag("counter")
                    }
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 5), spacing: 8) {
                        ForEach(colorOptions, id: \.self) { hex in
                            Circle()
                                .fill(Color(hex: hex))
                                .frame(width: 32, height: 32)
                                .overlay(
                                    newColor == hex
                                    ? Circle().stroke(Color.white, lineWidth: 2)
                                    : nil
                                )
                                .onTapGesture { newColor = hex }
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            .navigationTitle("Add Variable")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showingAdd = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        guard !newLabel.trimmingCharacters(in: .whitespaces).isEmpty else { return }
                        let v = CustomVariable(
                            label: newLabel.trimmingCharacters(in: .whitespaces),
                            type: newType,
                            colorHex: newColor,
                            order: variables.count
                        )
                        ctx.insert(v)
                        try? ctx.save()
                        newLabel = ""; showingAdd = false
                    }
                    .disabled(newLabel.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .presentationDetents([.medium])
    }

    private func deleteVariables(at offsets: IndexSet) {
        offsets.forEach { ctx.delete(variables[$0]) }
        try? ctx.save()
    }
}