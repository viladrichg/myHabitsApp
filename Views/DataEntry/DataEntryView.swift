import SwiftUI
import SwiftData

struct DataEntryView: View {
    @Environment(\.appTheme) var theme
    @Environment(\.modelContext) private var ctx
    @Query(sort: \DailyEntry.date, order: .reverse) private var entries: [DailyEntry]
    @Query(sort: \CustomSport.name) private var customSports: [CustomSport]
    @Query(sort: \CustomVariable.order) private var customVariables: [CustomVariable]

    @State private var selectedDate = Date()
    @State private var entry: DailyEntry? = nil
    @State private var saveDebounce: Task<Void, Never>? = nil

    private var dateString: String { selectedDate.isoDate }

    var body: some View {
        NavigationStack {
            Form {
                datePicker
                if let e = entry {
                    sleepSection(e)
                    workSection(e)
                    objectivesSection(e)
                    activitiesSection(e)
                    sportsSection(e)
                    counterSection(e)
                    customVariablesSection(e)
                    notesSection(e)
                    deleteSection(e)
                }
            }
            .scrollContentBackground(.hidden)
            .background(theme.bg.ignoresSafeArea())
            .navigationTitle("Daily Entry")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear { loadOrCreate() }
            .onChange(of: selectedDate) { loadOrCreate() }
        }
    }

    // MARK: - Sections

    private var datePicker: some View {
        Section {
            DatePicker("Date", selection: $selectedDate, displayedComponents: .date)
                .datePickerStyle(.compact)
        }
        .listRowBackground(theme.card)
    }

    private func sleepSection(_ e: DailyEntry) -> some View {
        Section("Sleep") {
            TimePicker(label: "Bedtime",   value: Binding(
                get: { e.bedtime    ?? "" },
                set: { e.bedtime    = $0; save(e) }
            ))
            TimePicker(label: "Wake-up",   value: Binding(
                get: { e.wakeupTime ?? "" },
                set: { e.wakeupTime = $0; save(e) }
            ))
            if let h = e.sleepHours {
                LabeledContent("Hours", value: String(format: "%.1f h", h))
            }
            Stepper(
                "Quality: \(e.sleepQuality.map { String($0) } ?? "–") / 10",
                value: Binding(
                    get: { e.sleepQuality ?? 0 },
                    set: { e.sleepQuality = $0 == 0 ? nil : $0; save(e) }
                ),
                in: 0...10
            )
        }
        .listRowBackground(theme.card)
    }

    private func workSection(_ e: DailyEntry) -> some View {
        Section("Work") {
            Toggle("Worked at Office", isOn: Binding(
                get: { e.workedAtJob },
                set: { v in e.workedAtJob = v; if v { e.workedAtHome = false }; save(e) }
            ))
            Toggle("Worked at Home", isOn: Binding(
                get: { e.workedAtHome },
                set: { v in e.workedAtHome = v; if v { e.workedAtJob = false }; save(e) }
            ))
        }
        .listRowBackground(theme.card)
    }

    private func objectivesSection(_ e: DailyEntry) -> some View {
        Section("Objectives (missed)") {
            Toggle("Fum",  isOn: Binding(get: { e.fum }, set: { e.fum = $0; save(e) }))
            Toggle("Gat",  isOn: Binding(get: { e.gat }, set: { e.gat = $0; save(e) }))
        }
        .listRowBackground(theme.card)
    }

    private func activitiesSection(_ e: DailyEntry) -> some View {
        Section("Activities") {
            Toggle("Meditation", isOn: Binding(get: { e.meditation }, set: { e.meditation = $0; save(e) }))
            Toggle("Yoga",       isOn: Binding(get: { e.yoga },       set: { e.yoga       = $0; save(e) }))
            Toggle("Dibuix",     isOn: Binding(get: { e.dibuix },     set: { e.dibuix     = $0; save(e) }))
            Toggle("Llegir",     isOn: Binding(get: { e.llegir },     set: { e.llegir     = $0; save(e) }))
        }
        .listRowBackground(theme.card)
    }

    private func sportsSection(_ e: DailyEntry) -> some View {
        Section("Sports") {
            ForEach(customSports) { sport in
                Toggle(sport.name, isOn: Binding(
                    get: { e.sports.contains(sport.name) },
                    set: { on in
                        var s = e.sports
                        if on { if !s.contains(sport.name) { s.append(sport.name) } }
                        else   { s.removeAll { $0 == sport.name } }
                        e.sports = s
                        save(e)
                    }
                ))
            }
        }
        .listRowBackground(theme.card)
    }

    private func counterSection(_ e: DailyEntry) -> some View {
        Section("Counter") {
            Stepper(
                "Value: \(e.counter ?? 0)",
                value: Binding(
                    get: { e.counter ?? 0 },
                    set: { e.counter = $0; save(e) }
                ),
                in: 0...25
            )
        }
        .listRowBackground(theme.card)
    }

    private func customVariablesSection(_ e: DailyEntry) -> some View {
        Group {
            if !customVariables.isEmpty {
                Section("Custom Variables") {
                    ForEach(customVariables) { v in
                        if v.type == "boolean" {
                            Toggle(v.label, isOn: Binding(
                                get: { (e.customValues[v.variableId] ?? 0) > 0 },
                                set: { on in
                                    var cv = e.customValues
                                    cv[v.variableId] = on ? 1 : 0
                                    e.customValues = cv
                                    save(e)
                                }
                            ))
                        } else {
                            Stepper(
                                "\(v.label): \(e.customValues[v.variableId] ?? 0)",
                                value: Binding(
                                    get: { e.customValues[v.variableId] ?? 0 },
                                    set: { val in
                                        var cv = e.customValues
                                        cv[v.variableId] = val
                                        e.customValues = cv
                                        save(e)
                                    }
                                ),
                                in: 0...25
                            )
                        }
                    }
                }
                .listRowBackground(theme.card)
            }
        }
    }

    private func notesSection(_ e: DailyEntry) -> some View {
        Section("Notes") {
            TextEditor(text: Binding(
                get: { e.notes ?? "" },
                set: { e.notes = $0.isEmpty ? nil : $0; save(e) }
            ))
            .frame(minHeight: 80)
        }
        .listRowBackground(theme.card)
    }

    private func deleteSection(_ e: DailyEntry) -> some View {
        Section {
            Button(role: .destructive) {
                ctx.delete(e)
                try? ctx.save()
                self.entry = nil
            } label: {
                Label("Delete entry for \(selectedDate.displayDate)", systemImage: "trash")
            }
        }
        .listRowBackground(theme.card)
    }

    // MARK: - Load / Create

    private func loadOrCreate() {
        if let existing = entries.first(where: { $0.date == dateString }) {
            self.entry = existing
        } else {
            let e = DailyEntry(date: dateString)
            ctx.insert(e)
            try? ctx.save()
            self.entry = e
        }
    }

    private func save(_ e: DailyEntry) {
        e.updatedAt = Date()
        saveDebounce?.cancel()
        saveDebounce = Task {
            try? await Task.sleep(nanoseconds: 300_000_000) // 300ms debounce
            try? ctx.save()
        }
    }
}

// MARK: - Time Picker helper

private struct TimePicker: View {
    let label: String
    @Binding var value: String

    @State private var time: Date = Date()
    @State private var isSet: Bool = false

    var body: some View {
        HStack {
            Toggle(label, isOn: $isSet)
                .onChange(of: isSet) { on in
                    value = on ? formatTime(time) : ""
                }
            if isSet {
                DatePicker("", selection: $time, displayedComponents: .hourAndMinute)
                    .labelsHidden()
                    .onChange(of: time) { value = formatTime(time) }
            }
        }
        .onAppear { loadValue() }
    }

    private func loadValue() {
        if let parts = value.parseHHmm() {
            isSet = true
            var c = DateComponents()
            c.hour = parts.hour; c.minute = parts.minute
            time = Calendar.current.date(from: c) ?? Date()
        }
    }

    private func formatTime(_ d: Date) -> String {
        let c = Calendar.current.dateComponents([.hour, .minute], from: d)
        return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
    }
}