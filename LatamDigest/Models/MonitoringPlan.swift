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

enum MonitoringConfidence: String, Codable, CaseIterable, Identifiable {
    case low
    case medium
    case high

    var id: String { rawValue }

    var localizationKey: String {
        switch self {
        case .low: return "monitoring_confidence_low"
        case .medium: return "monitoring_confidence_medium"
        case .high: return "monitoring_confidence_high"
        }
    }
}

struct TopicMonitoringPlan: Identifiable, Codable, Equatable {
    let id: String
    let topicID: String
    var status: MonitoringStatus
    var priority: MonitoringPriority
    var confidence: MonitoringConfidence
    var workingThesis: String
    var decisionSummary: String
    var analystNote: String
    var nextReviewAt: Date?
    var lastUpdatedAt: Date

    init(
        topic: WatchTopic,
        status: MonitoringStatus = .observing,
        priority: MonitoringPriority = .active,
        confidence: MonitoringConfidence = .medium,
        workingThesis: String = "",
        decisionSummary: String = "",
        analystNote: String = "",
        nextReviewAt: Date? = nil,
        lastUpdatedAt: Date = .now
    ) {
        id = topic.rawValue
        topicID = topic.rawValue
        self.status = status
        self.priority = priority
        self.confidence = confidence
        self.workingThesis = workingThesis
        self.decisionSummary = decisionSummary
        self.analystNote = analystNote
        self.nextReviewAt = nextReviewAt
        self.lastUpdatedAt = lastUpdatedAt
    }

    var topic: WatchTopic? {
        WatchTopic(rawValue: topicID)
    }

    enum CodingKeys: String, CodingKey {
        case id
        case topicID
        case status
        case priority
        case confidence
        case workingThesis
        case decisionSummary
        case analystNote
        case nextReviewAt
        case lastUpdatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        topicID = try container.decode(String.self, forKey: .topicID)
        status = try container.decodeIfPresent(MonitoringStatus.self, forKey: .status) ?? .observing
        priority = try container.decodeIfPresent(MonitoringPriority.self, forKey: .priority) ?? .active
        confidence = try container.decodeIfPresent(MonitoringConfidence.self, forKey: .confidence) ?? .medium
        workingThesis = try container.decodeIfPresent(String.self, forKey: .workingThesis) ?? ""
        decisionSummary = try container.decodeIfPresent(String.self, forKey: .decisionSummary) ?? ""
        analystNote = try container.decodeIfPresent(String.self, forKey: .analystNote) ?? ""
        nextReviewAt = try container.decodeIfPresent(Date.self, forKey: .nextReviewAt)
        lastUpdatedAt = try container.decodeIfPresent(Date.self, forKey: .lastUpdatedAt) ?? .now
    }
}
