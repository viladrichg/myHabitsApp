import SwiftUI
import SwiftData

struct SettingsView: View {
    @Environment(\.appTheme) var theme
    @Query private var allSettings: [AppSettings]
    //@Query(sort: \CustomVariable.order) private var customVariables: [CustomVariable] // ✅ CHANGE

    private var settings: AppSettings? { allSettings.first }

    var body: some View {
        NavigationStack {
            Form {
                if let s = settings {
                    themeSection(s)
                    displaySection(s)
                    notificationsSection(s)
                    backupSection(s)
                }

                //variableColorsSection
                customVariablesSection

                aboutSection
            }
            .scrollContentBackground(.hidden)
            .background(theme.bg.ignoresSafeArea())
            .navigationTitle("Configuració")
        }
    }

    // MARK: - Theme

    private func themeSection(_ s: AppSettings) -> some View {
        Section("Aspecte") {
            Picker("Tema", selection: Binding(
                get: { s.themeStyle },
                set: { s.themeStyle = $0; s.updatedAt = Date() }
            )) {
                ForEach(AppTheme.all, id: \.id) { t in
                    HStack {
                        Circle()
                            .fill(t.colors.accent)
                            .frame(width: 12, height: 12)
                        Text(t.colors.name)
                    }
                    .tag(t.id)
                }
            }
        }
        .listRowBackground(theme.card)
    }

    // MARK: - Display

    private func displaySection(_ s: AppSettings) -> some View {
        Section("Visualització") {
            Picker("Període gràfics", selection: Binding(get: { s.chartTimeframe }, set: { s.chartTimeframe = $0 })) {
                Text("1 setmana").tag("week")
                Text("15 dies").tag("15days")
                Text("1 mes").tag("month")
                Text("3 mesos").tag("3months")
                Text("6 mesos").tag("6months")
                Text("1 any").tag("year")
                Text("Tot").tag("all")
            }

            Picker("Valors", selection: Binding(get: { s.displayMode }, set: { s.displayMode = $0 })) {
                Text("Absolut").tag("absolute")
                Text("Percentatge").tag("percentage")
            }
        }
        .listRowBackground(theme.card)
    }

    // MARK: - NEW VARIABLE COLORS ✅ CHANGE

    // MARK: - Notifications

    private func notificationsSection(_ s: AppSettings) -> some View {
        Section {
            NavigationLink("Notificacions") {
                NotificationSettingsView(settings: s)
            }
        }
        .listRowBackground(theme.card)
    }

    // MARK: - Backup

    private func backupSection(_ s: AppSettings) -> some View {
        Section {
            NavigationLink("Còpies de seguretat") {
                BackupSettingsView(settings: s)
            }
        }
        .listRowBackground(theme.card)
    }

    // MARK: - Custom Variables

    private var customVariablesSection: some View {
        Section {

        }
        .listRowBackground(theme.card)
    }

    // MARK: - About

    private var aboutSection: some View {
        Section("Informació") {
            LabeledContent("Version", value: "1.2.3")
            LabeledContent("Storage", value: "Local SQLite Vilajou")
        }
        .listRowBackground(theme.card)
    }
}
