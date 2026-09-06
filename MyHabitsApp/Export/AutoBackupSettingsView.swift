import SwiftUI

struct AutoBackupSettingsView: View {

    @Environment(\.appTheme) var theme

    @Bindable var settings: AppSettings

    var body: some View {

        Form {

            Section {

                Text("""
                Properament podràs crear còpies de seguretat automàtiques a l'app Arxius mitjançant iCloud Drive.
                """)
                .font(.caption)
                .foregroundStyle(theme.secondary)

            }
            .listRowBackground(theme.card)

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
            .listRowBackground(theme.card)

            Section("Estat") {

                LabeledContent("Última còpia") {

                    if let last = settings.lastBackupDate {

                        Text(last.formatted())

                    } else {

                        Text("Mai")
                    }
                }
            }
            .listRowBackground(theme.card)
        }
        .scrollContentBackground(.hidden)
        .background(theme.bg.ignoresSafeArea())
        .navigationTitle("Còpies automàtiques")
    }
}
