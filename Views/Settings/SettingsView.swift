import SwiftUI
import SwiftData

struct SettingsView: View {
    @Environment(\.appTheme) var theme
    @Query private var allSettings: [AppSettings]
    private var settings: AppSettings? { allSettings.first }

    var body: some View {
        NavigationStack {
            Form {
                if let s = settings {
                    themeSection(s)
                    displaySection(s)
                    notificationsSection(s)
                    backupSection(s)
                    customVariablesSection
                    aboutSection
                }
            }
            .scrollContentBackground(.hidden)
            .background(theme.bg.ignoresSafeArea())
            .navigationTitle("Settings")
        }
    }

    // MARK: - Theme

    private func themeSection(_ s: AppSettings) -> some View {
        Section("Appearance") {
            Picker("Theme", selection: Binding(get: { s.themeStyle }, set: { s.themeStyle = $0; s.updatedAt = Date() })) {
                ForEach(AppTheme.all, id: \.id) { t in
                    HStack {
                        Circle().fill(t.colors.accent).frame(width: 12, height: 12)
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
        Section("Display") {
            Picker("Chart Timeframe", selection: Binding(get: { s.chartTimeframe }, set: { s.chartTimeframe = $0 })) {
                Text("1 week").tag("week")
                Text("15 days").tag("15days")
                Text("1 month").tag("month")
                Text("3 months").tag("3months")
                Text("6 months").tag("6months")
                Text("1 year").tag("year")
                Text("All time").tag("all")
            }
            Picker("Values", selection: Binding(get: { s.displayMode }, set: { s.displayMode = $0 })) {
                Text("Absolute").tag("absolute")
                Text("Percentage").tag("percentage")
            }
        }
        .listRowBackground(theme.card)
    }

    // MARK: - Notifications

    private func notificationsSection(_ s: AppSettings) -> some View {
        Section {
            NavigationLink("Notifications") {
                NotificationSettingsView(settings: s)
            }
        }
        .listRowBackground(theme.card)
    }

    // MARK: - Backup

    private func backupSection(_ s: AppSettings) -> some View {
        Section {
            NavigationLink("Backup & Export") {
                BackupSettingsView(settings: s)
            }
        }
        .listRowBackground(theme.card)
    }

    // MARK: - Custom Variables

    private var customVariablesSection: some View {
        Section {
            NavigationLink("Custom Variables") {
                CustomVariablesView()
            }
        }
        .listRowBackground(theme.card)
    }

    // MARK: - About

    private var aboutSection: some View {
        Section("About") {
            LabeledContent("Version", value: "1.0.0")
            LabeledContent("Storage", value: "Local SQLite (SwiftData)")
        }
        .listRowBackground(theme.card)
    }
}
