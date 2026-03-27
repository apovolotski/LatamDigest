import Foundation

enum SignalIntensity: String, Codable, CaseIterable {
    case watch
    case active
    case elevated

    var localizationKey: String {
        switch self {
        case .watch: return "signal_intensity_watch"
        case .active: return "signal_intensity_active"
        case .elevated: return "signal_intensity_elevated"
        }
    }

    var rank: Int {
        switch self {
        case .watch: return 1
        case .active: return 2
        case .elevated: return 3
        }
    }
}

enum SignalMomentum: String, Codable, CaseIterable {
    case new
    case rising
    case steady
    case cooling

    var localizationKey: String {
        switch self {
        case .new: return "signal_momentum_new"
        case .rising: return "signal_momentum_rising"
        case .steady: return "signal_momentum_steady"
        case .cooling: return "signal_momentum_cooling"
        }
    }
}

struct TopicSnapshot: Identifiable, Codable, Equatable {
    let id: String
    let topicID: String
    let title: String
    let summary: String
    let leadingCountryNames: [String]
    let intensity: SignalIntensity
    let momentum: SignalMomentum
    let evidenceCount: Int
    let updatedAt: Date

    var topic: WatchTopic? {
        WatchTopic(rawValue: topicID)
    }
}

struct DailySnapshot: Identifiable, Codable, Equatable {
    let id: String
    let createdAt: Date
    let countryCodes: [String]
    let headline: String
    let changeSummary: String
    let topicSnapshots: [TopicSnapshot]
}
