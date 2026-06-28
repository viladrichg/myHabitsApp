import SwiftUI
import SwiftData

@main
struct DailyTrackerApp: App {
    let container: ModelContainer

    init() {
        do {
            container = try ModelContainer(
                for: DailyEntry.self,
                     AppSettings.self,
                     CustomSport.self,
                     CustomVariable.self
            )
        } catch {
            fatalError("SwiftData container failed: \(error)")
        }
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .modelContainer(container)
        }
    }
}

/// Bootstraps settings + default sports on first launch,
/// then hands off to the main tab view.
struct RootView: View {
    @Environment(\.modelContext) private var ctx
    @Query private var allSettings: [AppSettings]
    @Query private var allSports: [CustomSport]

    private var settings: AppSettings {
        allSettings.first ?? bootstrapSettings()
    }

    var body: some View {
        ContentView()
            .environment(
                \.appTheme,
                AppTheme.colors(for: settings.themeStyle)
            )
            .preferredColorScheme(
                settings.themeStyle == "dark"
                || settings.themeStyle == "forest"
                || settings.themeStyle == "ocean"
                || settings.themeStyle == "rose"
                || settings.themeStyle == "nord"
                || settings.themeStyle == "coffee"
                ? .dark
                : .light
            )
            .onAppear {
                bootstrap()
            }

    }

    // MARK: - Bootstrap

    private func bootstrap() {
        if allSettings.isEmpty { _ = bootstrapSettings() }
        if allSports.isEmpty   { bootstrapSports() }
    }

    @discardableResult
    private func bootstrapSettings() -> AppSettings {
        let s = AppSettings()
        ctx.insert(s)
        try? ctx.save()
        return s
    }

    private func bootstrapSports() {
        let defaults = ["Córrer", "CrossFit", "Exercici", "Senderisme",
                        "Swing", "Frontó", "BTT"]
        defaults.forEach { ctx.insert(CustomSport(name: $0)) }
        try? ctx.save()
    }
}
