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
        ("dark",      .init(name: "Nit",      bg: hex("#0f172a"), card: hex("#1e293b"), text: hex("#f1f5f9"), secondary: hex("#94a3b8"), accent: hex("#3b82f6"), border: hex("#334155"))),
        ("nord",      .init(name: "Grafit",      bg: hex("#2e3440"), card: hex("#3b4252"), text: hex("#eceff4"), secondary: hex("#d8dee9"), accent: hex("#88c0d0"), border: hex("#4c566a"))),
        ("graphite", .init(name: "Cendra", bg: hex("#111827"), card: hex("#1f2937"), text: hex("#f9fafb"), secondary: hex("#9ca3af"), accent: hex("#9CA3AF"), border: hex("#6B7280"))),
        ("forest",    .init(name: "Bosc",    bg: hex("#052e16"), card: hex("#14532d"), text: hex("#ecfdf5"), secondary: hex("#86efac"), accent: hex("#22c55e"), border: hex("#166534"))),
        ("rose",      .init(name: "Foc",      bg: hex("#1a0a10"), card: hex("#2d1320"), text: hex("#fff1f2"), secondary: hex("#fda4af"), accent: hex("#f43f5e"), border: hex("#4c1a28"))),
        ("coffee",    .init(name: "Terra",    bg: hex("#1c1008"), card: hex("#2d1f10"), text: hex("#fdf8f0"), secondary: hex("#d4a96a"), accent: hex("#b5752a"), border: hex("#3d2a14"))),
        ("mustard", .init(name: "Coure", bg: hex("#2b2210"), card: hex("#49391a"), text: hex("#fffdf5"), secondary: hex("#e7d3a5"), accent: hex("#FBBF24"), border: hex("#FCD34D"))),
        ("turquoise", .init(name: "Turquesa", bg: hex("#082f33"), card: hex("#115e59"), text: hex("#f8fffe"), secondary: hex("#d1fae5"), accent: hex("#2dd4bf"), border: hex("#5eead4"))),
        ("coral", .init(name: "Corall", bg: hex("#2b1515"), card: hex("#552727"), text: hex("#fff7f7"), secondary: hex("#fecaca"), accent: hex("#fb7185"), border: hex("#fca5a5"))),
        ("ocean",     .init(name: "Oceà",     bg: hex("#0c4a6e"), card: hex("#075985"), text: hex("#f0f9ff"), secondary: hex("#7dd3fc"), accent: hex("#0ea5e9"), border: hex("#0369a1"))),
        ("arctic", .init(name: "Cel", bg: hex("#bfe8ff"), card: hex("#e8f7ff"), text: hex("#102a3a"), secondary: hex("#42708a"), accent: hex("#00AEEF"), border: hex("#5FD3FF"))),
        ("arctic2", .init(name: "Vent", bg: hex("#cfefff"), card: hex("#eef9ff"), text: hex("#123247"), secondary: hex("#3d7390"), accent: hex("#00B7FF"), border: hex("#7DDFFF"))),
        ("arctic3", .init(name: "Gel", bg: hex("#dff4ff"), card: hex("#f7fcff"), text: hex("#163142"), secondary: hex("#4f7f97"), accent: hex("#38BDF8"), border: hex("#7DD3FC"))),
        ("ice", .init(name: "Neu", bg: hex("#eef4f7"), card: hex("#ffffff"), text: hex("#1f2937"), secondary: hex("#6b7280"), accent: hex("#60A5FA"), border: hex("#93C5FD"))),
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
