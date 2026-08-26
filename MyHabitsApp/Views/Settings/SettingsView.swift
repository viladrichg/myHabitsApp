import SwiftUI
import SwiftData

struct SettingsView: View {
    @Environment(\.appTheme) var theme
    @Query private var allSettings: [AppSettings]
    //@Query(sort: \CustomVariable.order) private var customVariables: [CustomVariable] // ✅ CHANGE

    private var settings: AppSettings? { allSettings.first }

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
    
    var body: some View {
        NavigationStack {
            Form {
                if let s = settings {
                    themeSection(s)
                    displaySection(s)
                    customVariablesSection
                    notificationsSection(s)
                    backupSection(s)
                }

                aboutSection
            }
            .tint(theme.accent)
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
        .foregroundStyle(theme.text)
    }

    // MARK: - Display

    private func displaySection(_ s: AppSettings) -> some View {

        Section("Visualització") {

            NavigationLink {

                CalendarSettingsView()

            } label: {

                Label(
                    "Calendari",
                    systemImage: "calendar"
                )
            }

            NavigationLink {

                ChartSettingsView()

            } label: {

                Label(
                    "Gràfics",
                    systemImage: "chart.xyaxis.line"
                )
            }
        }
        .listRowBackground(theme.card)
        .foregroundStyle(theme.text)
        .listRowBackground(theme.card)
        .foregroundStyle(theme.text)
    }
    
    // MARK: - Custom Variables

    private var customVariablesSection: some View {

        Section("Variables personalitzades") {

            NavigationLink {

                CustomVariablesView()

            } label: {

                Label(
                    "Gestionar variables",
                    systemImage: "slider.horizontal.3"
                )
            }
        }
        .listRowBackground(theme.card)
        .foregroundStyle(theme.text)
    }

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

    // MARK: - About

    private var aboutSection: some View {
        Section("Informació") {
            LabeledContent("Versió", value: "1.2.3")
            LabeledContent("Storage", value: "Local SQLite Vilajou")
        }
        .listRowBackground(theme.card)
    }
}
