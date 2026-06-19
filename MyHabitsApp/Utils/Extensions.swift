import SwiftUI
import Foundation

// MARK: - Color from hex string ✅ IMPROVED

extension Color {
    init(hex: String) {
        let hex = hex
            .trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
            .uppercased()  // ✅ CHANGE: evitar errors minúscules

        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)

        let a, r, g, b: UInt64

        switch hex.count {
        case 6: // RGB
            (a, r, g, b) = (255,
                           (int >> 16) & 0xFF,
                           (int >> 8) & 0xFF,
                           int & 0xFF)

        case 8: // ARGB ✅ CHANGE: suport opcional
            (a, r, g, b) = (
                (int >> 24) & 0xFF,
                (int >> 16) & 0xFF,
                (int >> 8) & 0xFF,
                int & 0xFF
            )

        default:
            // ✅ CHANGE: fallback segur
            (a, r, g, b) = (255, 120, 120, 120)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}


// MARK: - Date helpers

extension Date {

    var isoDate: String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        return f.string(from: self)
    }

    static func from(isoDate: String) -> Date? {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        return f.date(from: isoDate)
    }

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
    func parseHHmm() -> (hour: Int, minute: Int)? {
        let parts = split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2 else { return nil }
        return (parts[0], parts[1])
    }
}


// MARK: - Card modifier ✅ IMPROVED (millor contrast)

struct CardModifier: ViewModifier {
    @Environment(\.appTheme) var theme

    func body(content: Content) -> some View {
        content
            .padding(8) // ✅ CHANGE: espai consistent
            .background(theme.card)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(theme.border.opacity(0.6), lineWidth: 1) // ✅ CHANGE
            )
    }
}

extension View {
    func cardStyle() -> some View {
        modifier(CardModifier())
    }
}

import UIKit

extension UIApplication {

    func topMostViewController(
        _ base: UIViewController? = UIApplication.shared
            .connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }?.rootViewController
    ) -> UIViewController? {

        if let nav = base as? UINavigationController {
            return topMostViewController(nav.visibleViewController)
        }

        if let tab = base as? UITabBarController {
            return topMostViewController(tab.selectedViewController)
        }

        if let presented = base?.presentedViewController {
            return topMostViewController(presented)
        }

        return base
    }
}
