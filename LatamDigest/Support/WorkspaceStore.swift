import Foundation
import Combine

@MainActor
final class WorkspaceStore: ObservableObject {
    static let shared = WorkspaceStore()

    @Published private(set) var watchedTopics: [WatchTopic] = WatchTopic.defaultTopics
    @Published private(set) var dossiers: [Dossier] = []
    @Published private(set) var snapshots: [DailySnapshot] = []
    @Published private(set) var monitoringPlans: [TopicMonitoringPlan] = []
    @Published private(set) var analystTasks: [AnalystTask] = []

    private let defaults = UserDefaults.standard
    private let watchedTopicsKey = "watchedTopics"
    private let dossiersKey = "dossiers"
    private let snapshotsKey = "dailySnapshots"
    private let monitoringPlansKey = "topicMonitoringPlans"
    private let analystTasksKey = "analystTasks"
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private init() {
        loadState()
    }

    func isWatched(_ topic: WatchTopic) -> Bool {
        watchedTopics.contains(topic)
    }

    func monitoringPlan(for topic: WatchTopic) -> TopicMonitoringPlan {
        monitoringPlans.first(where: { $0.topicID == topic.rawValue }) ?? TopicMonitoringPlan(topic: topic)
    }

    func tasks(for topic: WatchTopic) -> [AnalystTask] {
        analystTasks
            .filter { $0.topicID == topic.rawValue }
            .sorted { lhs, rhs in
                if lhs.isCompleted == rhs.isCompleted {
                    return (lhs.dueDate ?? .distantFuture) < (rhs.dueDate ?? .distantFuture)
                }
                return !lhs.isCompleted && rhs.isCompleted
            }
    }

    func toggleWatched(_ topic: WatchTopic) {
        if let index = watchedTopics.firstIndex(of: topic) {
            watchedTopics.remove(at: index)
        } else {
            watchedTopics.append(topic)
            seedDefaultTasksIfNeeded(for: topic)
        }

        persistWatchedTopics()
    }

    func updateMonitoringPlan(_ plan: TopicMonitoringPlan) {
        if let index = monitoringPlans.firstIndex(where: { $0.id == plan.id }) {
            monitoringPlans[index] = plan
        } else {
            monitoringPlans.append(plan)
        }

        monitoringPlans.sort { lhs, rhs in
            if lhs.priority.rank == rhs.priority.rank {
                return lhs.lastUpdatedAt > rhs.lastUpdatedAt
            }

            return lhs.priority.rank > rhs.priority.rank
        }
        persistMonitoringPlans()
    }

    func seedDefaultTasksIfNeeded(for topic: WatchTopic) {
        let existingTemplates = Set(
            analystTasks
                .filter { $0.topicID == topic.rawValue }
                .compactMap(\.templateID)
        )

        let newTasks = AnalystTaskTemplate.allCases.compactMap { template -> AnalystTask? in
            guard !existingTemplates.contains(template.rawValue) else { return nil }
            return AnalystTask(
                topic: topic,
                template: template,
                dueDate: Calendar.current.date(byAdding: .day, value: 1, to: .now)
            )
        }

        guard !newTasks.isEmpty else { return }
        analystTasks.append(contentsOf: newTasks)
        persistAnalystTasks()
    }

    func updateTask(_ task: AnalystTask) {
        if let index = analystTasks.firstIndex(where: { $0.id == task.id }) {
            analystTasks[index] = task
        } else {
            analystTasks.append(task)
        }

        analystTasks.sort { lhs, rhs in
            if lhs.isCompleted == rhs.isCompleted {
                return (lhs.dueDate ?? .distantFuture) < (rhs.dueDate ?? .distantFuture)
            }
            return !lhs.isCompleted && rhs.isCompleted
        }
        persistAnalystTasks()
    }

    func toggleTaskCompletion(_ task: AnalystTask) {
        guard let index = analystTasks.firstIndex(where: { $0.id == task.id }) else { return }
        analystTasks[index].isCompleted.toggle()
        analystTasks[index].updatedAt = .now
        persistAnalystTasks()
    }

    func addCustomTask(title: String, detail: String, topic: WatchTopic, dueDate: Date?) {
        let task = AnalystTask(
            topic: topic,
            customTitle: title,
            customDetail: detail,
            dueDate: dueDate
        )
        analystTasks.append(task)
        persistAnalystTasks()
    }

    @discardableResult
    func createDossier(
        title: String,
        note: String,
        conclusion: String = "",
        recommendation: String = "",
        assessment: DossierAssessment = .developing,
        nextReviewAt: Date? = nil,
        topic: WatchTopic?,
        countryCode: String?
    ) -> Dossier {
        let dossier = Dossier(
            title: title,
            note: note,
            conclusion: conclusion,
            recommendation: recommendation,
            assessment: assessment,
            nextReviewAt: nextReviewAt,
            topicID: topic?.rawValue,
            countryCode: countryCode
        )
        dossiers.insert(dossier, at: 0)
        persistDossiers()
        return dossier
    }

    func updateDossier(_ dossier: Dossier) {
        guard let index = dossiers.firstIndex(where: { $0.id == dossier.id }) else { return }
        var updated = dossier
        updated.updatedAt = .now
        dossiers[index] = updated
        persistDossiers()
    }

    func deleteDossier(_ dossier: Dossier) {
        dossiers.removeAll { $0.id == dossier.id }
        persistDossiers()
    }

    @discardableResult
    func addArticle(_ article: Article, to dossier: Dossier) -> Dossier {
        guard let index = dossiers.firstIndex(where: { $0.id == dossier.id }) else { return dossier }
        if dossiers[index].evidence.contains(where: { $0.storageKey == article.storageKey }) {
            return dossiers[index]
        }

        dossiers[index].evidence.insert(article, at: 0)
        dossiers[index].updatedAt = .now
        persistDossiers()
        return dossiers[index]
    }

    func removeArticle(_ article: Article, from dossier: Dossier) {
        guard let index = dossiers.firstIndex(where: { $0.id == dossier.id }) else { return }
        dossiers[index].evidence.removeAll { $0.storageKey == article.storageKey }
        dossiers[index].updatedAt = .now
        persistDossiers()
    }

    func recordSnapshot(_ snapshot: DailySnapshot) {
        if let existingIndex = snapshots.firstIndex(where: { $0.id == snapshot.id }) {
            snapshots[existingIndex] = snapshot
        } else {
            snapshots.insert(snapshot, at: 0)
        }

        snapshots = Array(snapshots.sorted(by: { $0.createdAt > $1.createdAt }).prefix(14))
        persistSnapshots()
    }

    private func loadState() {
        decoder.dateDecodingStrategy = .iso8601
        encoder.dateEncodingStrategy = .iso8601

        if let storedTopics = defaults.array(forKey: watchedTopicsKey) as? [String] {
            let mapped = storedTopics.compactMap(WatchTopic.init(rawValue:))
            if !mapped.isEmpty {
                watchedTopics = mapped
            }
        }

        if
            let data = defaults.data(forKey: dossiersKey),
            let decoded = try? decoder.decode([Dossier].self, from: data)
        {
            dossiers = decoded
        }

        if
            let data = defaults.data(forKey: snapshotsKey),
            let decoded = try? decoder.decode([DailySnapshot].self, from: data)
        {
            snapshots = decoded.sorted(by: { $0.createdAt > $1.createdAt })
        }

        if
            let data = defaults.data(forKey: monitoringPlansKey),
            let decoded = try? decoder.decode([TopicMonitoringPlan].self, from: data)
        {
            monitoringPlans = decoded
        }

        if
            let data = defaults.data(forKey: analystTasksKey),
            let decoded = try? decoder.decode([AnalystTask].self, from: data)
        {
            analystTasks = decoded
        }

        watchedTopics.forEach(seedDefaultTasksIfNeeded(for:))
    }

    private func persistWatchedTopics() {
        defaults.set(watchedTopics.map(\.rawValue), forKey: watchedTopicsKey)
    }

    private func persistDossiers() {
        guard let data = try? encoder.encode(dossiers) else { return }
        defaults.set(data, forKey: dossiersKey)
    }

    private func persistSnapshots() {
        guard let data = try? encoder.encode(snapshots) else { return }
        defaults.set(data, forKey: snapshotsKey)
    }

    private func persistMonitoringPlans() {
        guard let data = try? encoder.encode(monitoringPlans) else { return }
        defaults.set(data, forKey: monitoringPlansKey)
    }

    private func persistAnalystTasks() {
        guard let data = try? encoder.encode(analystTasks) else { return }
        defaults.set(data, forKey: analystTasksKey)
    }
}
