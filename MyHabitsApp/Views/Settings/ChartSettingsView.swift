import SwiftUI
import SwiftData

struct ChartSettingsView: View {

    var body: some View {

        Form {

            Section("LineChart") {

                Text("Properament")

                Text("• Línia + punts")
                Text("• Barres")
            }
        }
        .navigationTitle("Gràfics")
    }
}
