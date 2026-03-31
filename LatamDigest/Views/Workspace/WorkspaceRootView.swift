import SwiftUI

private enum WorkspaceTab: Hashable {
    case dashboard
    case watchlists
    case compare
    case timeline
    case dossiers
}

struct WorkspaceRootView: View {
    @AppStorage("preferredLanguage") private var preferredLanguage: String = Locale.current.language.languageCode?.identifier ?? "es"
    @AppStorage("selectedCountries") private var selectedCountriesString: String = ""
    @EnvironmentObject private var library: ReadingLibrary
    @EnvironmentObject private var workspaceStore: WorkspaceStore
    @StateObject private var viewModel = MonitoringWorkspaceViewModel()
    @State private var selectedTab: WorkspaceTab = .dashboard

    private var selectedCountryCodes: [String] {
        selectedCountriesString
            .split(separator: ",")
            .map { String($0) }
    }

    private var selectedCountries: [Country] {
        viewModel.countries(for: selectedCountryCodes, languageCode: preferredLanguage)
    }

    private var dashboardSignals: [SignalCard] {
        SignalEngine.dashboardSignals(
            countries: selectedCountries,
            articlesByCountry: viewModel.articlesByCountry,
            watchedTopics: workspaceStore.watchedTopics,
            languageCode: preferredLanguage
        )
    }

    private var latestSnapshot: DailySnapshot? {
        workspaceStore.snapshots.first
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                DashboardView(
                    countries: selectedCountries,
                    signals: dashboardSignals,
                    dossiers: workspaceStore.dossiers,
                    snapshots: workspaceStore.snapshots,
                    monitoringPlans: workspaceStore.monitoringPlans,
                    languageCode: preferredLanguage,
                    onSelectTab: { selectedTab = $0 }
                )
                .navigationDestination(for: WatchTopic.self) { topic in
                    TopicWorkspaceView(
                        topic: topic,
                        countries: selectedCountries,
                        articlesByCountry: viewModel.articlesByCountry,
                        languageCode: preferredLanguage
                    )
                }
                .toolbar {
                    NavigationLink(destination: SettingsView()) {
                        Image(systemName: "gearshape")
                    }
                }
            }
            .tabItem {
                Label(
                    AppLanguage.localized("workspace_tab_dashboard", languageCode: preferredLanguage),
                    systemImage: "rectangle.grid.2x2"
                )
            }
            .tag(WorkspaceTab.dashboard)

            NavigationStack {
                WatchlistsView(
                    countries: selectedCountries,
                    articlesByCountry: viewModel.articlesByCountry,
                    languageCode: preferredLanguage
                )
                .navigationDestination(for: WatchTopic.self) { topic in
                    TopicWorkspaceView(
                        topic: topic,
                        countries: selectedCountries,
                        articlesByCountry: viewModel.articlesByCountry,
                        languageCode: preferredLanguage
                    )
                }
            }
            .tabItem {
                Label(
                    AppLanguage.localized("workspace_tab_watchlists", languageCode: preferredLanguage),
                    systemImage: "dot.scope.display"
                )
            }
            .tag(WorkspaceTab.watchlists)

            NavigationStack {
                CompareView(
                    countries: selectedCountries,
                    articlesByCountry: viewModel.articlesByCountry,
                    languageCode: preferredLanguage
                )
                .navigationDestination(for: WatchTopic.self) { topic in
                    TopicWorkspaceView(
                        topic: topic,
                        countries: selectedCountries,
                        articlesByCountry: viewModel.articlesByCountry,
                        languageCode: preferredLanguage
                    )
                }
            }
            .tabItem {
                Label(
                    AppLanguage.localized("workspace_tab_compare", languageCode: preferredLanguage),
                    systemImage: "arrow.left.arrow.right.square"
                )
            }
            .tag(WorkspaceTab.compare)

            NavigationStack {
                TimelineView(
                    snapshots: workspaceStore.snapshots,
                    languageCode: preferredLanguage
                )
            }
            .tabItem {
                Label(
                    AppLanguage.localized("workspace_tab_timeline", languageCode: preferredLanguage),
                    systemImage: "clock.arrow.trianglehead.counterclockwise.rotate.90"
                )
            }
            .tag(WorkspaceTab.timeline)

            NavigationStack {
                DossiersView(
                    countries: selectedCountries,
                    languageCode: preferredLanguage
                )
            }
            .tabItem {
                Label(
                    AppLanguage.localized("workspace_tab_dossiers", languageCode: preferredLanguage),
                    systemImage: "folder"
                )
            }
            .tag(WorkspaceTab.dossiers)
        }
        .task(id: selectedCountriesString) {
            await viewModel.load(countryCodes: selectedCountryCodes)
            if let snapshot = SignalEngine.dailySnapshot(
                countries: selectedCountries,
                watchedTopics: workspaceStore.watchedTopics,
                signals: dashboardSignals,
                languageCode: preferredLanguage
            ) {
                workspaceStore.recordSnapshot(snapshot)
            }
        }
    }
}

private struct DashboardView: View {
    let countries: [Country]
    let signals: [SignalCard]
    let dossiers: [Dossier]
    let snapshots: [DailySnapshot]
    let monitoringPlans: [TopicMonitoringPlan]
    let languageCode: String
    let onSelectTab: (WorkspaceTab) -> Void

    @EnvironmentObject private var workspaceStore: WorkspaceStore
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    private var latestSnapshot: DailySnapshot? {
        snapshots.first
    }

    private var topSignals: [SignalCard] {
        Array(signals.prefix(5))
    }

    private var prioritizedWatchTopics: [WatchTopic] {
        workspaceStore.watchedTopics.sorted { lhs, rhs in
            let lhsActivity = activityCount(for: lhs)
            let rhsActivity = activityCount(for: rhs)

            if lhsActivity == rhsActivity {
                return openTaskCount(for: lhs) > openTaskCount(for: rhs)
            }

            return lhsActivity > rhsActivity
        }
    }

    private var actionPlans: [TopicMonitoringPlan] {
        let watchedIDs = Set(workspaceStore.watchedTopics.map(\.rawValue))

        return monitoringPlans
            .filter { watchedIDs.contains($0.topicID) && $0.status != .archived }
            .sorted { lhs, rhs in
                if lhs.priority.rank == rhs.priority.rank {
                    return (lhs.nextReviewAt ?? .distantFuture) < (rhs.nextReviewAt ?? .distantFuture)
                }
                return lhs.priority.rank > rhs.priority.rank
            }
    }

    private var pendingTasks: [AnalystTask] {
        let watchedIDs = Set(workspaceStore.watchedTopics.map(\.rawValue))
        return workspaceStore.analystTasks
            .filter { watchedIDs.contains($0.topicID) && !$0.isCompleted }
            .sorted { lhs, rhs in
                (lhs.dueDate ?? .distantFuture) < (rhs.dueDate ?? .distantFuture)
            }
    }

    private func comparisonRows(for topic: WatchTopic) -> [ComparisonRow] {
        signals
            .filter { $0.topic == topic }
            .sorted { lhs, rhs in
                if lhs.score == rhs.score {
                    return lhs.updatedAt > rhs.updatedAt
                }
                return lhs.score > rhs.score
            }
            .map { signal in
                ComparisonRow(
                    id: signal.id,
                    countryCode: signal.countryCode,
                    countryName: signal.countryName,
                    summary: signal.summary,
                    intensity: signal.intensity,
                    momentum: signal.momentum,
                    score: signal.score,
                    evidenceCount: signal.evidence.count,
                    updatedAt: signal.updatedAt
                )
            }
    }

    private func activityCount(for topic: WatchTopic) -> Int {
        signals
            .filter { $0.topic == topic }
            .reduce(0) { $0 + $1.evidence.count }
    }

    private func openTaskCount(for topic: WatchTopic) -> Int {
        workspaceStore.tasks(for: topic).filter { !$0.isCompleted }.count
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                header
                heroCard
                metricsRow

                WorkspaceSectionHeader(
                    title: AppLanguage.localized("dashboard_section_watchlists", languageCode: languageCode),
                    subtitle: AppLanguage.localized("dashboard_section_watchlists_subtitle", languageCode: languageCode)
                )

                if prioritizedWatchTopics.isEmpty {
                    EmptyWorkspaceCard(
                        title: AppLanguage.localized("dashboard_empty_title", languageCode: languageCode),
                        message: AppLanguage.localized("dashboard_empty_message", languageCode: languageCode)
                    )
                } else {
                    VStack(spacing: 14) {
                        ForEach(prioritizedWatchTopics.prefix(3)) { topic in
                            NavigationLink(value: topic) {
                                WatchlistWorkspaceCard(
                                    topic: topic,
                                    rows: comparisonRows(for: topic),
                                    activityCount: activityCount(for: topic),
                                    openTaskCount: openTaskCount(for: topic),
                                    plan: workspaceStore.monitoringPlan(for: topic),
                                    languageCode: languageCode
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                WorkspaceSectionHeader(
                    title: AppLanguage.localized("dashboard_section_tools", languageCode: languageCode),
                    subtitle: AppLanguage.localized("dashboard_section_tools_subtitle", languageCode: languageCode)
                )

                if horizontalSizeClass == .compact {
                    VStack(spacing: 12) {
                        WorkspaceToolCard(
                            title: AppLanguage.localized("dashboard_tool_watchlists_title", languageCode: languageCode),
                            subtitle: AppLanguage.localized("dashboard_tool_watchlists_subtitle", languageCode: languageCode),
                            systemImage: "dot.scope.display",
                            action: { onSelectTab(.watchlists) }
                        )

                        WorkspaceToolCard(
                            title: AppLanguage.localized("dashboard_tool_compare_title", languageCode: languageCode),
                            subtitle: AppLanguage.localized("dashboard_tool_compare_subtitle", languageCode: languageCode),
                            systemImage: "arrow.left.arrow.right.square",
                            action: { onSelectTab(.compare) }
                        )
                    }
                } else {
                    HStack(spacing: 12) {
                        WorkspaceToolCard(
                            title: AppLanguage.localized("dashboard_tool_watchlists_title", languageCode: languageCode),
                            subtitle: AppLanguage.localized("dashboard_tool_watchlists_subtitle", languageCode: languageCode),
                            systemImage: "dot.scope.display",
                            action: { onSelectTab(.watchlists) }
                        )

                        WorkspaceToolCard(
                            title: AppLanguage.localized("dashboard_tool_compare_title", languageCode: languageCode),
                            subtitle: AppLanguage.localized("dashboard_tool_compare_subtitle", languageCode: languageCode),
                            systemImage: "arrow.left.arrow.right.square",
                            action: { onSelectTab(.compare) }
                        )
                    }
                }

                WorkspaceToolCard(
                    title: AppLanguage.localized("dashboard_tool_dossiers_title", languageCode: languageCode),
                    subtitle: AppLanguage.localized("dashboard_tool_dossiers_subtitle", languageCode: languageCode),
                    systemImage: "folder.badge.plus",
                    action: { onSelectTab(.dossiers) }
                )

                WorkspaceSectionHeader(
                    title: AppLanguage.localized("dashboard_section_action_queue", languageCode: languageCode),
                    subtitle: AppLanguage.localized("dashboard_section_action_queue_subtitle", languageCode: languageCode)
                )

                if actionPlans.isEmpty {
                    EmptyWorkspaceCard(
                        title: AppLanguage.localized("dashboard_action_queue_empty_title", languageCode: languageCode),
                        message: AppLanguage.localized("dashboard_action_queue_empty_message", languageCode: languageCode)
                    )
                } else {
                    VStack(spacing: 12) {
                        ForEach(actionPlans.prefix(3)) { plan in
                            if let topic = plan.topic {
                                NavigationLink(value: topic) {
                                    ActionQueueCard(plan: plan, languageCode: languageCode)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }

                WorkspaceSectionHeader(
                    title: AppLanguage.localized("dashboard_section_tasks", languageCode: languageCode),
                    subtitle: AppLanguage.localized("dashboard_section_tasks_subtitle", languageCode: languageCode)
                )

                if pendingTasks.isEmpty {
                    EmptyWorkspaceCard(
                        title: AppLanguage.localized("dashboard_tasks_empty_title", languageCode: languageCode),
                        message: AppLanguage.localized("dashboard_tasks_empty_message", languageCode: languageCode)
                    )
                } else {
                    VStack(spacing: 12) {
                        ForEach(pendingTasks.prefix(4)) { task in
                            AnalystTaskCard(task: task, languageCode: languageCode)
                        }
                    }
                }

                WorkspaceSectionHeader(
                    title: AppLanguage.localized("dashboard_section_dossiers", languageCode: languageCode),
                    subtitle: AppLanguage.localized("dashboard_section_dossiers_subtitle", languageCode: languageCode)
                )

                if dossiers.isEmpty {
                    EmptyWorkspaceCard(
                        title: AppLanguage.localized("dossiers_empty_title", languageCode: languageCode),
                        message: AppLanguage.localized("dossiers_empty_message", languageCode: languageCode)
                    )
                } else {
                    VStack(spacing: 12) {
                        ForEach(dossiers.prefix(3)) { dossier in
                            DossierRowCard(
                                dossier: dossier,
                                countries: countries,
                                languageCode: languageCode
                            )
                        }
                    }
                }

                if let latestSnapshot {
                    WorkspaceSectionHeader(
                        title: AppLanguage.localized("dashboard_section_timeline", languageCode: languageCode),
                        subtitle: AppLanguage.localized("dashboard_section_timeline_subtitle", languageCode: languageCode)
                    )

                    NavigationLink {
                        TimelineView(snapshots: snapshots, languageCode: languageCode)
                    } label: {
                        SnapshotRowCard(snapshot: latestSnapshot, languageCode: languageCode)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding()
        }
        .navigationTitle(AppLanguage.localized("dashboard_nav_title", languageCode: languageCode))
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(AppLanguage.localized("dashboard_title", languageCode: languageCode))
                .font(.largeTitle)
                .fontWeight(.bold)
            Text(AppLanguage.localized("dashboard_subtitle", languageCode: languageCode))
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(AppLanguage.localized("dashboard_hero_title", languageCode: languageCode))
                .font(.title2.weight(.bold))

            Text(
                AppLanguage.localizedFormat(
                    "dashboard_hero_summary",
                    languageCode: languageCode,
                    countries.count,
                    workspaceStore.watchedTopics.count,
                    signals.count
                )
            )
            .font(.body)
            .foregroundStyle(.secondary)

            if let latestSnapshot {
                Text(latestSnapshot.headline)
                    .font(.headline)
                    .foregroundStyle(.primary)
                Text(latestSnapshot.changeSummary)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else if let leadSignal = topSignals.first {
                Text(leadSignal.summary)
                    .font(.subheadline)
                    .foregroundStyle(.primary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            Color.blue.opacity(0.08),
                            Color.orange.opacity(0.08)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        )
    }

    private var metricsRow: some View {
        HStack(spacing: 12) {
            DashboardMetricCard(
                title: AppLanguage.localized("dashboard_metric_countries", languageCode: languageCode),
                value: "\(countries.count)"
            )
            DashboardMetricCard(
                title: AppLanguage.localized("dashboard_metric_watchlists", languageCode: languageCode),
                value: "\(workspaceStore.watchedTopics.count)"
            )
            DashboardMetricCard(
                title: AppLanguage.localized("dashboard_metric_signals", languageCode: languageCode),
                value: "\(signals.filter { $0.intensity != .watch }.count)"
            )
        }
    }
}

private struct WatchlistsView: View {
    let countries: [Country]
    let articlesByCountry: [String: [Article]]
    let languageCode: String

    @EnvironmentObject private var workspaceStore: WorkspaceStore

    var body: some View {
        List {
            Section {
                Text(AppLanguage.localized("watchlists_intro", languageCode: languageCode))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .listRowBackground(Color.clear)
            }

            Section(AppLanguage.localized("watchlists_section_active", languageCode: languageCode)) {
                ForEach(workspaceStore.watchedTopics) { topic in
                    NavigationLink(value: topic) {
                        WatchlistWorkspaceCard(
                            topic: topic,
                            rows: comparisonRows(for: topic),
                            activityCount: activityCount(for: topic),
                            openTaskCount: openTaskCount(for: topic),
                            plan: workspaceStore.monitoringPlan(for: topic),
                            languageCode: languageCode
                        )
                    }
                    .buttonStyle(.plain)
                }
            }

            Section(AppLanguage.localized("watchlists_section_manage", languageCode: languageCode)) {
                ForEach(WatchTopic.allCases) { topic in
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(AppLanguage.localized(topic.localizationKey, languageCode: languageCode))
                                .font(.headline)
                            Text(AppLanguage.localized(topic.subtitleKey, languageCode: languageCode))
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }

                        Spacer()

                        Button {
                            workspaceStore.toggleWatched(topic)
                        } label: {
                            Image(systemName: workspaceStore.isWatched(topic) ? "checkmark.circle.fill" : "plus.circle")
                                .font(.title3)
                                .foregroundStyle(workspaceStore.isWatched(topic) ? Color.accentColor : Color.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(AppLanguage.localized("watchlists_nav_title", languageCode: languageCode))
    }

    private func comparisonRows(for topic: WatchTopic) -> [ComparisonRow] {
        SignalEngine.comparisonRows(
            topic: topic,
            countries: countries,
            articlesByCountry: articlesByCountry,
            languageCode: languageCode
        )
    }

    private func activityCount(for topic: WatchTopic) -> Int {
        countries.reduce(into: 0) { partialResult, country in
            let articles = articlesByCountry[country.id] ?? []
            partialResult += SignalEngine.relevantArticles(for: topic, in: articles).count
        }
    }

    private func openTaskCount(for topic: WatchTopic) -> Int {
        workspaceStore.tasks(for: topic).filter { !$0.isCompleted }.count
    }
}

private struct CompareView: View {
    let countries: [Country]
    let articlesByCountry: [String: [Article]]
    let languageCode: String

    @EnvironmentObject private var workspaceStore: WorkspaceStore
    @State private var selectedTopic: WatchTopic = .economy
    @State private var analystConclusionDraft = ""
    @State private var savedMessage: String?

    private var rows: [ComparisonRow] {
        SignalEngine.comparisonRows(
            topic: selectedTopic,
            countries: countries,
            articlesByCountry: articlesByCountry,
            languageCode: languageCode
        )
    }

    private var insights: [String] {
        SignalEngine.insightBullets(
            topic: selectedTopic,
            countries: countries,
            articlesByCountry: articlesByCountry,
            languageCode: languageCode
        )
    }

    private var topicEvidence: [Article] {
        countries
            .flatMap { country in
                SignalEngine.relevantArticles(for: selectedTopic, in: articlesByCountry[country.id] ?? [])
            }
            .sorted(by: { $0.publishedAt > $1.publishedAt })
    }

    private var generatedSummary: String {
        let leadCountry = rows.first?.countryName ?? AppLanguage.localized("compare_lead_fallback_country", languageCode: languageCode)
        return AppLanguage.localizedFormat(
            "compare_regional_summary",
            languageCode: languageCode,
            AppLanguage.localized(selectedTopic.localizationKey, languageCode: languageCode),
            leadCountry,
            rows.count,
            topicEvidence.count
        )
    }

    private var recommendedPosture: String {
        guard let leadRow = rows.first else {
            return AppLanguage.localized("compare_posture_empty", languageCode: languageCode)
        }

        return SignalEngine.recommendedAction(
            topic: selectedTopic,
            intensity: leadRow.intensity,
            momentum: leadRow.momentum,
            languageCode: languageCode
        )
    }

    var body: some View {
        List {
            Section {
                Picker(
                    AppLanguage.localized("compare_picker_label", languageCode: languageCode),
                    selection: $selectedTopic
                ) {
                    ForEach(WatchTopic.allCases) { topic in
                        Text(AppLanguage.localized(topic.localizationKey, languageCode: languageCode))
                            .tag(topic)
                    }
                }
                .pickerStyle(.menu)
            }

            Section(AppLanguage.localized("compare_section_brief", languageCode: languageCode)) {
                VStack(alignment: .leading, spacing: 12) {
                    Text(AppLanguage.localized("compare_brief_title", languageCode: languageCode))
                        .font(.headline)
                    Text(generatedSummary)
                        .font(.body)
                        .foregroundStyle(.secondary)

                    VStack(alignment: .leading, spacing: 6) {
                        Text(AppLanguage.localized("compare_posture_title", languageCode: languageCode))
                            .font(.subheadline.weight(.semibold))
                        Text(recommendedPosture)
                            .font(.subheadline)
                            .foregroundStyle(.primary)

                        Text(AppLanguage.localized("compare_operating_question_title", languageCode: languageCode))
                            .font(.subheadline.weight(.semibold))
                            .padding(.top, 4)
                        Text(SignalEngine.operatingQuestion(topic: selectedTopic, languageCode: languageCode))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }

                    HStack(spacing: 10) {
                        WorkspaceMiniStat(
                            title: AppLanguage.localized("compare_stat_countries", languageCode: languageCode),
                            value: "\(rows.count)"
                        )
                        WorkspaceMiniStat(
                            title: AppLanguage.localized("compare_stat_evidence", languageCode: languageCode),
                            value: "\(topicEvidence.count)"
                        )
                    }
                }
                .padding(.vertical, 6)
            }

            Section(AppLanguage.localized("compare_section_insights", languageCode: languageCode)) {
                ForEach(insights, id: \.self) { insight in
                    Text(insight)
                        .font(.body)
                }
            }

            Section(AppLanguage.localized("compare_section_rows", languageCode: languageCode)) {
                if rows.isEmpty {
                    EmptyWorkspaceCard(
                        title: AppLanguage.localized("compare_empty_title", languageCode: languageCode),
                        message: AppLanguage.localized("compare_empty_message", languageCode: languageCode)
                    )
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                } else {
                    ForEach(rows) { row in
                        ComparisonRowCard(row: row)
                    }
                }
            }

            Section(AppLanguage.localized("compare_section_workspace", languageCode: languageCode)) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(AppLanguage.localized("compare_workspace_prompt", languageCode: languageCode))
                        .font(.subheadline.weight(.semibold))

                    TextEditor(text: $analystConclusionDraft)
                        .frame(minHeight: 140)
                        .padding(8)
                        .background(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .fill(Color(.secondarySystemBackground))
                        )

                    Button {
                        saveComparisonDossier()
                    } label: {
                        Label(
                            AppLanguage.localized("compare_save_dossier", languageCode: languageCode),
                            systemImage: "folder.badge.plus"
                        )
                    }
                    .buttonStyle(.borderedProminent)

                    if let savedMessage {
                        Text(savedMessage)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(AppLanguage.localized("compare_nav_title", languageCode: languageCode))
        .onChange(of: selectedTopic) { _, _ in
            savedMessage = nil
            if analystConclusionDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                analystConclusionDraft = generatedSummary
            }
        }
        .onAppear {
            if analystConclusionDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                analystConclusionDraft = generatedSummary
            }
        }
    }

    private func saveComparisonDossier() {
        let title = AppLanguage.localizedFormat(
            "compare_dossier_title",
            languageCode: languageCode,
            AppLanguage.localized(selectedTopic.localizationKey, languageCode: languageCode)
        )
        let trimmedConclusion = analystConclusionDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        let evidenceCount = topicEvidence.count
        let seededAssessment: DossierAssessment = evidenceCount >= 6 ? .confirmed : (evidenceCount >= 3 ? .developing : .exploratory)
        let seededRecommendation = AppLanguage.localized("dossier_auto_recommendation", languageCode: languageCode)
        var dossier = workspaceStore.createDossier(
            title: title,
            note: generatedSummary,
            conclusion: trimmedConclusion.isEmpty ? generatedSummary : trimmedConclusion,
            recommendation: seededRecommendation,
            assessment: seededAssessment,
            nextReviewAt: Calendar.current.date(byAdding: .day, value: 2, to: .now),
            topic: selectedTopic,
            countryCode: nil
        )
        for article in topicEvidence.prefix(6) {
            dossier = workspaceStore.addArticle(article, to: dossier)
        }
        workspaceStore.updateDossier(dossier)
        savedMessage = AppLanguage.localizedFormat(
            "compare_saved_message",
            languageCode: languageCode,
            dossier.title
        )
    }
}

struct TopicWorkspaceView: View {
    let topic: WatchTopic
    let countries: [Country]
    let articlesByCountry: [String: [Article]]
    let languageCode: String
    var focusCountryCode: String? = nil

    @EnvironmentObject private var library: ReadingLibrary
    @EnvironmentObject private var workspaceStore: WorkspaceStore
    @State private var dossierCreatedMessage: String?
    @State private var monitoringStatus: MonitoringStatus = .observing
    @State private var monitoringPriority: MonitoringPriority = .active
    @State private var monitoringConfidence: MonitoringConfidence = .medium
    @State private var workingThesis: String = ""
    @State private var decisionSummary: String = ""
    @State private var analystNote: String = ""
    @State private var nextReviewEnabled = false
    @State private var nextReviewAt = Calendar.current.date(byAdding: .day, value: 1, to: .now) ?? .now
    @State private var showingTaskComposer = false
    @State private var taskTitleDraft = ""
    @State private var taskDetailDraft = ""
    @State private var taskDueDate = Calendar.current.date(byAdding: .day, value: 1, to: .now) ?? .now

    private var comparisonRows: [ComparisonRow] {
        SignalEngine.comparisonRows(
            topic: topic,
            countries: filteredCountries,
            articlesByCountry: articlesByCountry,
            languageCode: languageCode
        )
    }

    private var evidence: [Article] {
        filteredCountries
            .flatMap { country in
                SignalEngine.relevantArticles(for: topic, in: articlesByCountry[country.id] ?? [])
            }
            .sorted(by: { $0.publishedAt > $1.publishedAt })
    }

    private var filteredCountries: [Country] {
        guard let focusCountryCode else { return countries }
        return countries.filter { $0.id == focusCountryCode }
    }

    private var currentPlan: TopicMonitoringPlan {
        workspaceStore.monitoringPlan(for: topic)
    }

    private var tasks: [AnalystTask] {
        workspaceStore.tasks(for: topic)
    }

    private var leadComparison: ComparisonRow? {
        comparisonRows.first
    }

    private var recommendedAction: String {
        guard let leadComparison else {
            return SignalEngine.recommendedAction(
                topic: topic,
                intensity: .watch,
                momentum: .steady,
                languageCode: languageCode
            )
        }

        return SignalEngine.recommendedAction(
            topic: topic,
            intensity: leadComparison.intensity,
            momentum: leadComparison.momentum,
            languageCode: languageCode
        )
    }

    private var operatingQuestion: String {
        SignalEngine.operatingQuestion(topic: topic, languageCode: languageCode)
    }

    @ViewBuilder
    private var signalInsightsSection: some View {
        Section(AppLanguage.localized("topic_workspace_section_signal", languageCode: languageCode)) {
            VStack(alignment: .leading, spacing: 14) {
                if let leadComparison {
                    TopicWorkspaceInsightCard(
                        title: AppLanguage.localized("topic_workspace_current_picture_title", languageCode: languageCode),
                        message: leadComparison.summary
                    )
                }

                TopicWorkspaceInsightCard(
                    title: AppLanguage.localized("topic_workspace_recommended_action_title", languageCode: languageCode),
                    message: recommendedAction
                )

                TopicWorkspaceInsightCard(
                    title: AppLanguage.localized("topic_workspace_operating_question_title", languageCode: languageCode),
                    message: operatingQuestion
                )
            }
            .padding(.vertical, 4)
        }
    }

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 10) {
                    Text(AppLanguage.localized(topic.localizationKey, languageCode: languageCode))
                        .font(.title2.weight(.bold))
                    Text(AppLanguage.localized(topic.subtitleKey, languageCode: languageCode))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    if let dossierCreatedMessage {
                        Text(dossierCreatedMessage)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }

                    if let leadRow = comparisonRows.first {
                        HStack(spacing: 12) {
                            SignalBadge(
                                title: AppLanguage.localized("signal_badge_intensity", languageCode: languageCode),
                                value: AppLanguage.localized(leadRow.intensity.localizationKey, languageCode: languageCode)
                            )
                            SignalBadge(
                                title: AppLanguage.localized("signal_badge_momentum", languageCode: languageCode),
                                value: AppLanguage.localized(leadRow.momentum.localizationKey, languageCode: languageCode)
                            )
                        }
                    }

                    Button {
                        createDossierFromTopic()
                    } label: {
                        Label(
                            AppLanguage.localized("topic_workspace_create_dossier", languageCode: languageCode),
                            systemImage: "folder.badge.plus"
                        )
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                }
                .padding(.vertical, 6)
            }

            signalInsightsSection

            Section(AppLanguage.localized("topic_workspace_section_plan", languageCode: languageCode)) {
                VStack(alignment: .leading, spacing: 16) {
                    monitoringStatusPicker
                    monitoringPriorityPicker
                    monitoringConfidencePicker

                    VStack(alignment: .leading, spacing: 8) {
                        Text(AppLanguage.localized("topic_workspace_working_thesis", languageCode: languageCode))
                            .font(.subheadline.weight(.semibold))

                        ZStack(alignment: .topLeading) {
                            if workingThesis.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                                Text(AppLanguage.localized("topic_workspace_working_thesis_placeholder", languageCode: languageCode))
                                    .font(.body)
                                    .foregroundStyle(.tertiary)
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 16)
                            }

                            TextEditor(text: $workingThesis)
                                .frame(minHeight: 120)
                                .padding(8)
                                .background(Color.clear)
                        }
                        .background(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .fill(Color(.secondarySystemBackground))
                        )
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text(AppLanguage.localized("topic_workspace_decision_summary", languageCode: languageCode))
                            .font(.subheadline.weight(.semibold))

                        ZStack(alignment: .topLeading) {
                            if decisionSummary.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                                Text(AppLanguage.localized("topic_workspace_decision_summary_placeholder", languageCode: languageCode))
                                    .font(.body)
                                    .foregroundStyle(.tertiary)
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 16)
                            }

                            TextEditor(text: $decisionSummary)
                                .frame(minHeight: 100)
                                .padding(8)
                                .background(Color.clear)
                        }
                        .background(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .fill(Color(.secondarySystemBackground))
                        )
                    }

                    Toggle(
                        AppLanguage.localized("topic_workspace_next_review_toggle", languageCode: languageCode),
                        isOn: $nextReviewEnabled
                    )

                    if nextReviewEnabled {
                        DatePicker(
                            AppLanguage.localized("topic_workspace_next_review_date", languageCode: languageCode),
                            selection: $nextReviewAt,
                            displayedComponents: [.date]
                        )
                        .datePickerStyle(.compact)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text(AppLanguage.localized("topic_workspace_analyst_note", languageCode: languageCode))
                            .font(.subheadline.weight(.semibold))
                        TextEditor(text: $analystNote)
                            .frame(minHeight: 120)
                            .padding(8)
                            .background(
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .fill(Color(.secondarySystemBackground))
                            )
                    }
                }
                .padding(.vertical, 4)
            }

            Section(AppLanguage.localized("topic_workspace_section_compare", languageCode: languageCode)) {
                ForEach(comparisonRows) { row in
                    ComparisonRowCard(row: row)
                }
            }

            Section(AppLanguage.localized("topic_workspace_section_tasks", languageCode: languageCode)) {
                Button {
                    showingTaskComposer = true
                } label: {
                    Label(
                        AppLanguage.localized("topic_workspace_add_task", languageCode: languageCode),
                        systemImage: "checklist"
                    )
                }

                if tasks.isEmpty {
                    EmptyWorkspaceCard(
                        title: AppLanguage.localized("topic_workspace_tasks_empty_title", languageCode: languageCode),
                        message: AppLanguage.localized("topic_workspace_tasks_empty_message", languageCode: languageCode)
                    )
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                } else {
                    ForEach(tasks) { task in
                        AnalystTaskRow(
                            task: task,
                            languageCode: languageCode,
                            onToggle: { workspaceStore.toggleTaskCompletion(task) }
                        )
                    }
                }
            }

            Section(AppLanguage.localized("topic_workspace_section_evidence", languageCode: languageCode)) {
                Text(AppLanguage.localized("topic_workspace_evidence_explainer", languageCode: languageCode))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                if evidence.isEmpty {
                    EmptyWorkspaceCard(
                        title: AppLanguage.localized("topic_workspace_empty_title", languageCode: languageCode),
                        message: AppLanguage.localized("topic_workspace_empty_message", languageCode: languageCode)
                    )
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                } else {
                    DisclosureGroup(
                        AppLanguage.localizedFormat(
                            "topic_workspace_evidence_count",
                            languageCode: languageCode,
                            evidence.count
                        )
                    ) {
                        ForEach(evidence) { article in
                            NavigationLink {
                                ArticleDetailView(
                                    article: article,
                                    countryName: focusedCountryName(for: article)
                                )
                            } label: {
                                ArticleRowView(
                                    article: article,
                                    isSaved: library.isSaved(article),
                                    onToggleSave: { library.toggleSaved(article) }
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(AppLanguage.localized(topic.localizationKey, languageCode: languageCode))
        .onAppear(perform: loadPlanState)
        .onChange(of: monitoringStatus) { _, _ in savePlanState() }
        .onChange(of: monitoringPriority) { _, _ in savePlanState() }
        .onChange(of: monitoringConfidence) { _, _ in savePlanState() }
        .onChange(of: workingThesis) { _, _ in savePlanState() }
        .onChange(of: decisionSummary) { _, _ in savePlanState() }
        .onChange(of: analystNote) { _, _ in savePlanState() }
        .onChange(of: nextReviewEnabled) { _, _ in savePlanState() }
        .onChange(of: nextReviewAt) { _, _ in
            if nextReviewEnabled {
                savePlanState()
            }
        }
        .sheet(isPresented: $showingTaskComposer) {
            NavigationStack {
                Form {
                    Section(AppLanguage.localized("task_composer_section", languageCode: languageCode)) {
                        TextField(
                            AppLanguage.localized("task_composer_title_placeholder", languageCode: languageCode),
                            text: $taskTitleDraft
                        )

                        TextField(
                            AppLanguage.localized("task_composer_detail_placeholder", languageCode: languageCode),
                            text: $taskDetailDraft,
                            axis: .vertical
                        )
                        .lineLimit(3...6)

                        DatePicker(
                            AppLanguage.localized("task_composer_due_date", languageCode: languageCode),
                            selection: $taskDueDate,
                            displayedComponents: [.date]
                        )
                    }
                }
                .navigationTitle(AppLanguage.localized("task_composer_nav_title", languageCode: languageCode))
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button(AppLanguage.localized("dossiers_create_cancel", languageCode: languageCode)) {
                            showingTaskComposer = false
                            resetTaskComposer()
                        }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button(AppLanguage.localized("task_composer_save", languageCode: languageCode)) {
                            let trimmedTitle = taskTitleDraft.trimmingCharacters(in: .whitespacesAndNewlines)
                            workspaceStore.addCustomTask(
                                title: trimmedTitle,
                                detail: taskDetailDraft.trimmingCharacters(in: .whitespacesAndNewlines),
                                topic: topic,
                                dueDate: taskDueDate
                            )
                            showingTaskComposer = false
                            resetTaskComposer()
                        }
                        .disabled(taskTitleDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
            }
        }
    }

    private func createDossierFromTopic() {
        let title = AppLanguage.localizedFormat(
            "dossier_title_from_topic",
            languageCode: languageCode,
            AppLanguage.localized(topic.localizationKey, languageCode: languageCode)
        )
        let note = AppLanguage.localized(topic.subtitleKey, languageCode: languageCode)
        let seededAssessment: DossierAssessment = evidence.count >= 5 ? .developing : .exploratory
        let seededRecommendation = AppLanguage.localized("dossier_auto_recommendation", languageCode: languageCode)
        var dossier = workspaceStore.createDossier(
            title: title,
            note: note,
            recommendation: seededRecommendation,
            assessment: seededAssessment,
            nextReviewAt: Calendar.current.date(byAdding: .day, value: 2, to: .now),
            topic: topic,
            countryCode: focusCountryCode
        )
        for article in evidence.prefix(5) {
            dossier = workspaceStore.addArticle(article, to: dossier)
        }
        dossierCreatedMessage = AppLanguage.localizedFormat(
            "dossier_created_message",
            languageCode: languageCode,
            dossier.title
        )
    }

    private func focusedCountryName(for article: Article) -> String {
        if let focusCountryCode,
           let country = countries.first(where: { $0.id == focusCountryCode }) {
            return country.localizedName(languageCode: languageCode)
        }

        return countries.first(where: { article.title.localizedCaseInsensitiveContains($0.localizedName(languageCode: languageCode)) })?.localizedName(languageCode: languageCode)
        ?? AppLanguage.localized("dashboard_nav_title", languageCode: languageCode)
    }

    private var monitoringStatusPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(AppLanguage.localized("topic_workspace_status_label", languageCode: languageCode))
                .font(.subheadline.weight(.semibold))

            HStack(spacing: 10) {
                ForEach(MonitoringStatus.allCases) { status in
                    Button {
                        monitoringStatus = status
                    } label: {
                        Text(AppLanguage.localized(status.localizationKey, languageCode: languageCode))
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(monitoringStatus == status ? Color.white : Color.primary)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .frame(maxWidth: .infinity)
                            .background(
                                Capsule(style: .continuous)
                                    .fill(monitoringStatus == status ? Color.accentColor : Color(.secondarySystemBackground))
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var monitoringPriorityPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(AppLanguage.localized("topic_workspace_priority_label", languageCode: languageCode))
                .font(.subheadline.weight(.semibold))

            Picker(
                AppLanguage.localized("topic_workspace_priority_label", languageCode: languageCode),
                selection: $monitoringPriority
            ) {
                ForEach(MonitoringPriority.allCases) { priority in
                    Text(AppLanguage.localized(priority.localizationKey, languageCode: languageCode))
                        .tag(priority)
                }
            }
            .pickerStyle(.segmented)
        }
    }

    private var monitoringConfidencePicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(AppLanguage.localized("topic_workspace_confidence_label", languageCode: languageCode))
                .font(.subheadline.weight(.semibold))

            Picker(
                AppLanguage.localized("topic_workspace_confidence_label", languageCode: languageCode),
                selection: $monitoringConfidence
            ) {
                ForEach(MonitoringConfidence.allCases) { confidence in
                    Text(AppLanguage.localized(confidence.localizationKey, languageCode: languageCode))
                        .tag(confidence)
                }
            }
            .pickerStyle(.segmented)
        }
    }

    private func loadPlanState() {
        let plan = currentPlan
        workspaceStore.seedDefaultTasksIfNeeded(for: topic)
        monitoringStatus = plan.status
        monitoringPriority = plan.priority
        monitoringConfidence = plan.confidence
        workingThesis = plan.workingThesis
        decisionSummary = plan.decisionSummary
        analystNote = plan.analystNote
        nextReviewEnabled = plan.nextReviewAt != nil
        nextReviewAt = plan.nextReviewAt ?? (Calendar.current.date(byAdding: .day, value: 1, to: .now) ?? .now)
    }

    private func savePlanState() {
        var plan = currentPlan
        plan.status = monitoringStatus
        plan.priority = monitoringPriority
        plan.confidence = monitoringConfidence
        plan.workingThesis = workingThesis.trimmingCharacters(in: .whitespacesAndNewlines)
        plan.decisionSummary = decisionSummary.trimmingCharacters(in: .whitespacesAndNewlines)
        plan.analystNote = analystNote.trimmingCharacters(in: .whitespacesAndNewlines)
        plan.nextReviewAt = nextReviewEnabled ? nextReviewAt : nil
        plan.lastUpdatedAt = .now
        workspaceStore.updateMonitoringPlan(plan)
    }

    private func resetTaskComposer() {
        taskTitleDraft = ""
        taskDetailDraft = ""
        taskDueDate = Calendar.current.date(byAdding: .day, value: 1, to: .now) ?? .now
    }
}

private struct WorkspaceSectionHeader: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.title3)
                .fontWeight(.semibold)
            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
}

struct EmptyWorkspaceCard: View {
    let title: String
    let message: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Color(.secondarySystemBackground))
        )
    }
}

private struct SignalCardView: View {
    let signal: SignalCard
    @AppStorage("preferredLanguage") private var preferredLanguage: String = Locale.current.language.languageCode?.identifier ?? "es"

    private var relativeDate: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: signal.updatedAt, relativeTo: Date())
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label(signal.countryName, systemImage: signal.topic.icon)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                Text(relativeDate)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }

            Text(signal.summary)
                .font(.headline)
                .foregroundStyle(.primary)

            Text(signal.changeSummary)
                .font(.subheadline)
                .foregroundStyle(.secondary)

            HStack(spacing: 10) {
                SignalBadge(
                    title: AppLanguage.localized("signal_badge_intensity", languageCode: preferredLanguage),
                    value: AppLanguage.localized(signal.intensity.localizationKey, languageCode: preferredLanguage)
                )
                SignalBadge(
                    title: AppLanguage.localized("signal_badge_momentum", languageCode: preferredLanguage),
                    value: AppLanguage.localized(signal.momentum.localizationKey, languageCode: preferredLanguage)
                )
            }

            Text(
                AppLanguage.localized(
                    "signal_action_label",
                    languageCode: preferredLanguage
                )
            )
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            Text(
                SignalEngine.recommendedAction(
                    topic: signal.topic,
                    intensity: signal.intensity,
                    momentum: signal.momentum,
                    languageCode: preferredLanguage
                )
            )
                .font(.subheadline)
                .foregroundStyle(.primary)

            Text(
                AppLanguage.localized(
                    "signal_question_label",
                    languageCode: preferredLanguage
                )
            )
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            Text(
                SignalEngine.operatingQuestion(
                    topic: signal.topic,
                    languageCode: preferredLanguage
                )
            )
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(Color(.secondarySystemBackground))
        )
    }
}

private struct TopicWorkspaceInsightCard: View {
    let title: String
    let message: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline.weight(.semibold))
            Text(message)
                .font(.body)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(.secondarySystemBackground))
        )
    }
}

private struct TopicChipCard: View {
    let topic: WatchTopic
    let languageCode: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(AppLanguage.localized(topic.localizationKey, languageCode: languageCode), systemImage: topic.icon)
                .font(.headline)
            Text(AppLanguage.localized(topic.subtitleKey, languageCode: languageCode))
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .padding()
        .frame(width: 180, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(.secondarySystemBackground))
        )
    }
}

private struct WorkspaceToolCard: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: systemImage)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Color.accentColor)
                    .frame(width: 36, height: 36)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(Color.accentColor.opacity(0.12))
                    )

                VStack(alignment: .leading, spacing: 6) {
                    Text(title)
                        .font(.headline)
                        .foregroundStyle(.primary)

                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.leading)
                }

                Spacer(minLength: 8)

                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
                    .padding(.top, 4)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(Color(.secondarySystemBackground))
            )
        }
        .buttonStyle(.plain)
    }
}

private struct WorkspaceMiniStat: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value)
                .font(.headline.weight(.bold))
                .foregroundStyle(.primary)

            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.secondarySystemBackground))
        )
    }
}

private struct WatchlistWorkspaceCard: View {
    let topic: WatchTopic
    let rows: [ComparisonRow]
    let activityCount: Int
    let openTaskCount: Int
    let plan: TopicMonitoringPlan
    let languageCode: String

    private var nextReviewText: String {
        guard let nextReviewAt = plan.nextReviewAt else {
            return AppLanguage.localized("watchlists_card_no_review", languageCode: languageCode)
        }

        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        formatter.locale = Locale(identifier: AppLanguage.supportedLanguageCode(from: languageCode))
        return formatter.string(from: nextReviewAt)
    }

    private var leadCountries: String {
        let names = rows.prefix(3).map(\.countryName)
        if names.isEmpty {
            return AppLanguage.localized("watchlists_card_no_activity", languageCode: languageCode)
        }
        return names.joined(separator: " • ")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: topic.icon)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Color.accentColor)
                    .frame(width: 40, height: 40)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(Color.accentColor.opacity(0.12))
                    )

                VStack(alignment: .leading, spacing: 4) {
                    Text(AppLanguage.localized(topic.localizationKey, languageCode: languageCode))
                        .font(.headline)
                        .foregroundStyle(.primary)

                    Text(AppLanguage.localized(topic.subtitleKey, languageCode: languageCode))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }

                Spacer(minLength: 8)

                VStack(alignment: .trailing, spacing: 4) {
                    Text(AppLanguage.localized(plan.status.localizationKey, languageCode: languageCode))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)

                    Text(AppLanguage.localized(plan.priority.localizationKey, languageCode: languageCode))
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            Capsule(style: .continuous)
                                .fill(Color(.tertiarySystemBackground))
                        )
                }
            }

            HStack(spacing: 10) {
                WorkspaceMiniStat(
                    title: AppLanguage.localized("watchlists_card_activity", languageCode: languageCode),
                    value: "\(activityCount)"
                )
                WorkspaceMiniStat(
                    title: AppLanguage.localized("watchlists_card_tasks", languageCode: languageCode),
                    value: "\(openTaskCount)"
                )
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(AppLanguage.localized("watchlists_card_priority", languageCode: languageCode))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)

                Text(leadCountries)
                    .font(.subheadline)
                    .foregroundStyle(.primary)
                    .lineLimit(2)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(AppLanguage.localized("watchlists_card_confidence", languageCode: languageCode))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)

                Text(AppLanguage.localized(plan.confidence.localizationKey, languageCode: languageCode))
                    .font(.subheadline)
                    .foregroundStyle(.primary)

                if !plan.workingThesis.isEmpty {
                    Text(AppLanguage.localized("watchlists_card_thesis", languageCode: languageCode))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)

                    Text(plan.workingThesis)
                        .font(.subheadline)
                        .foregroundStyle(.primary)
                        .lineLimit(3)
                } else if !plan.decisionSummary.isEmpty {
                    Text(plan.decisionSummary)
                        .font(.subheadline)
                        .foregroundStyle(.primary)
                        .lineLimit(3)
                }
            }

            HStack {
                Text(
                    AppLanguage.localizedFormat(
                        "watchlists_card_next_review",
                        languageCode: languageCode,
                        nextReviewText
                    )
                )
                .font(.caption)
                .foregroundStyle(.secondary)

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(Color(.secondarySystemBackground))
        )
    }
}

private struct WatchTopicRow: View {
    let topic: WatchTopic
    let activityCount: Int
    let languageCode: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: topic.icon)
                .foregroundStyle(Color.accentColor)
            VStack(alignment: .leading, spacing: 4) {
                Text(AppLanguage.localized(topic.localizationKey, languageCode: languageCode))
                    .font(.headline)
                Text(
                    AppLanguage.localizedFormat(
                        "watchlists_activity_count",
                        languageCode: languageCode,
                        activityCount
                    )
                )
                .font(.subheadline)
                .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

private struct ComparisonRowCard: View {
    let row: ComparisonRow
    @AppStorage("preferredLanguage") private var preferredLanguage: String = Locale.current.language.languageCode?.identifier ?? "es"

    private var relativeDate: String? {
        guard let updatedAt = row.updatedAt else { return nil }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: updatedAt, relativeTo: Date())
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(row.countryName)
                    .font(.headline)
                Spacer()
                if let relativeDate {
                    Text(relativeDate)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Text(row.summary)
                .font(.subheadline)
                .foregroundStyle(.primary)

            HStack(spacing: 10) {
                SignalBadge(
                    title: AppLanguage.localized("signal_badge_intensity", languageCode: preferredLanguage),
                    value: AppLanguage.localized(row.intensity.localizationKey, languageCode: preferredLanguage)
                )
                SignalBadge(
                    title: AppLanguage.localized("signal_badge_momentum", languageCode: preferredLanguage),
                    value: AppLanguage.localized(row.momentum.localizationKey, languageCode: preferredLanguage)
                )
            }

            Text(
                AppLanguage.localizedFormat(
                    "signal_supporting_count",
                    languageCode: preferredLanguage,
                    row.evidenceCount
                )
            )
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 6)
    }
}

private struct DashboardMetricCard: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(value)
                .font(.title2.weight(.bold))
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(.secondarySystemBackground))
        )
    }
}

private struct SignalBadge: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.primary)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(
            Capsule(style: .continuous)
                .fill(Color(.tertiarySystemBackground))
        )
    }
}

private struct SnapshotRowCard: View {
    let snapshot: DailySnapshot
    let languageCode: String

    private var relativeDate: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: snapshot.createdAt, relativeTo: Date())
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(snapshot.headline)
                    .font(.headline)
                    .foregroundStyle(.primary)
                Spacer()
                Text(relativeDate)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Text(snapshot.changeSummary)
                .font(.subheadline)
                .foregroundStyle(.secondary)

            ForEach(snapshot.topicSnapshots.prefix(2)) { item in
                HStack {
                    Text(item.title)
                        .font(.caption.weight(.semibold))
                    Spacer()
                    Text(AppLanguage.localized(item.momentum.localizationKey, languageCode: languageCode))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Color(.secondarySystemBackground))
        )
    }
}

private struct DossierRowCard: View {
    let dossier: Dossier
    let countries: [Country]
    let languageCode: String

    var body: some View {
        NavigationLink {
            DossierDetailView(
                dossierID: dossier.id,
                countries: countries,
                languageCode: languageCode
            )
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                Text(dossier.title)
                    .font(.headline)
                    .foregroundStyle(.primary)

                if !dossier.conclusion.isEmpty {
                    Text(dossier.conclusion)
                        .font(.subheadline)
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                } else if !dossier.note.isEmpty {
                    Text(dossier.note)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }

                Text(
                    AppLanguage.localizedFormat(
                        "dossiers_evidence_count",
                        languageCode: languageCode,
                        dossier.evidence.count
                    )
                )
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(Color(.secondarySystemBackground))
            )
        }
        .buttonStyle(.plain)
    }
}

private struct ActionQueueCard: View {
    let plan: TopicMonitoringPlan
    let languageCode: String

    private var nextReviewText: String {
        guard let nextReviewAt = plan.nextReviewAt else {
            return AppLanguage.localized("dashboard_action_queue_no_review", languageCode: languageCode)
        }

        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        formatter.locale = Locale(identifier: AppLanguage.supportedLanguageCode(from: languageCode))
        return formatter.string(from: nextReviewAt)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(plan.topic.map { AppLanguage.localized($0.localizationKey, languageCode: languageCode) } ?? plan.topicID)
                    .font(.headline)
                Spacer()
                Text(AppLanguage.localized(plan.priority.localizationKey, languageCode: languageCode))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }

            Text(AppLanguage.localized(plan.status.localizationKey, languageCode: languageCode))
                .font(.subheadline)
                .foregroundStyle(.primary)

            HStack(spacing: 8) {
                Text(AppLanguage.localized("dashboard_action_queue_confidence", languageCode: languageCode))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)

                Text(AppLanguage.localized(plan.confidence.localizationKey, languageCode: languageCode))
                    .font(.caption)
                    .foregroundStyle(.primary)
            }

            Text(
                AppLanguage.localizedFormat(
                    "dashboard_action_queue_next_review",
                    languageCode: languageCode,
                    nextReviewText
                )
            )
            .font(.caption)
            .foregroundStyle(.secondary)

            if !plan.decisionSummary.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text(AppLanguage.localized("dashboard_action_queue_decision", languageCode: languageCode))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)

                    Text(plan.decisionSummary)
                        .font(.subheadline)
                        .foregroundStyle(.primary)
                        .lineLimit(3)
                }
            } else if !plan.workingThesis.isEmpty {
                Text(plan.workingThesis)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
            } else if !plan.analystNote.isEmpty {
                Text(plan.analystNote)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Color(.secondarySystemBackground))
        )
    }
}

private struct AnalystTaskCard: View {
    let task: AnalystTask
    let languageCode: String

    private var dueText: String {
        guard let dueDate = task.dueDate else {
            return AppLanguage.localized("dashboard_task_no_due_date", languageCode: languageCode)
        }

        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        formatter.locale = Locale(identifier: AppLanguage.supportedLanguageCode(from: languageCode))
        return formatter.string(from: dueDate)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(task.topic.map { AppLanguage.localized($0.localizationKey, languageCode: languageCode) } ?? task.topicID)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                Text(
                    AppLanguage.localizedFormat(
                        "dashboard_task_due_date",
                        languageCode: languageCode,
                        dueText
                    )
                )
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            Text(task.localizedTitle(languageCode: languageCode))
                .font(.headline)

            let detail = task.localizedDetail(languageCode: languageCode)
            if !detail.isEmpty {
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Color(.secondarySystemBackground))
        )
    }
}

private struct AnalystTaskRow: View {
    let task: AnalystTask
    let languageCode: String
    let onToggle: () -> Void

    private var dueText: String? {
        guard let dueDate = task.dueDate else { return nil }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        formatter.locale = Locale(identifier: AppLanguage.supportedLanguageCode(from: languageCode))
        return formatter.string(from: dueDate)
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Button(action: onToggle) {
                Image(systemName: task.isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(task.isCompleted ? Color.green : Color.secondary)
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 6) {
                Text(task.localizedTitle(languageCode: languageCode))
                    .font(.headline)
                    .strikethrough(task.isCompleted, color: .secondary)

                let detail = task.localizedDetail(languageCode: languageCode)
                if !detail.isEmpty {
                    Text(detail)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                if let dueText {
                    Text(
                        AppLanguage.localizedFormat(
                            "dashboard_task_due_date",
                            languageCode: languageCode,
                            dueText
                        )
                    )
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }
}
