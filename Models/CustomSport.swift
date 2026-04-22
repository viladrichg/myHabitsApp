import SwiftData
import Foundation

@Model
final class CustomSport {
    @Attribute(.unique) var name: String
    var createdAt: Date = Date()
    init(name: String) { self.name = name }
}