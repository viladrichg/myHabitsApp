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
        ("midnight",  .init(name: "Midnight",  bg: hex("#030712"), card: hex("#111827"), text: hex("#f9fafb"), secondary: hex("#9ca3af"), accent: hex("#8b5cf6"), border: hex("#1f2937"))),
        ("forest",    .init(name: "Forest",    bg: hex("#052e16"), card: hex("#14532d"), text: hex("#ecfdf5"), secondary: hex("#86efac"), accent: hex("#22c55e"), border: hex("#166534"))),
        ("ocean",     .init(name: "Ocean",     bg: hex("#0c4a6e"), card: hex("#075985"), text: hex("#f0f9ff"), secondary: hex("#7dd3fc"), accent: hex("#0ea5e9"), border: hex("#0369a1"))),
        ("rose",      .init(name: "Rose",      bg: hex("#1a0a10"), card: hex("#2d1320"), text: hex("#fff1f2"), secondary: hex("#fda4af"), accent: hex("#f43f5e"), border: hex("#4c1a28"))),
        ("amber",     .init(name: "Amber",     bg: hex("#1c1500"), card: hex("#292100"), text: hex("#fffbeb"), secondary: hex("#fcd34d"), accent: hex("#f59e0b"), border: hex("#3d2e00"))),
        ("nord",      .init(name: "Nord",      bg: hex("#2e3440"), card: hex("#3b4252"), text: hex("#eceff4"), secondary: hex("#d8dee9"), accent: hex("#88c0d0"), border: hex("#4c566a"))),
        ("coffee",    .init(name: "Coffee",    bg: hex("#1c1008"), card: hex("#2d1f10"), text: hex("#fdf8f0"), secondary: hex("#d4a96a"), accent: hex("#b5752a"), border: hex("#3d2a14"))),
        ("lavender",  .init(name: "Lavender",  bg: hex("#0f0b1e"), card: hex("#1a1535"), text: hex("#f5f3ff"), secondary: hex("#c4b5fd"), accent: hex("#7c3aed"), border: hex("#2e2350"))),
        ("light",     .init(name: "Light",     bg: hex("#f8fafc"), card: hex("#ffffff"), text: hex("#1e293b"), secondary: hex("#64748b"), accent: hex("#3b82f6"), border: hex("#e2e8f0"))),
        ("arctic",    .init(name: "Arctic",    bg: hex("#e8f4f8"), card: hex("#ffffff"), text: hex("#1a3a4a"), secondary: hex("#5a8a9f"), accent: hex("#0891b2"), border: hex("#bae6fd"))),
        ("mint",      .init(name: "Mint",      bg: hex("#f0fdf8"), card: hex("#dcfdf0"), text: hex("#1a3d2a"), secondary: hex("#4a8a70"), accent: hex("#10b981"), border: hex("#a7f3d0"))),
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
