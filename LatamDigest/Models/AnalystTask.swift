import Foundation

enum AnalystTaskTemplate: String, Codable, CaseIterable, Identifiable {
    case reviewShift
    case compareImpact
    case writeConclusion

    var id: String { rawValue }

    var titleKey: String {
        switch self {
        case .reviewShift: return "task_template_review_shift_title"
        case .compareImpact: return "task_template_compare_impact_title"
        case .writeConclusion: return "task_template_write_conclusion_title"
        }
    }

    var detailKey: String {
        switch self {
        case .reviewShift: return "task_template_review_shift_detail"
        case .compareImpact: return "task_template_compare_impact_detail"
        case .writeConclusion: return "task_template_write_conclusion_detail"
        }
    }
}

struct AnalystTask: Identifiable, Codable, Equatable {
    let id: UUID
    let topicID: String
    var templateID: String?
    var customTitle: String?
    var customDetail: String?
    var isCompleted: Bool
    var dueDate: Date?
    let createdAt: Date
    var updatedAt: Date

    init(
        id: UUID = UUID(),
        topic: WatchTopic,
        template: AnalystTaskTemplate? = nil,
        customTitle: String? = nil,
        customDetail: String? = nil,
        isCompleted: Bool = false,
        dueDate: Date? = nil,
        createdAt: Date = .now,
        updatedAt: Date = .now
    ) {
        self.id = id
        topicID = topic.rawValue
        templateID = template?.rawValue
        self.customTitle = customTitle
        self.customDetail = customDetail
        self.isCompleted = isCompleted
        self.dueDate = dueDate
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    var topic: WatchTopic? {
        WatchTopic(rawValue: topicID)
    }

    var template: AnalystTaskTemplate? {
        guard let templateID else { return nil }
        return AnalystTaskTemplate(rawValue: templateID)
    }

    func localizedTitle(languageCode: String) -> String {
        if let customTitle, !customTitle.isEmpty {
            return customTitle
        }

        guard let template, let topic else {
            return AppLanguage.localized("task_fallback_title", languageCode: languageCode)
        }

        return AppLanguage.localizedFormat(
            template.titleKey,
            languageCode: languageCode,
            AppLanguage.localized(topic.localizationKey, languageCode: languageCode)
        )
    }

    func localizedDetail(languageCode: String) -> String {
        if let customDetail, !customDetail.isEmpty {
            return customDetail
        }

        guard let template, let topic else {
            return ""
        }

        return AppLanguage.localizedFormat(
            template.detailKey,
            languageCode: languageCode,
            AppLanguage.localized(topic.localizationKey, languageCode: languageCode)
        )
    }
}
