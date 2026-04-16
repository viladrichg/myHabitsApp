import SwiftUI
import SwiftData

struct ContentView: View {
    @Environment(\.appTheme) var theme
    @Query private var allSettings: [AppSettings]

    private var settings: AppSettings? { allSettings.first }

    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Home",     systemImage: "house.fill") }

            DataEntryView()
                .tabItem { Label("Today",    systemImage: "plus.circle.fill") }

            StatisticsView()
                .tabItem { Label("Calendar", systemImage: "calendar") }

            GraphsView()
                .tabItem { Label("Graphs",   systemImage: "chart.line.uptrend.xyaxis") }

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gear") }
        }
        .tint(theme.accent)
        .background(theme.bg)
    }
}
