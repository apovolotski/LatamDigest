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
        let themeKeywords: [(key: String, needles: [String])] = [
            ("theme_politics", ["election", "elections", "president", "senate", "congress", "diputados", "senado", "elección", "elecciones", "oficialismo", "oposición", "golpe"]),
            ("theme_government", ["government", "ministry", "cabinet", "policy", "gobierno", "ministerio", "decreto", "boletín oficial"]),
            ("theme_economy", ["econom", "market", "markets", "trade", "inflation", "salary", "labor", "labour", "mercado", "laboral", "salario", "inflación", "empleo", "deuda"]),
            ("theme_business", ["business", "company", "companies", "startup", "corporate", "empresa", "empresas", "industria"]),
            ("theme_technology", ["tech", "technology", "ai", "startup", "software", "tecnología", "inteligencia artificial", "digital"]),
            ("theme_public_safety", ["crime", "security", "violence", "police", "racism", "racismo", "seguridad", "epidemiológico", "epidemiologico", "salud", "dengue", "submarinos", "defensa"]),
            ("theme_sports", ["sport", "sports", "copa", "mundial", "selección", "seleccion", "partido", "vs.", "vs ", "scaloni", "amistoso", "tyc", "espn"]),
            ("theme_culture", ["culture", "cultural", "art", "music", "cine", "cultura", "arte", "museo"])
        ]

        var scores: [String: Int] = [:]

        for article in articles {
            let text = article.title.lowercased()
            for theme in themeKeywords {
                let matches = theme.needles.reduce(into: 0) { partialResult, needle in
                    if text.contains(needle) {
                        partialResult += 1
                    }
                }

                if matches > 0 {
                    scores[theme.key, default: 0] += matches
                }
            }
        }

        let sortedThemes = scores
            .sorted { lhs, rhs in
                if lhs.value == rhs.value {
                    return lhs.key < rhs.key
                }
                return lhs.value > rhs.value
            }
            .map { AppLanguage.localized($0.key, languageCode: languageCode) }

        if sortedThemes.isEmpty {
            return [
                AppLanguage.localized("theme_regional_watch", languageCode: languageCode),
                AppLanguage.localized("theme_policy_moves", languageCode: languageCode),
                AppLanguage.localized("theme_public_reaction", languageCode: languageCode)
            ]
        }

        return Array(sortedThemes.prefix(3))
    }
}
