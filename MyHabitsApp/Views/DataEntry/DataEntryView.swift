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
    @State private var testToggle = false
    @State private var habit1Draft = false
    @State private var habit2Draft = false
    @State private var negative1Draft = false
    @State private var negative2Draft = false
    @State private var positive1Draft = false
    @State private var positive2Draft = false
    @State private var positive3Draft = false
    @State private var positive4Draft = false
    @State private var counterDraft = 0
    @State private var sportsDraft: [String] = []
    @State private var sleepEndDraft = ""
    @State private var sleepStartDraft = ""
    @State private var sportSearch = ""
    
    
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
    @State private var customValuesDraft: [String:Int] = [:]
    @State private var notesDraft = ""
    @FocusState private var isEditingNotes: Bool
    
    private var visibleSports: [CustomSport] {

        if !sportSearch.isEmpty {

            return customSports.filter {
                $0.name.localizedCaseInsensitiveContains(
                    sportSearch
                )
            }
        }

        let selected = customSports.filter {
            sportsDraft.contains($0.name)
        }

        let notSelected = customSports.filter {
            !sportsDraft.contains($0.name)
        }

        let combined =
            selected + notSelected

        return Array(
            combined.prefix(8)
        )
    }
    
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
                        value: $sleepEndDraft
                    )
                }
                
                VStack(alignment: .leading) {
                    
                    Text("Anar a dormir")
                        .font(.caption)
                        .foregroundStyle(theme.secondary)
                    
                    TimePicker(
                        label: "",
                        value: $sleepStartDraft
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
                }
                .padding(.top, 16)
                
                Slider(
                    value: $sleepQualityDraft,
                    in: 0...10,
                    step: 1
                )
                .tint(theme.accent)
            }
        }
    }
    
    
    // MARK: WORK
    
    private func workSection(_ e: DailyEntry) -> some View {
        
        let job = builtIn("habit1")
        let home = builtIn("habit2")
        
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
                                active: habit1Draft,
                                color: job.displayColor(using: settings)
                            ) {
                                habit1Draft.toggle()
                            }
                        }
                        
                        if let home,
                           !home.isHidden(using: settings) {
                            
                            selectable(
                                home.displayLabel(using: settings),
                                active: habit2Draft,
                                color: home.displayColor(using: settings)
                            ) {
                                habit2Draft.toggle()
                            }
                        }
                    }
                }
            }
        }
    }
    
    // MARK: OBJECTIVES
    
    private func objectivesSection(_ e: DailyEntry) -> some View {
        
        let negative1 = builtIn("negative1")
        let negative2 = builtIn("negative2")
        
        let hasVisibleVariables =
        (negative1 != nil && !(negative1!.isHidden(using: settings)))
        ||
        (negative2 != nil && !(negative2!.isHidden(using: settings)))
        
        return Group {
            
            if hasVisibleVariables {
                
                section("Mals hàbits") {
                    
                    HStack {
                        
                        if let negative1,
                           !negative1.isHidden(using: settings) {
                            
                            selectable(
                                negative1.displayLabel(using: settings),
                                active: negative1Draft,
                                color: negative1.displayColor(using: settings)
                            ) {
                                negative1Draft.toggle()
                            }
                        }
                        
                        if let negative2,
                           !negative2.isHidden(using: settings) {
                            
                            selectable(
                                negative2.displayLabel(using: settings),
                                active: negative2Draft,
                                color: negative2.displayColor(using: settings)
                            ) {
                                negative2Draft.toggle()
                            }
                        }
                    }
                }
            }
        }
    }
    
    // MARK: ACTIVITIES
    
    private func activitiesSection(_ e: DailyEntry) -> some View {
        
        let positive1 = builtIn("positive1")
        let positive2 = builtIn("positive2")
        let positive3 = builtIn("positive3")
        let positive4 = builtIn("positive4")
        
        let hasVisibleVariables = [
            
            positive1?.isHidden(using: settings) == false,
            positive2?.isHidden(using: settings) == false,
            positive3?.isHidden(using: settings) == false,
            positive4?.isHidden(using: settings) == false
            
        ].contains(true)
        
        return Group {
            
            if hasVisibleVariables {
                
                section("Activitats") {
                    
                    VStack {
                        
                        HStack {
                            
                            if let positive1,
                               !positive1.isHidden(using: settings) {
                                
                                selectable(
                                    positive1.displayLabel(using: settings),
                                    active: positive1Draft,
                                    color: positive1.displayColor(using: settings)
                                ) {
                                    positive1Draft.toggle()
                                }
                            }
                            
                            if let positive2,
                               !positive2.isHidden(using: settings) {
                                
                                selectable(
                                    positive2.displayLabel(using: settings),
                                    active: positive2Draft,
                                    color: positive2.displayColor(using: settings)
                                ) {
                                    positive2Draft.toggle()
                                }
                            }
                        }
                        
                        HStack {
                            
                            if let positive3,
                               !positive3.isHidden(using: settings) {
                                
                                selectable(
                                    positive3.displayLabel(using: settings),
                                    active: positive3Draft,
                                    color: positive3.displayColor(using: settings)
                                ) {
                                    positive3Draft.toggle()
                                }
                            }
                            
                            if let positive4,
                               !positive4.isHidden(using: settings) {
                                
                                selectable(
                                    positive4.displayLabel(using: settings),
                                    active: positive4Draft,
                                    color: positive4.displayColor(using: settings)
                                ) {
                                    positive4Draft.toggle()
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

            let selectedSports = Set(sportsDraft)

            VStack(spacing: 10) {

                HStack {

                    if isEditingSports {

                        TextField(
                            "Nou esport",
                            text: $newSport
                        )
                        .padding()
                        .background(theme.card)

                        Button {
                            guard !newSport.isEmpty else { return }

                            let s = CustomSport(name: newSport)

                            ctx.insert(s)

                            try? ctx.save()

                            newSport = ""

                        } label: {

                            Image(systemName: "plus.circle.fill")
                                .font(.title2)
                        }
                        .padding(.trailing, 28)
                        
                    } else if customSports.count > 12 {

                        TextField(
                            "Cercar esport",
                            text: $sportSearch
                        )
                        .padding()
                        .background(theme.card)
                    }
                      
                    Spacer()

                    Button(
                        isEditingSports
                        ? "Fet"
                        : "Editar"
                    ) {
                        isEditingSports.toggle()
                    }
                }
                Spacer()
                    .frame(height: 8)
                
                LazyVGrid(
                    columns: [
                        GridItem(),
                        GridItem()
                    ]
                ) {

                    ForEach(visibleSports) { sport in

                        ZStack(
                            alignment: .topTrailing
                        ) {

                            selectable(
                                sport.name,
                                active: selectedSports.contains(sport.name),
                                color: .purple
                            ) {

                                guard !isEditingSports else {
                                    return
                                }

                                toggleSport(sport.name)
                            }

                            if isEditingSports {

                                Button {

                                    ctx.delete(sport)

                                    try? ctx.save()

                                } label: {

                                    Image(systemName: "xmark.circle.fill")
                                        .font(.title3)
                                        .foregroundStyle(.red)
                                }
                                .padding(8)
                                .offset(x: -2, y: 2)
                            }
                        }
                    }
                }
            }
        }
    }
    
    private func toggleSport(
        _ name: String
    ) {
        
        if sportsDraft.contains(name) {
            
            sportsDraft.removeAll {
                $0 == name
            }
            
        } else {
            
            sportsDraft.append(name)
        }
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
                            
                            Text("\(counterDraft)")
                                .font(.system(size: 34, weight: .bold))
                                .frame(width: 90, height: 60)
                                .background(theme.border.opacity(0.25))
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                            
                            Spacer()
                            
                            Button {
                                counterDraft = max(0, counterDraft - 1)
                            } label: {
                                Image(systemName: "minus")
                                    .font(.title2.bold())
                                    .frame(width: 60, height: 60)
                            }
                            .background(theme.border.opacity(0.25))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            
                            Button {
                                counterDraft += 1
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
                                    counterDraft = value
                                }
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(
                                    counterDraft == value
                                    ? theme.accent
                                    : theme.border.opacity(0.25)
                                )
                                .foregroundStyle(
                                    counterDraft == value
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
            
            let visibleCustomVariables =
                customVariables.filter {
                    !$0.isHidden
                }

            if !visibleCustomVariables.isEmpty {
                
                section("Personalitzats") {
                    
                    let booleans = customVariables.filter {
                        !$0.isHidden &&
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
                                    active: (customValuesDraft[v.variableId] ?? 0) > 0,
                                    color: Color(hex: v.colorHex)
                                ) {
                                    
                                    var cv = customValuesDraft
                                    
                                    cv[v.variableId] =
                                    (cv[v.variableId] ?? 0) > 0
                                    ? 0
                                    : 1
                                    
                                    customValuesDraft = cv
                                }
                            }
                        }
                    }
                    
                    ForEach(
                        customVariables.filter {
                            !$0.isHidden &&
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
                                    "\(customValuesDraft[v.variableId] ?? 0) \(v.unit)"
                                )
                                .font(.title3.bold())
                                
                                Spacer()
                                
                                Button {
                                    
                                    var cv = customValuesDraft
                                    
                                    cv[v.variableId] =
                                    max(
                                        0,
                                        (cv[v.variableId] ?? 0) - 1
                                    )
                                    
                                    customValuesDraft = cv
                                    
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
                                    
                                    var cv = customValuesDraft
                                    
                                    cv[v.variableId] =
                                    (cv[v.variableId] ?? 0) + 1
                                    
                                    customValuesDraft = cv
                                    
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
                            !$0.isHidden &&
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
                                
                                ForEach(1...7, id: \.self) { star in
                                    
                                    Button {
                                        
                                        var cv = customValuesDraft
                                        
                                        let current =
                                        cv[v.variableId] ?? 0
                                        
                                        cv[v.variableId] =
                                        current == star
                                        ? 0
                                        : star
                                        
                                        customValuesDraft = cv
                                        
                                    } label: {
                                        
                                        Image(
                                            systemName:
                                                star <= (customValuesDraft[v.variableId] ?? 0)
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
                                
                                Text(
                                    "\(customValuesDraft[v.variableId] ?? 0)/7"
                                )
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
        }
    }
    
    private func saveSection() -> some View {
        
        Button {
            
            if let e = entry {
                
                e.sleepEnd =
                sleepEndDraft.isEmpty
                ? nil
                : sleepEndDraft
                
                e.sleepStart =
                sleepStartDraft.isEmpty
                ? nil
                : sleepStartDraft
                
                e.sleepQuality =
                Int(sleepQualityDraft)
                
                e.notes =
                notesDraft
                
                e.customValues =
                customValuesDraft
                
                e.habit1 =
                habit1Draft
                
                e.habit2 =
                habit2Draft
                
                e.negative1 =
                negative1Draft
                
                e.negative2 =
                negative2Draft
                
                e.positive1 =
                positive1Draft
                
                e.positive2 =
                positive2Draft
                
                e.positive3 =
                positive3Draft
                
                e.positive4 =
                positive4Draft
                
                e.sports =
                sportsDraft
                
                e.counter =
                counterDraft == 0
                ? nil
                : counterDraft
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
            let wake = sleepEndDraft.parseHHmm()
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
            let bed = previousEntry.sleepStart?.parseHHmm()
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
        )
        else {
            return
        }
        
        sleepEndDraft =
        previous.sleepEnd ?? ""
        
        sleepStartDraft =
        previous.sleepStart ?? ""
        
        sleepQualityDraft =
        Double(previous.sleepQuality ?? 5)
        
        habit1Draft =
        previous.habit1
        
        habit2Draft =
        previous.habit2
        
        negative1Draft =
        previous.negative1
        
        negative2Draft =
        previous.negative2
        
        positive1Draft =
        previous.positive1
        
        positive2Draft =
        previous.positive2
        
        positive3Draft =
        previous.positive3
        
        positive4Draft =
        previous.positive4
        
        sportsDraft =
        previous.sports
        
        counterDraft =
        previous.counter ?? 0
        
        customValuesDraft =
        previous.customValues
        
        notesDraft =
        previous.notes ?? ""
    }
    
    private func loadOrCreate() {
        
        if let existing = entries.first(where: { $0.date == dateString }) {
            
            entry = existing
            
            sleepQualityDraft =
            Double(existing.sleepQuality ?? 5)
            
            notesDraft =
            existing.notes ?? ""
            
            customValuesDraft =
            existing.customValues
            
            habit1Draft = existing.habit1
            habit2Draft = existing.habit2
            negative1Draft = existing.negative1
            negative2Draft = existing.negative2
            positive1Draft = existing.positive1
            positive2Draft = existing.positive2
            positive3Draft = existing.positive3
            positive4Draft = existing.positive4
            counterDraft = existing.counter ?? 0
            sportsDraft = existing.sports
            sleepEndDraft = existing.sleepEnd ?? ""
            sleepStartDraft = existing.sleepStart ?? ""
            sleepQualityDraft = Double(existing.sleepQuality ?? 5)

            
        } else {
            
            let e = DailyEntry(date: dateString)
            
            ctx.insert(e)
            try? ctx.save()
            
            entry = e
            
            sleepQualityDraft =
            Double(e.sleepQuality ?? 5)
            
            notesDraft = ""
            
            customValuesDraft = [:]
            
            habit1Draft = false
            habit2Draft = false
            negative1Draft = false
            negative2Draft = false
            positive1Draft = false
            positive2Draft = false
            positive3Draft = false
            positive4Draft = false
            counterDraft = 0
            sportsDraft = []
            sleepEndDraft = ""
            sleepStartDraft = ""
            
        }
    }
    
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
}
