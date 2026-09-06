import SwiftUI

struct SectionOrderView: View {

    @Environment(\.appTheme) var theme

    @Bindable var settings: AppSettings

    private let sectionNames: [String: String] = [
        "sleep": "Son",
        "work": "Treballat",
        "negative": "Mals hàbits",
        "positive": "Activitats",
        "sports": "Esports",
        "counter": "Comptador",
        "custom": "Personalitzats",
        "notes": "Notes"
    ]

    var body: some View {

        List {

            Section {

                ForEach(settings.sectionOrder, id: \.self) { key in

                    Text(sectionNames[key] ?? key)
                        .foregroundStyle(theme.text)
                }
                .onMove(perform: move)

            } header: {

                Text("Ordre dels blocs")
            }
            .listRowBackground(theme.card)
        }
        .scrollContentBackground(.hidden)
        .background(theme.bg.ignoresSafeArea())
        .navigationTitle("Ordre dels blocs")
        .toolbar {
            EditButton()
        }
    }

    private func move(
        from source: IndexSet,
        to destination: Int
    ) {

        var order = settings.sectionOrder

        order.move(
            fromOffsets: source,
            toOffset: destination
        )

        settings.sectionOrder = order
    }
}
