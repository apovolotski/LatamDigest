import Foundation

enum ArticleSearch {
    static func filter(_ articles: [Article], query: String) -> [Article] {
        let terms = query.split(whereSeparator: \.isWhitespace).map(String.init)
        guard !terms.isEmpty else { return articles }
        return articles.filter { article in
            let text = "\(article.title) \(article.snippet) \(article.sourceName)"
            return terms.allSatisfy { text.range(of: $0, options: [.caseInsensitive, .diacriticInsensitive, .widthInsensitive]) != nil }
        }
    }
}
