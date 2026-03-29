import Foundation

enum DossierAssessment: String, Codable, CaseIterable, Identifiable {
    case exploratory
    case developing
    case confirmed

    var id: String { rawValue }

    var localizationKey: String {
        switch self {
        case .exploratory: return "dossier_assessment_exploratory"
        case .developing: return "dossier_assessment_developing"
        case .confirmed: return "dossier_assessment_confirmed"
        }
    }
}

struct Dossier: Identifiable, Codable, Equatable {
    let id: UUID
    var title: String
    var note: String
    var conclusion: String
    var recommendation: String
    var assessment: DossierAssessment
    var nextReviewAt: Date?
    var topicID: String?
    var countryCode: String?
    var evidence: [Article]
    let createdAt: Date
    var updatedAt: Date

    init(
        id: UUID = UUID(),
        title: String,
        note: String = "",
        conclusion: String = "",
        recommendation: String = "",
        assessment: DossierAssessment = .developing,
        nextReviewAt: Date? = nil,
        topicID: String? = nil,
        countryCode: String? = nil,
        evidence: [Article] = [],
        createdAt: Date = .now,
        updatedAt: Date = .now
    ) {
        self.id = id
        self.title = title
        self.note = note
        self.conclusion = conclusion
        self.recommendation = recommendation
        self.assessment = assessment
        self.nextReviewAt = nextReviewAt
        self.topicID = topicID
        self.countryCode = countryCode
        self.evidence = evidence
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    var topic: WatchTopic? {
        guard let topicID else { return nil }
        return WatchTopic(rawValue: topicID)
    }

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case note
        case conclusion
        case recommendation
        case assessment
        case nextReviewAt
        case topicID
        case countryCode
        case evidence
        case createdAt
        case updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        title = try container.decode(String.self, forKey: .title)
        note = try container.decodeIfPresent(String.self, forKey: .note) ?? ""
        conclusion = try container.decodeIfPresent(String.self, forKey: .conclusion) ?? ""
        recommendation = try container.decodeIfPresent(String.self, forKey: .recommendation) ?? ""
        assessment = try container.decodeIfPresent(DossierAssessment.self, forKey: .assessment) ?? .developing
        nextReviewAt = try container.decodeIfPresent(Date.self, forKey: .nextReviewAt)
        topicID = try container.decodeIfPresent(String.self, forKey: .topicID)
        countryCode = try container.decodeIfPresent(String.self, forKey: .countryCode)
        evidence = try container.decodeIfPresent([Article].self, forKey: .evidence) ?? []
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        updatedAt = try container.decode(Date.self, forKey: .updatedAt)
    }
}

struct SignalCard: Identifiable, Equatable {
    let id: String
    let topic: WatchTopic
    let countryCode: String
    let countryName: String
    let summary: String
    let changeSummary: String
    let intensity: SignalIntensity
    let momentum: SignalMomentum
    let score: Int
    let evidence: [Article]
    let updatedAt: Date
}

struct ComparisonRow: Identifiable, Equatable {
    let id: String
    let countryCode: String
    let countryName: String
    let summary: String
    let intensity: SignalIntensity
    let momentum: SignalMomentum
    let score: Int
    let evidenceCount: Int
    let updatedAt: Date?
}
