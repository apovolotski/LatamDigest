import Foundation

struct BriefingCard {
    let title: String
    let summary: String
    let themes: [String]
    let whyItMatters: String
}

enum BriefingComposer {
    static func personalizedBriefing(
        countries: [Country],
        articles: [Article],
        languageCode: String
    ) -> BriefingCard? {
        guard !articles.isEmpty else { return nil }

        let countryNames = countries.map { $0.localizedName(languageCode: languageCode) }
        let title = AppLanguage.localized("home_briefing_title", languageCode: languageCode)
        let summary = AppLanguage.localizedFormat(
            "home_briefing_summary",
            languageCode: languageCode,
            countryNames.joined(separator: ", "),
            articles.count
        )

        return BriefingCard(
            title: title,
            summary: summary,
            themes: extractThemes(from: articles, languageCode: languageCode),
            whyItMatters: AppLanguage.localizedFormat(
                "home_briefing_why",
                languageCode: languageCode,
                countryNames.first ?? AppLanguage.localized("home_briefing_region", languageCode: languageCode)
            )
        )
    }

    static func countryBriefing(
        country: Country,
        articles: [Article],
        languageCode: String
    ) -> BriefingCard? {
        guard !articles.isEmpty else { return nil }

        let localizedCountry = country.localizedName(languageCode: languageCode)
        let leadSources = Array(Set(articles.prefix(3).map(\.sourceName))).joined(separator: ", ")
        let summary = AppLanguage.localizedFormat(
            "feed_briefing_summary",
            languageCode: languageCode,
            localizedCountry,
            max(articles.count, 1),
            leadSources.isEmpty ? articles.first?.sourceName ?? localizedCountry : leadSources
        )

        return BriefingCard(
            title: AppLanguage.localizedFormat("feed_briefing_title", languageCode: languageCode, localizedCountry),
            summary: summary,
            themes: extractThemes(from: articles, languageCode: languageCode),
            whyItMatters: AppLanguage.localizedFormat("feed_briefing_why", languageCode: languageCode, localizedCountry)
        )
    }

    static func articleContext(
        for article: Article,
        countryName: String,
        languageCode: String
    ) -> String {
        AppLanguage.localizedFormat("detail_context_summary", languageCode: languageCode, countryName, article.sourceName)
    }

    static func keyPoints(for article: Article) -> [String] {
        var points = [article.title]

        let snippetParts = article.snippet
            .split(whereSeparator: { ".!?".contains($0) })
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        points.append(contentsOf: snippetParts.prefix(2))
        return Array(NSOrderedSet(array: points)) as? [String] ?? points
    }

    private static func extractThemes(from articles: [Article], languageCode: String) -> [String] {
        let dictionary = [
            ("election", "theme_politics"),
            ("government", "theme_government"),
            ("econom", "theme_economy"),
            ("market", "theme_business"),
            ("trade", "theme_business"),
            ("tech", "theme_technology"),
            ("startup", "theme_technology"),
            ("crime", "theme_public_safety"),
            ("security", "theme_public_safety"),
            ("sport", "theme_sports"),
            ("cup", "theme_sports"),
            ("culture", "theme_culture"),
            ("art", "theme_culture")
        ]

        let combined = articles.map { "\($0.title) \($0.snippet)".lowercased() }.joined(separator: " ")
        var themes: [String] = []

        for (needle, key) in dictionary where combined.contains(needle) {
            themes.append(AppLanguage.localized(key, languageCode: languageCode))
        }

        if themes.isEmpty {
            themes = [
                AppLanguage.localized("theme_regional_watch", languageCode: languageCode),
                AppLanguage.localized("theme_policy_moves", languageCode: languageCode),
                AppLanguage.localized("theme_public_reaction", languageCode: languageCode)
            ]
        }

        return Array(themes.prefix(3))
    }
}
