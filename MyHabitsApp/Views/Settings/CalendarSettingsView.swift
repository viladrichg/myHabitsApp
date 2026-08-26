import SwiftUI
import SwiftData

struct CalendarSettingsView: View {

    @Environment(\.appTheme) var theme

    @Query(sort: \AppSettings.createdAt)
    private var allSettings: [AppSettings]

    private var settings: AppSettings? {
        allSettings.first
    }

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

    var body: some View {

        Form {

            if let settings {

                Toggle(
                    "Dia excel·lent",
                    isOn: Binding(
                        get: {
                            settings.perfectDayEnabled
                        },
                        set: {
                            settings.perfectDayEnabled = $0
                        }
                    )
                )

                if settings.perfectDayEnabled {

                    Stepper(
                        "Activitats mínimes: \(settings.perfectDayThreshold)",
                        value: Binding(
                            get: {
                                settings.perfectDayThreshold
                            },
                            set: {
                                settings.perfectDayThreshold = $0
                            }
                        ),
                        in: 2...7
                    )

                    VStack(
                        alignment: .leading,
                        spacing: 8
                    ) {

                        Text("Color dia excel·lent")

                        LazyVGrid(
                            columns: Array(
                                repeating: GridItem(.flexible()),
                                count: 5
                            )
                        ) {

                            ForEach(
                                colorOptions,
                                id: \.self
                            ) { hex in

                                Circle()
                                    .fill(Color(hex: hex))
                                    .frame(width: 32, height: 32)

                                    .overlay(
                                        Circle()
                                            .stroke(
                                                settings.perfectDayColorHex == hex
                                                ? Color.primary
                                                : Color.clear,
                                                lineWidth: 3
                                            )
                                    )

                                    .onTapGesture {
                                        settings.perfectDayColorHex = hex
                                    }
                            }
                        }
                    }
                }

                Toggle(
                    "Considerar variables amagades al calendari",
                    isOn: Binding(
                        get: {
                            settings.showHiddenVariablesInCalendar
                        },
                        set: {
                            settings.showHiddenVariablesInCalendar = $0
                        }
                    )
                )
            }
        }
        .navigationTitle("Calendari")
    }
}
