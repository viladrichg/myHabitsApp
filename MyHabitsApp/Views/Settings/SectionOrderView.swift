import SwiftUI

struct SectionOrderView: View {

    @Environment(\.appTheme) var theme

    @Bindable var settings: AppSettings
    
    @State private var showingRename = false
    @State private var editingKey: String?
    @State private var editingText = ""

    private let defaultSectionNames: [String: String] = [
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
                    
                    HStack {
                        
                        Text(sectionName(key))
                        
                        Spacer()
                        
                        if key != "counter" {
                            
                            Button {
                                
                                editingKey = key
                                editingText = sectionName(key)
                                showingRename = true
                                
                            } label: {
                                
                                Image(systemName: "pencil")
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .onMove(perform: move)
                
            } header: {
                
                Text("Ordre i nom dels blocs")
            }
            .listRowBackground(theme.card)
        }
        .scrollContentBackground(.hidden)
        .background(theme.bg.ignoresSafeArea())
        .navigationTitle("Ordre i nom dels blocs")
        .toolbar {
            EditButton()
            
        }.alert(
            "Nom del bloc",
            isPresented: $showingRename
        ) {
            
            TextField(
                "Nom",
                text: $editingText
            )
            
            Button(
                "Cancel·lar",
                role: .cancel
            ) { }
            
            Button("Desar") {
                
                guard let key = editingKey else {
                    return
                }
                
                var names = settings.blockNames
                names[key] = editingText
                settings.blockNames = names
            }
            
        }
    }
    
    private func sectionName(
        _ key: String
    ) -> String {

        settings.blockName(key)
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
