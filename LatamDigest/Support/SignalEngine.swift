import Foundation

enum SignalEngine {
    static func relevantArticles(for topic: WatchTopic, in articles: [Article]) -> [Article] {
        articles.filter { article in
            let searchable = "\(article.title) \(article.snippet)".lowercased()
            return topic.keywords.contains { searchable.contains($0) }
        }
    }

    static func dashboardSignals(
        countries: [Country],
        articlesByCountry: [String: [Article]],
        watchedTopics: [WatchTopic],
        languageCode: String
    ) -> [SignalCard] {
        let topics = watchedTopics.isEmpty ? WatchTopic.defaultTopics : watchedTopics

        let signals = countries.flatMap { country in
            topics.compactMap { topic in
                analyzeSignal(
                    topic: topic,
                    country: country,
                    articles: articlesByCountry[country.id] ?? [],
                    languageCode: languageCode
                )
            }
        }

        return signals.sorted { lhs, rhs in
            if lhs.score == rhs.score {
                return lhs.updatedAt > rhs.updatedAt
            }

            return lhs.score > rhs.score
        }
    }

    static func comparisonRows(
        topic: WatchTopic,
        countries: [Country],
        articlesByCountry: [String: [Article]],
        languageCode: String
    ) -> [ComparisonRow] {
        countries.compactMap { country in
            let relevant = relevantArticles(for: topic, in: articlesByCountry[country.id] ?? [])
                .sorted(by: { $0.publishedAt > $1.publishedAt })

            guard !relevant.isEmpty else { return nil }

            let score = signalScore(for: relevant)
            let intensity = intensity(for: score)
            let momentum = momentum(for: relevant)

            return ComparisonRow(
                id: "\(topic.rawValue)-\(country.id)",
                countryCode: country.id,
                countryName: country.localizedName(languageCode: languageCode),
                summary: AppLanguage.localizedFormat(
                    "compare_summary",
                    languageCode: languageCode,
                    country.localizedName(languageCode: languageCode),
                    relevant.count,
                    AppLanguage.localized(momentum.localizationKey, languageCode: languageCode)
                ),
                intensity: intensity,
                momentum: momentum,
                score: score,
                evidenceCount: relevant.count,
                latestHeadline: relevant.first?.title,
                updatedAt: relevant.first?.publishedAt
            )
        }
        .sorted { lhs, rhs in
            if lhs.score == rhs.score {
                return (lhs.updatedAt ?? .distantPast) > (rhs.updatedAt ?? .distantPast)
            }

            return lhs.score > rhs.score
        }
    }

    static func insightBullets(
        topic: WatchTopic,
        countries: [Country],
        articlesByCountry: [String: [Article]],
        languageCode: String
    ) -> [String] {
        let rows = comparisonRows(topic: topic, countries: countries, articlesByCountry: articlesByCountry, languageCode: languageCode)

        guard !rows.isEmpty else {
            return [
                AppLanguage.localizedFormat(
                    "watchlist_no_activity",
                    languageCode: languageCode,
                    AppLanguage.localized(topic.localizationKey, languageCode: languageCode)
                )
            ]
        }

        return rows.prefix(3).map { row in
            AppLanguage.localizedFormat(
                "watchlist_insight_row",
                languageCode: languageCode,
                row.countryName,
                row.evidenceCount,
                AppLanguage.localized(topic.localizationKey, languageCode: languageCode)
            )
        }
    }

    static func dailySnapshot(
        countries: [Country],
        watchedTopics: [WatchTopic],
        signals: [SignalCard],
        languageCode: String
    ) -> DailySnapshot? {
        guard !signals.isEmpty else { return nil }

        let grouped = Dictionary(grouping: signals, by: \.topic)
        let topicSnapshots: [TopicSnapshot] = grouped.compactMap { topic, topicSignals in
            let ranked = topicSignals.sorted { lhs, rhs in
                if lhs.score == rhs.score {
                    return lhs.updatedAt > rhs.updatedAt
                }
                return lhs.score > rhs.score
            }

            guard let lead = ranked.first else { return nil }
            let evidenceCount = ranked.reduce(0) { $0 + $1.evidence.count }

            return TopicSnapshot(
                id: "\(snapshotKey(for: .now))-\(topic.rawValue)",
                topicID: topic.rawValue,
                title: AppLanguage.localized(topic.localizationKey, languageCode: languageCode),
                summary: AppLanguage.localizedFormat(
                    "snapshot_topic_summary",
                    languageCode: languageCode,
                    AppLanguage.localized(topic.localizationKey, languageCode: languageCode),
                    ranked.count,
                    evidenceCount
                ),
                leadingCountryNames: ranked.prefix(3).map(\.countryName),
                intensity: lead.intensity,
                momentum: lead.momentum,
                evidenceCount: evidenceCount,
                updatedAt: lead.updatedAt
            )
        }
        .sorted { lhs, rhs in
            if lhs.intensity.rank == rhs.intensity.rank {
                return lhs.updatedAt > rhs.updatedAt
            }
            return lhs.intensity.rank > rhs.intensity.rank
        }

        guard let leadSnapshot = topicSnapshots.first else { return nil }
        let trackedTopicIDs = Set((watchedTopics.isEmpty ? WatchTopic.defaultTopics : watchedTopics).map(\.rawValue))
        let snapshotTopics = topicSnapshots.filter { trackedTopicIDs.contains($0.topicID) }
        let leadCountries = leadSnapshot.leadingCountryNames.prefix(2).joined(separator: ", ")

        return DailySnapshot(
            id: snapshotKey(for: .now),
            createdAt: .now,
            countryCodes: countries.map(\.id),
            headline: AppLanguage.localizedFormat(
                "snapshot_headline",
                languageCode: languageCode,
                leadSnapshot.title,
                leadCountries.isEmpty ? countries.first?.localizedName(languageCode: languageCode) ?? "" : leadCountries
            ),
            changeSummary: AppLanguage.localizedFormat(
                "snapshot_change_summary",
                languageCode: languageCode,
                topicSnapshots.count,
                countries.count
            ),
            topicSnapshots: Array((snapshotTopics.isEmpty ? topicSnapshots.prefix(3) : snapshotTopics.prefix(4)))
        )
    }

    static func snapshotKey(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    private static func analyzeSignal(
        topic: WatchTopic,
        country: Country,
        articles: [Article],
        languageCode: String
    ) -> SignalCard? {
        let relevant = relevantArticles(for: topic, in: articles)
            .sorted(by: { $0.publishedAt > $1.publishedAt })

        guard !relevant.isEmpty else { return nil }

        let score = signalScore(for: relevant)
        let intensity = intensity(for: score)
        let momentum = momentum(for: relevant)
        let updatedAt = relevant.first?.publishedAt ?? .distantPast

        return SignalCard(
            id: "\(country.id)-\(topic.rawValue)",
            topic: topic,
            countryCode: country.id,
            countryName: country.localizedName(languageCode: languageCode),
            summary: AppLanguage.localizedFormat(
                "signal_summary",
                languageCode: languageCode,
                AppLanguage.localized(topic.localizationKey, languageCode: languageCode),
                country.localizedName(languageCode: languageCode),
                relevant.count
            ),
            changeSummary: AppLanguage.localizedFormat(
                "signal_change_summary",
                languageCode: languageCode,
                AppLanguage.localized(intensity.localizationKey, languageCode: languageCode),
                AppLanguage.localized(momentum.localizationKey, languageCode: languageCode)
            ),
            intensity: intensity,
            momentum: momentum,
            score: score,
            evidence: relevant,
            updatedAt: updatedAt
        )
    }

    private static func signalScore(for articles: [Article], now: Date = .now) -> Int {
        let recentWeight = articles.reduce(into: 0) { partialResult, article in
            let hoursOld = now.timeIntervalSince(article.publishedAt) / 3600
            switch hoursOld {
            case ..<6:
                partialResult += 3
            case ..<24:
                partialResult += 2
            default:
                partialResult += 1
            }
        }

        return recentWeight
    }

    private static func intensity(for score: Int) -> SignalIntensity {
        switch score {
        case 8...:
            return .elevated
        case 4...:
            return .active
        default:
            return .watch
        }
    }

    private static func momentum(for articles: [Article], now: Date = .now) -> SignalMomentum {
        let recent = articles.filter { now.timeIntervalSince($0.publishedAt) <= 6 * 3600 }.count
        let sameDay = articles.filter { now.timeIntervalSince($0.publishedAt) <= 24 * 3600 }.count

        if recent >= 2 {
            return .new
        }

        if sameDay >= 3 {
            return .rising
        }

        if sameDay >= 1 {
            return .steady
        }

        return .cooling
    }
}
