import SwiftUI
import SwiftData

struct ChartSettingsView: View {

    @Query(sort: \AppSettings.createdAt)
    private var allSettings: [AppSettings]

    private var settings: AppSettings? {
        allSettings.first
    }

    var body: some View {

        Form {

            if let settings {

                Section("Representació de les dades") {

                    Toggle(
                        "Mostrar com a barres",
                        isOn: Binding(
                            get: {
                                settings.lineChartStyle == "bar"
                            },
                            set: {
                                settings.lineChartStyle =
                                    $0 ? "bar" : "line"
                            }
                        )
                    )

                    Text(
                        settings.lineChartStyle == "bar"
                        ? "Els gràfics es mostren com a barres."
                        : "Els gràfics es mostren com a línia i punts."
                    )
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
            
            }
        }
        .navigationTitle("Gràfics")
    }
}
