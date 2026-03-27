import Foundation

enum MonitoringStatus: String, Codable, CaseIterable, Identifiable {
    case observing
    case escalating
    case archived

    var id: String { rawValue }

    var localizationKey: String {
        switch self {
        case .observing: return "monitoring_status_observing"
        case .escalating: return "monitoring_status_escalating"
        case .archived: return "monitoring_status_archived"
        }
    }
}

enum MonitoringPriority: String, Codable, CaseIterable, Identifiable {
    case background
    case active
    case urgent

    var id: String { rawValue }

    var localizationKey: String {
        switch self {
        case .background: return "monitoring_priority_background"
        case .active: return "monitoring_priority_active"
        case .urgent: return "monitoring_priority_urgent"
        }
    }

    var rank: Int {
        switch self {
        case .background: return 1
        case .active: return 2
        case .urgent: return 3
        }
    }
}

struct TopicMonitoringPlan: Identifiable, Codable, Equatable {
    let id: String
    let topicID: String
    var status: MonitoringStatus
    var priority: MonitoringPriority
    var analystNote: String
    var nextReviewAt: Date?
    var lastUpdatedAt: Date

    init(
        topic: WatchTopic,
        status: MonitoringStatus = .observing,
        priority: MonitoringPriority = .active,
        analystNote: String = "",
        nextReviewAt: Date? = nil,
        lastUpdatedAt: Date = .now
    ) {
        id = topic.rawValue
        topicID = topic.rawValue
        self.status = status
        self.priority = priority
        self.analystNote = analystNote
        self.nextReviewAt = nextReviewAt
        self.lastUpdatedAt = lastUpdatedAt
    }

    var topic: WatchTopic? {
        WatchTopic(rawValue: topicID)
    }
}
