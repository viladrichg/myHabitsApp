import SwiftUI

struct AutoBackupSettingsView: View {

    @Bindable var settings: AppSettings

    var body: some View {

        Form {

            Section {

                Text("""
                Properament podràs crear còpies de seguretat automàtiques a l'app Arxius mitjançant iCloud Drive.
                """)
                .font(.caption)
                .foregroundStyle(.secondary)

            }

            Section("Freqüència") {

                Picker(
                    "Còpies automàtiques",
                    selection: $settings.backupFrequency
                ) {

                    Text("Desactivades")
                        .tag("none")

                    Text("Setmanals")
                        .tag("weekly")

                    Text("Mensuals")
                        .tag("monthly")
                }
            }

            Section("Estat") {

                LabeledContent("Última còpia") {

                    if let last = settings.lastBackupDate {

                        Text(last.formatted())

                    } else {

                        Text("Mai")
                    }
                }
            }
        }
        .navigationTitle("Còpies automàtiques")
    }
}
