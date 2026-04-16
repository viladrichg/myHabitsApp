import SwiftUI
import Foundation

// MARK: - Color from hex string

extension Color {
    init(hex: String) {
        var h = hex.trimmingCharacters(in: .alphanumerics.inverted)
        if h.count == 3 {
            h = h.map { "\($0)\($0)" }.joined()
        }
        var int: UInt64 = 0
        Scanner(string: h).scanHexInt64(&int)
        self.init(
            .sRGB,
            red:   Double((int >> 16) & 0xFF) / 255,
            green: Double((int >>  8) & 0xFF) / 255,
            blue:  Double( int        & 0xFF) / 255,
            opacity: 1
        )
    }
}

// MARK: - Date helpers

extension Date {
    /// Returns "YYYY-MM-DD"
    var isoDate: String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        return f.string(from: self)
    }

    /// Parses "YYYY-MM-DD" into a Date (noon, local time zone)
    static func from(isoDate: String) -> Date? {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        return f.date(from: isoDate)
    }

    /// "dd/MM/yyyy"
    var displayDate: String {
        let f = DateFormatter()
        f.dateFormat = "dd/MM/yyyy"
        return f.string(from: self)
    }

    var startOfDay: Date {
        Calendar.current.startOfDay(for: self)
    }
}

// MARK: - String helpers

extension String {
    /// Parses "HH:mm" into (hour, minute) tuple
    func parseHHmm() -> (hour: Int, minute: Int)? {
        let parts = split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2 else { return nil }
        return (parts[0], parts[1])
    }
}

// MARK: - Card modifier

struct CardModifier: ViewModifier {
    @Environment(\.appTheme) var theme
    func body(content: Content) -> some View {
        content
            .background(theme.card)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(theme.border, lineWidth: 0.5)
            )
    }
}

extension View {
    func cardStyle() -> some View { modifier(CardModifier()) }
}
