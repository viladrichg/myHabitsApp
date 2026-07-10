import SwiftUI
import SwiftData

struct ContentView: View {
    @Environment(\.appTheme) var theme
    @State private var selectedTab = 0  // ✅ controla el tab actiu
    @Query private var allSettings: [AppSettings]

    private var settings: AppSettings? { allSettings.first }

    var body: some View {

        TabView(selection: $selectedTab) {   // ✅ CHANGE: control manual del tab

            HomeView()
                .tabItem { Label("Inici", systemImage: "house.fill") }
                .tag(0)  // ✅ CHANGE

            DataEntryView(selectedTab: $selectedTab)   // ✅ CHANGE
                .tabItem { Label("Avui", systemImage: "plus.circle.fill") }
                .tag(1)

            StatisticsView()
                .tabItem { Label("Calendari", systemImage: "calendar") }
                .tag(2)

            GraphsView()
                .tabItem { Label("Gràfics", systemImage: "chart.line.uptrend.xyaxis") }
                .tag(3)

            SettingsView()
                .tabItem { Label("Configuració", systemImage: "gear") }
                .tag(4)
        }
        .tint(theme.accent)
        .background(theme.bg)
    }
}
