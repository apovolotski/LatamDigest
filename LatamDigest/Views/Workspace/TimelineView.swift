import SwiftUI

struct TimelineView: View {
    let snapshots: [DailySnapshot]
    let languageCode: String

    private var changeHighlights: [String] {
        guard snapshots.count >= 2 else { return [] }

        let current = snapshots[0]
        let previous = snapshots[1]
        let previousByTopic = Dictionary(uniqueKeysWithValues: previous.topicSnapshots.map { ($0.topicID, $0) })

        var highlights: [String] = []

        for item in current.topicSnapshots {
            let topicTitle = item.title
            if let previousItem = previousByTopic[item.topicID] {
                if item.intensity.rank > previousItem.intensity.rank {
                    highlights.append(
                        AppLanguage.localizedFormat(
                            "timeline_change_escalated",
                            languageCode: languageCode,
                            topicTitle
                        )
                    )
                } else if item.momentum != previousItem.momentum && item.momentum == .new {
                    highlights.append(
                        AppLanguage.localizedFormat(
                            "timeline_change_new",
                            languageCode: languageCode,
                            topicTitle
                        )
                    )
                }
            } else {
                highlights.append(
                    AppLanguage.localizedFormat(
                        "timeline_change_new",
                        languageCode: languageCode,
                        topicTitle
                    )
                )
            }
        }

        return Array(highlights.prefix(3))
    }

    var body: some View {
        List {
            Section {
                Text(AppLanguage.localized("timeline_intro", languageCode: languageCode))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .listRowBackground(Color.clear)
            }

            if !changeHighlights.isEmpty {
                Section(AppLanguage.localized("timeline_section_changes", languageCode: languageCode)) {
                    ForEach(changeHighlights, id: \.self) { highlight in
                        Text(highlight)
                            .font(.body)
                    }
                }
            }

            Section(AppLanguage.localized("timeline_section_history", languageCode: languageCode)) {
                if snapshots.isEmpty {
                    EmptyWorkspaceCard(
                        title: AppLanguage.localized("timeline_empty_title", languageCode: languageCode),
                        message: AppLanguage.localized("timeline_empty_message", languageCode: languageCode)
                    )
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                } else {
                    ForEach(snapshots) { snapshot in
                        NavigationLink {
                            SnapshotDetailView(snapshot: snapshot, languageCode: languageCode)
                        } label: {
                            SnapshotTimelineRow(snapshot: snapshot, languageCode: languageCode)
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(AppLanguage.localized("timeline_nav_title", languageCode: languageCode))
    }
}

private struct SnapshotDetailView: View {
    let snapshot: DailySnapshot
    let languageCode: String

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text(snapshot.headline)
                        .font(.title3.weight(.bold))
                    Text(snapshot.changeSummary)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 6)
            }

            Section(AppLanguage.localized("timeline_section_topics", languageCode: languageCode)) {
                ForEach(snapshot.topicSnapshots) { item in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(item.title)
                                .font(.headline)
                            Spacer()
                            Text(AppLanguage.localized(item.intensity.localizationKey, languageCode: languageCode))
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                        }

                        Text(item.summary)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)

                        if !item.leadingCountryNames.isEmpty {
                            Text(item.leadingCountryNames.joined(separator: ", "))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(AppLanguage.localized("timeline_detail_nav_title", languageCode: languageCode))
    }
}

private struct SnapshotTimelineRow: View {
    let snapshot: DailySnapshot
    let languageCode: String

    private var formattedDate: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        formatter.locale = Locale(identifier: AppLanguage.supportedLanguageCode(from: languageCode))
        return formatter.string(from: snapshot.createdAt)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(formattedDate)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                Text("\(snapshot.topicSnapshots.count)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Text(snapshot.headline)
                .font(.headline)

            Text(snapshot.changeSummary)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 6)
    }
}
