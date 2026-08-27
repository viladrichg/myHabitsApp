import SwiftUI

// MARK: - Theme Colors

struct ThemeColors {
    let name: String
    let bg: Color
    let card: Color
    let text: Color
    let secondary: Color
    let accent: Color
    let border: Color
}

// MARK: - AppTheme

enum AppTheme {
    static let all: [(id: String, colors: ThemeColors)] = [
        ("dark",      .init(name: "Dark",      bg: hex("#0f172a"), card: hex("#1e293b"), text: hex("#f1f5f9"), secondary: hex("#94a3b8"), accent: hex("#3b82f6"), border: hex("#334155"))),
        ("forest",    .init(name: "Forest",    bg: hex("#052e16"), card: hex("#14532d"), text: hex("#ecfdf5"), secondary: hex("#86efac"), accent: hex("#22c55e"), border: hex("#166534"))),
        ("ocean",     .init(name: "Ocean",     bg: hex("#0c4a6e"), card: hex("#075985"), text: hex("#f0f9ff"), secondary: hex("#7dd3fc"), accent: hex("#0ea5e9"), border: hex("#0369a1"))),
        ("rose",      .init(name: "Rose",      bg: hex("#1a0a10"), card: hex("#2d1320"), text: hex("#fff1f2"), secondary: hex("#fda4af"), accent: hex("#f43f5e"), border: hex("#4c1a28"))),
        ("nord",      .init(name: "Nord",      bg: hex("#2e3440"), card: hex("#3b4252"), text: hex("#eceff4"), secondary: hex("#d8dee9"), accent: hex("#88c0d0"), border: hex("#4c566a"))),
        ("coffee",    .init(name: "Coffee",    bg: hex("#1c1008"), card: hex("#2d1f10"), text: hex("#fdf8f0"), secondary: hex("#d4a96a"), accent: hex("#b5752a"), border: hex("#3d2a14"))),
        ("arctic",    .init(name: "Arctic",    bg: hex("#e8f4f8"), card: hex("#ffffff"), text: hex("#1a3a4a"), secondary: hex("#5a8a9f"), accent: hex("#0891b2"), border: hex("#bae6fd"))),
       //------------nous --------------
        ("sapphire", .init(
            name: "Safir",
            bg: hex("#0b102d"),
            card: hex("#13204a"),
            text: hex("#f8fafc"),
            secondary: hex("#93c5fd"),
            accent: hex("#2563EB"),
            border: hex("#1d4ed8")
        )),
        ("turquoise", .init(
            name: "Turquesa",
            bg: hex("#082f33"),
            card: hex("#115e59"),
            text: hex("#ecfeff"),
            secondary: hex("#99f6e4"),
            accent: hex("#14B8A6"),
            border: hex("#0f766e")
        )),
        ("lavender", .init(
            name: "Lavanda",
            bg: hex("#1e1b3a"),
            card: hex("#312e81"),
            text: hex("#faf5ff"),
            secondary: hex("#c4b5fd"),
            accent: hex("#A78BFA"),
            border: hex("#6d28d9")
        )),
        ("coral", .init(
            name: "Corall",
            bg: hex("#2b1515"),
            card: hex("#552727"),
            text: hex("#fff7f7"),
            secondary: hex("#fca5a5"),
            accent: hex("#FF6B6B"),
            border: hex("#dc2626")
        )),
        ("orange", .init(
            name: "Taronja",
            bg: hex("#2a1405"),
            card: hex("#4a250a"),
            text: hex("#fffaf5"),
            secondary: hex("#fdba74"),
            accent: hex("#F97316"),
            border: hex("#ea580c")
        )),
        ("graphite", .init(
            name: "Grafit",
            bg: hex("#111827"),
            card: hex("#1f2937"),
            text: hex("#f9fafb"),
            secondary: hex("#9ca3af"),
            accent: hex("#4B5563"),
            border: hex("#374151")
        )),
        ("night", .init(
            name: "Nit",
            bg: hex("#081226"),
            card: hex("#0f2347"),
            text: hex("#f8fafc"),
            secondary: hex("#93c5fd"),
            accent: hex("#1E3A8A"),
            border: hex("#1d4ed8")
        )),
        ("mustard", .init(
            name: "Mostassa",
            bg: hex("#2b2210"),
            card: hex("#49391a"),
            text: hex("#fffdf5"),
            secondary: hex("#e7d3a5"),
            accent: hex("#D4A017"),
            border: hex("#a16207")
        )),
        ("copper", .init(
            name: "Coure",
            bg: hex("#2b1810"),
            card: hex("#4b2a1d"),
            text: hex("#fff8f3"),
            secondary: hex("#ddb59c"),
            accent: hex("#B87333"),
            border: hex("#92400e")
        )),
        ("ice", .init(
            name: "Gel",
            bg: hex("#eef4f7"),
            card: hex("#ffffff"),
            text: hex("#1f2937"),
            secondary: hex("#6b7280"),
            accent: hex("#C9D6DF"),
            border: hex("#cbd5e1")
        )),
    ]

    static func colors(for id: String) -> ThemeColors {
        all.first(where: { $0.id == id })?.colors ?? all[0].colors
    }

    private static func hex(_ s: String) -> Color { Color(hex: s) }
}

// MARK: - Environment Key

private struct ThemeColorKey: EnvironmentKey {
    static let defaultValue = AppTheme.colors(for: "dark")
}

extension EnvironmentValues {
    var appTheme: ThemeColors {
        get { self[ThemeColorKey.self] }
        set { self[ThemeColorKey.self] = newValue }
    }
}
