import SwiftUI
import SwiftData

struct DataEntryView: View {
    @Environment(\.appTheme) var theme
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss

    @Binding var selectedTab: Int   // ✅ CHANGE
    let initialDate: Date?
    
    @Query(sort: \DailyEntry.date, order: .reverse) private var entries: [DailyEntry]
    @Query(sort: \CustomSport.name) private var customSports: [CustomSport]
    @Query(sort: \CustomVariable.order) private var customVariables: [CustomVariable]
    @Query(sort: \AppSettings.createdAt)
    private var allSettings: [AppSettings]

    private var settings: AppSettings? {
        allSettings.first
    }

    @State private var selectedDate: Date
    @State private var entry: DailyEntry? = nil
    @State private var newSport = ""
    @State private var isEditingSports = false
    @State private var showDeleteAlert = false
    @State private var sleepQualityDraft = 5.0
    
    init(
        selectedTab: Binding<Int>,
        initialDate: Date? = nil
    ) {
        self._selectedTab = selectedTab
        self.initialDate = initialDate
        self._selectedDate = State(
            initialValue: initialDate ?? Date()
        )
    }

    @State private var notesDraft = ""
    @FocusState private var isEditingNotes: Bool

    private var dateString: String { selectedDate.isoDate }

    var body: some View {
        
            ScrollView {
                VStack(spacing: 20) {
                    datePicker
                    
                    Button {

                        copyPreviousEntry()

                    } label: {

                        Label(
                            "Copiar entrada anterior",
                            systemImage: "doc.on.doc"
                        )
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(theme.card)
                        .foregroundStyle(theme.accent)
                        .clipShape(
                            RoundedRectangle(cornerRadius: 12)
                        )
                    }
                    
                    if let e = entry {
                    
                        sleepSection(e)
                        workSection(e)
                        objectivesSection(e)
                        activitiesSection(e)
                        sportsSection(e)
                        counterSection(e)
                        customVariablesSection(e)
                        notesSection(e)
                        saveSection()
                        deleteSection()
                    }
                }
                .padding()
            }
            .background(theme.bg.ignoresSafeArea())
            .onTapGesture { isEditingNotes = false } // ✅ CHANGE
            .navigationTitle("Nova entrada")
            .onAppear {
                
                print(
                    "DATAENTRY:",
                    initialDate?.isoDate ?? "TODAY"
                )
                
                if let initialDate {

                    selectedDate = initialDate
                }
                
                loadOrCreate()
            }
            .onChange(of: selectedDate) { loadOrCreate() }
            .alert(
                "Segur que vols eliminar el dia?",
                isPresented: $showDeleteAlert
            ) {

                Button("Cancel·lar", role: .cancel) {}

                Button("Eliminar", role: .destructive) {

                    guard let e = entry else { return }

                    ctx.delete(e)

                    try? ctx.save()

                    selectedTab = 2

                    dismiss()
                }

            }
        
    }

    // MARK: DATE

    
    private var datePicker: some View {

        VStack(spacing: 12) {

            HStack {

                Button {

                    selectedDate = Calendar.current.date(
                        byAdding: .day,
                        value: -1,
                        to: selectedDate
                    ) ?? selectedDate

                } label: {

                    Image(systemName: "chevron.left")
                        .font(.headline)
                }

                Spacer()

                DatePicker(
                    "",
                    selection: $selectedDate,
                    displayedComponents: .date
                )
                .labelsHidden()

                Spacer()

                Button {

                    selectedDate = Calendar.current.date(
                        byAdding: .day,
                        value: 1,
                        to: selectedDate
                    ) ?? selectedDate

                } label: {

                    Image(systemName: "chevron.right")
                        .font(.headline)
                }
            }

            Button(
                Calendar.current.isDateInToday(selectedDate)
                ? "Avui"
                : "Tornar a Avui"
            ) {
                selectedDate = Date()
            }
            .font(.caption)
            .foregroundStyle(theme.accent)
        }
        .padding()
        .background(theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    // MARK: SLEEP

    private func sleepSection(_ e: DailyEntry) -> some View {

        section("Son") {

            HStack(alignment: .top, spacing: 24) {

                VStack(alignment: .leading) {

                    Text("Llevar-se")
                        .font(.caption)
                        .foregroundStyle(theme.secondary)

                    TimePicker(
                        label: "",
                        value: Binding(
                            get: { e.wakeUpTime ?? "" },
                            set: { e.wakeUpTime = $0 }
                        )
                    )
                }

                VStack(alignment: .leading) {

                    Text("Anar a dormir")
                        .font(.caption)
                        .foregroundStyle(theme.secondary)

                    TimePicker(
                        label: "",
                        value: Binding(
                            get: { e.bedTime ?? "" },
                            set: { e.bedTime = $0 }
                        )
                    )
                }

                Spacer()

                VStack(alignment: .leading) {

                    Text("Dormit")
                        .font(.caption)
                        .foregroundStyle(theme.secondary)

                    Text(sleepText(for: e))
                        .font(.title3.bold())
                        .foregroundStyle(theme.accent)
                }
                
            }
            
            VStack(alignment: .leading, spacing: 10) {

                HStack {

                    Text("Qualitat del son")

                    Spacer()

                    Text("\(Int(sleepQualityDraft))/10")
                        .font(.headline)
                        .foregroundStyle(theme.accent)
                }.padding(.top, 16)

                Slider(
                    value: $sleepQualityDraft,
                    in: 0...10,
                    step: 1
                )
                .tint(theme.accent)
                .onAppear {
                    sleepQualityDraft = Double(e.sleepQuality ?? 5)
                }
            }

        }
    }


    // MARK: WORK

    private func workSection(_ e: DailyEntry) -> some View {

        let job = builtIn("workedAtJob")
        let home = builtIn("workedAtHome")

        let hasVisibleVariables =
            (job != nil && !(job!.isHidden(using: settings)))
            ||
            (home != nil && !(home!.isHidden(using: settings)))

        return Group {

            if hasVisibleVariables {

                section("Treballat") {

                    HStack {

                        if let job,
                           !job.isHidden(using: settings) {

                            selectable(
                                job.displayLabel(using: settings),
                                active: e.workedAtJob,
                                color: job.displayColor(using: settings)
                            ) {
                                e.workedAtJob.toggle()
                            }
                        }

                        if let home,
                           !home.isHidden(using: settings) {

                            selectable(
                                home.displayLabel(using: settings),
                                active: e.workedAtHome,
                                color: home.displayColor(using: settings)
                            ) {
                                e.workedAtHome.toggle()
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: OBJECTIVES

    private func objectivesSection(_ e: DailyEntry) -> some View {

        let fum = builtIn("fum")
        let gat = builtIn("gat")

        let hasVisibleVariables =
            (fum != nil && !(fum!.isHidden(using: settings)))
            ||
            (gat != nil && !(gat!.isHidden(using: settings)))

        return Group {

            if hasVisibleVariables {

                section("Mals hàbits") {

                    HStack {

                        if let fum,
                           !fum.isHidden(using: settings) {

                            selectable(
                                fum.displayLabel(using: settings),
                                active: e.fum,
                                color: fum.displayColor(using: settings)
                            ) {
                                e.fum.toggle()
                            }
                        }

                        if let gat,
                           !gat.isHidden(using: settings) {

                            selectable(
                                gat.displayLabel(using: settings),
                                active: e.gat,
                                color: gat.displayColor(using: settings)
                            ) {
                                e.gat.toggle()
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: ACTIVITIES

    private func activitiesSection(_ e: DailyEntry) -> some View {

        let meditation = builtIn("meditation")
        let yoga = builtIn("yoga")
        let dibuix = builtIn("dibuix")
        let llegir = builtIn("llegir")

        let hasVisibleVariables = [

            meditation?.isHidden(using: settings) == false,
            yoga?.isHidden(using: settings) == false,
            dibuix?.isHidden(using: settings) == false,
            llegir?.isHidden(using: settings) == false

        ].contains(true)

        return Group {

            if hasVisibleVariables {

                section("Activitats") {

                    VStack {

                        HStack {

                            if let meditation,
                               !meditation.isHidden(using: settings) {

                                selectable(
                                    meditation.displayLabel(using: settings),
                                    active: e.meditation,
                                    color: meditation.displayColor(using: settings)
                                ) {
                                    e.meditation.toggle()
                                }
                            }

                            if let yoga,
                               !yoga.isHidden(using: settings) {

                                selectable(
                                    yoga.displayLabel(using: settings),
                                    active: e.yoga,
                                    color: yoga.displayColor(using: settings)
                                ) {
                                    e.yoga.toggle()
                                }
                            }
                        }

                        HStack {

                            if let dibuix,
                               !dibuix.isHidden(using: settings) {

                                selectable(
                                    dibuix.displayLabel(using: settings),
                                    active: e.dibuix,
                                    color: dibuix.displayColor(using: settings)
                                ) {
                                    e.dibuix.toggle()
                                }
                            }

                            if let llegir,
                               !llegir.isHidden(using: settings) {

                                selectable(
                                    llegir.displayLabel(using: settings),
                                    active: e.llegir,
                                    color: llegir.displayColor(using: settings)
                                ) {
                                    e.llegir.toggle()
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: SPORTS ✅ GRID + EDIT MODE

    private func sportsSection(_ e: DailyEntry) -> some View {
        section("Esports") {
            
            let selectedSports = Set(e.sports)
            

            VStack(spacing: 10) {

                HStack {
                    TextField("Nou esport", text: $newSport)
                        .padding()
                        .background(theme.card)  // ✅ CHANGE

                    Button("+") {
                        guard !newSport.isEmpty else { return }
                        let s = CustomSport(name: newSport)
                        ctx.insert(s)
                        try? ctx.save()
                        newSport = ""
                    }
                }

                HStack {
                    Spacer()
                    Button(isEditingSports ? "Fet" : "Editar") {
                        isEditingSports.toggle()
                    }
                }

                // ✅ CHANGE GRID
                
                LazyVGrid(columns: [GridItem(), GridItem()]) {
                    ForEach(customSports) { sport in
                        ZStack(alignment: .topTrailing) {

                            selectable(sport.name,
                                       active: selectedSports.contains(sport.name),
                                       color: .purple) {
                                toggleSport(e, sport.name)
                            }

                            if isEditingSports {
                                Button("✕") {
                                    ctx.delete(sport)
                                    try? ctx.save()
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private func toggleSport(_ e: DailyEntry, _ name: String) {
        var s = e.sports
        if s.contains(name) { s.removeAll { $0 == name } }
        else { s.append(name) }
        e.sports = s
    }

    // MARK: COUNTER ✅ 2 LINES UX


    private func counterSection(_ e: DailyEntry) -> some View {

        let counter = builtIn("counter")

        return Group {

            if counter?.isHidden(using: settings) != true {

                section(
                    counter?.displayLabel(using: settings)
                    ?? "Pitells"
                ) {

                    VStack(spacing: 16) {

                        HStack {

                            Text("\(e.counter ?? 0)")
                                .font(.system(size: 34, weight: .bold))
                                .frame(width: 90, height: 60)
                                .background(theme.border.opacity(0.25))
                                .clipShape(RoundedRectangle(cornerRadius: 12))

                            Spacer()

                            Button {
                                e.counter = max(0, (e.counter ?? 0) - 1)
                            } label: {
                                Image(systemName: "minus")
                                    .font(.title2.bold())
                                    .frame(width: 60, height: 60)
                            }
                            .background(theme.border.opacity(0.25))
                            .clipShape(RoundedRectangle(cornerRadius: 12))

                            Button {
                                e.counter = (e.counter ?? 0) + 1
                            } label: {
                                Image(systemName: "plus")
                                    .font(.title2.bold())
                                    .frame(width: 60, height: 60)
                            }
                            .background(theme.border.opacity(0.25))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }

                        HStack(spacing: 10) {

                            ForEach([5, 10, 15, 20], id: \.self) { value in

                                Button("\(value)") {
                                    e.counter = value
                                }
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(
                                    (e.counter ?? 0) == value
                                    ? theme.accent
                                    : theme.border.opacity(0.25)
                                )
                                .foregroundStyle(
                                    (e.counter ?? 0) == value
                                    ? .white
                                    : theme.text
                                )
                                .clipShape(
                                    RoundedRectangle(cornerRadius: 12)
                                )
                            }
                        }
                    }
                }
            }
        }
    }


    // MARK: CUSTOM VARIABLES

    private func customVariablesSection(_ e: DailyEntry) -> some View {
        
        
        Group {

            if !customVariables.isEmpty {

                section("Personalitzats") {

                    let values = e.customValues
                    
                    let booleans = customVariables.filter {
                        $0.type == "boolean"
                    }

                    if !booleans.isEmpty {

                        LazyVGrid(
                            columns: [
                                GridItem(.flexible()),
                                GridItem(.flexible())
                            ],
                            spacing: 10
                        ) {

                            ForEach(booleans) { v in

                                selectable(
                                    v.label,
                                    active: (values[v.variableId] ?? 0) > 0,
                                    color: Color(hex: v.colorHex)
                                ) {

                                    var cv = e.customValues

                                    cv[v.variableId] =
                                        (cv[v.variableId] ?? 0) > 0
                                        ? 0
                                        : 1

                                    e.customValues = cv
                                }
                            }
                        }
                    }

                    ForEach(
                        customVariables.filter {
                            $0.type == "counter"
                        }
                    ) { v in

                        VStack(
                            alignment: .leading,
                            spacing: 8
                        ) {

                            Text(v.label)
                                .font(.headline)

                            HStack {

                                Text(
                                    "\(values[v.variableId] ?? 0) \(v.unit)"
                                )
                                .font(.title3.bold())

                                Spacer()

                                Button {

                                    var cv = e.customValues

                                    cv[v.variableId] =
                                        max(
                                            0,
                                            (cv[v.variableId] ?? 0) - 1
                                        )

                                    e.customValues = cv

                                } label: {

                                    Image(systemName: "minus")
                                        .frame(width: 44, height: 44)
                                }
                                .background(
                                    theme.border.opacity(0.25)
                                )
                                .foregroundStyle(theme.text)
                                .clipShape(
                                    RoundedRectangle(cornerRadius: 8)
                                )

                                Button {

                                    var cv = e.customValues

                                    cv[v.variableId] =
                                        (cv[v.variableId] ?? 0) + 1

                                    e.customValues = cv

                                } label: {

                                    Image(systemName: "plus")
                                        .frame(width: 44, height: 44)
                                }
                                .background(
                                    theme.border.opacity(0.25)
                                )
                                .foregroundStyle(theme.text)
                                .clipShape(
                                    RoundedRectangle(cornerRadius: 8)
                                )
                            }
                        }
                        .padding(.top, 8)
                    }

                    ForEach(
                        customVariables.filter {
                            $0.type == "rating"
                        }
                    ) { v in

                        VStack(
                            alignment: .leading,
                            spacing: 8
                        ) {

                            Text(v.label)
                                .font(.headline)

                            HStack {

                                ForEach(1...5, id: \.self) { star in

                                    Button {

                                        var cv = e.customValues
                                        let current = cv[v.variableId] ?? 0

                                        cv[v.variableId] =
                                            current == star
                                            ? 0
                                            : star
                                        e.customValues = cv

                                    } label: {

                                        Image(
                                            systemName:
                                                star <= (e.customValues[v.variableId] ?? 0)
                                                ? "star.fill"
                                                : "star"
                                        )
                                        .font(.title2)
                                        .foregroundStyle(
                                            Color(hex: v.colorHex)
                                        )
                                    }
                                    .buttonStyle(.plain)
                                }

                                Spacer()

                                Text("\(values[v.variableId] ?? 0)/5")
                                    .foregroundStyle(theme.secondary)
                            }
                        }
                        .padding(.top, 8)
                    }
                }
            }
        }
    }
    // MARK: NOTES ✅ STYLED

    private func notesSection(_ e: DailyEntry) -> some View {
        section("Notes") {
            TextEditor(text: $notesDraft)
                .focused($isEditingNotes)
                .frame(minHeight: 80)
                .scrollContentBackground(.hidden)
                .background(theme.card)
                .foregroundStyle(theme.text)
                .onAppear {
                    notesDraft = e.notes ?? ""
                }
                .onChange(of: isEditingNotes) { _, editing in
                    if !editing {
                        e.notes = notesDraft
                    }
                }
        }
    }

    // MARK: SAVE

    private func saveSection() -> some View {
        Button {

            if let e = entry {
                e.sleepQuality = Int(sleepQualityDraft)
                e.notes = notesDraft
            }

            try? ctx.save()

            selectedTab = 2

            dismiss()

        } label: {
            Text("Guardar")
                .frame(maxWidth: .infinity)
                .padding()
                .background(theme.accent)
                .foregroundStyle(.white)
                .clipShape(
                    RoundedRectangle(cornerRadius: 12)
                )
        }
    }
    
    private func deleteSection() -> some View {

        Button(role: .destructive) {

            showDeleteAlert = true

        } label: {

            Text("Eliminar dia")
                .frame(maxWidth: .infinity)
                .padding()
                .background(.red.opacity(0.15))
                .foregroundStyle(.red)
                .clipShape(
                    RoundedRectangle(cornerRadius: 12)
                )
        }
    }

    // MARK: HELPERS

    private func builtIn(
        _ fieldKey: String
    ) -> BuiltInVariable? {

        builtInVariables.first {
            $0.fieldKey == fieldKey
        }
    }
    
    private func selectable(
        _ title: String,
        active: Bool,
        color: Color,
        action: @escaping () -> Void
    ) -> some View {

        Button(action: action) {

            Text(title)
                .font(.body.weight(.medium))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)

                .background(
                    active
                    ? color
                    : theme.border.opacity(0.25)
                )

                .foregroundStyle(
                    active
                    ? Color.white
                    : theme.text
                )

                .clipShape(
                    RoundedRectangle(cornerRadius: 12)
                )

                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(
                            active
                            ? color
                            : theme.border.opacity(0.5),
                            lineWidth: 1
                        )
                )
        }
    }


    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading) {
            Text(title)
                .font(.title3.weight(.semibold)) // ✅ CHANGE
            content()
        }
        .padding()
        .background(theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
    
    private func sleepText(for entry: DailyEntry) -> String {

        guard
            let currentDate = Date.from(isoDate: entry.date),
            let wake = entry.wakeUpTime?.parseHHmm()
        else {
            return "-"
        }

        guard
            let previousDate = Calendar.current.date(
                byAdding: .day,
                value: -1,
                to: currentDate
            )
        else {
            return "-"
        }

        guard
            let previousEntry = entries.first(
                where: { $0.date == previousDate.isoDate }
            ),
            let bed = previousEntry.bedTime?.parseHHmm()
        else {
            return "-"
        }

        let bedMinutes =
            bed.hour * 60 + bed.minute

        let wakeMinutes =
            wake.hour * 60 + wake.minute

        var total =
            wakeMinutes - bedMinutes

        if total < 0 {
            total += 24 * 60
        }

        let hours = total / 60
        let minutes = total % 60

        return "\(hours)h \(String(format: "%02d", minutes))m"
    }

    private func copyPreviousEntry() {

        guard let currentDate = Date.from(isoDate: dateString),
              let previousDate = Calendar.current.date(
                byAdding: .day,
                value: -1,
                to: currentDate
              )
        else {
            return
        }

        guard let previous = entries.first(
            where: { $0.date == previousDate.isoDate }
        ),
        let current = entry
        else {
            return
        }
        current.bedTime = previous.bedTime
        current.wakeUpTime = previous.wakeUpTime
        current.sleepQuality = previous.sleepQuality
        current.workedAtJob = previous.workedAtJob
        current.workedAtHome = previous.workedAtHome

        current.fum = previous.fum
        current.gat = previous.gat

        current.meditation = previous.meditation
        current.yoga = previous.yoga
        current.dibuix = previous.dibuix
        current.llegir = previous.llegir

        current.sports = previous.sports

        current.counter = previous.counter

        current.customValues = previous.customValues
        entry = nil
        entry = current
        try? ctx.save()
    }
    
    private func loadOrCreate() {

        if let existing = entries.first(where: { $0.date == dateString }) {

            entry = existing
            sleepQualityDraft = Double(existing.sleepQuality ?? 5)

        } else {

            let e = DailyEntry(date: dateString)

            ctx.insert(e)
            try? ctx.save()

            entry = e
            sleepQualityDraft = Double(e.sleepQuality ?? 5)
        }
    }
}

private struct TimePicker: View {

    let label: String

    @Binding var value: String

    @State private var time = Date()

    var body: some View {

        VStack(alignment: .leading) {

            if !label.isEmpty {
                Text(label)
            }

            DatePicker(
                "",
                selection: $time,
                displayedComponents: .hourAndMinute,
            )
            .labelsHidden()
            

            .onAppear {

                guard let parsed = value.parseHHmm()
                else { return }

                var comps =
                    Calendar.current.dateComponents(
                        [.year,.month,.day],
                        from: Date()
                    )

                comps.hour = parsed.hour
                comps.minute = parsed.minute

                if let d =
                    Calendar.current.date(from: comps) {

                    time = d
                }
            }

            .onChange(of: time) {
                value = formatTime(time)
            }
            .onChange(of: value) {

                guard let parsed = value.parseHHmm()
                else { return }

                var comps =
                    Calendar.current.dateComponents(
                        [.year,.month,.day],
                        from: Date()
                    )

                comps.hour = parsed.hour
                comps.minute = parsed.minute

                if let d = Calendar.current.date(from: comps) {
                    time = d
                }
            }
        }
    }

    private func formatTime(_ d: Date) -> String {

        let c =
            Calendar.current.dateComponents(
                [.hour,.minute],
                from: d
            )

        return String(
            format: "%02d:%02d",
            c.hour ?? 0,
            c.minute ?? 0
        )
    }
}
