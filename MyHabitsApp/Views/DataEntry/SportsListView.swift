import SwiftUI
import SwiftData

struct SportsListView: View {
    
    @Environment(\.appTheme) var theme
    
    @Query(sort: \DailyEntry.date, order: .reverse)
    private var entries: [DailyEntry]
    
    @State private var period = "all"
    
    private var filteredEntries: [DailyEntry] {
        
        guard period != "all" else {
            return entries
        }
        
        let days: Int
        
        switch period {
            
        case "30":
            days = 30
            
        case "90":
            days = 90
            
        case "180":
            days = 180
            
        case "365":
            days = 365
            
        default:
            return entries
        }
        
        let cutoff = Calendar.current.date(
            byAdding: .day,
            value: -days,
            to: Date()
        )!.isoDate
        
        return entries.filter {
            $0.date >= cutoff
        }
    }
    
    private var sports: [(name: String, count: Int)] {
        
        var counts: [String:Int] = [:]
        
        for entry in filteredEntries {
            
            for sport in entry.sports {
                
                let parts = sport
                    .split(separator: ",")
                    .map {
                        $0.trimmingCharacters(
                            in: .whitespacesAndNewlines
                        )
                    }
                
                for part in parts where !part.isEmpty {
                    
                    counts[part, default: 0] += 1
                }
            }
        }
        
        return counts
            .map { (name: $0.key, count: $0.value) }
            .sorted { $0.count > $1.count }
    }
    
    private var periodLabel: String {
        
        switch period {
            
        case "30":
            return "Esports · 30 dies"
            
        case "90":
            return "Esports · 3 mesos"
            
        case "180":
            return "Esports · 6 mesos"
            
        case "365":
            return "Esports · 1 any"
            
        default:
            return "Esports · Tot"
        }
    }
    
    var body: some View {
        
        NavigationStack {
            
            VStack {
                
                Picker(
                    "Període",
                    selection: $period
                ) {
                    
                    Text("30 dies")
                        .tag("30")
                    
                    Text("3 mesos")
                        .tag("90")
                    
                    Text("6 mesos")
                        .tag("180")
                    
                    Text("1 any")
                        .tag("365")
                    
                    Text("Tot")
                        .tag("all")
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                
                List {
                    
                    ForEach(
                        Array(sports.enumerated()),
                        id: \.element.name
                    ) { index, sport in
                        
                        NavigationLink {
                            
                            SportDetailView(
                                sportName: sport.name
                            )
                            
                        } label: {
                            
                            HStack {
                                
                                if index == 0 {
                                    
                                    Text("🥇")
                                    
                                } else if index == 1 {
                                    
                                    Text("🥈")
                                    
                                } else if index == 2 {
                                    
                                    Text("🥉")
                                    
                                } else {
                                    
                                    Text("•")
                                        .foregroundStyle(
                                            theme.secondary
                                        )
                                }
                                
                                Text(sport.name)
                                
                                Spacer()
                                
                                Text("\(sport.count)")
                                    .foregroundStyle(
                                        theme.secondary
                                    )
                            }
                        }
                    }
                }
                .navigationTitle(periodLabel)
            }
        }
    }
}
