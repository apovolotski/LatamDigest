#if JAPAN_EDITION
import Foundation

struct JapanSource: Identifiable, Equatable {
    let id: String
    let name: String
    let domain: String

    static let all: [JapanSource] = [
        .init(id: "NH", name: "NHKニュース", domain: "news.web.nhk"),
        .init(id: "AS", name: "朝日新聞", domain: "asahi.com"),
        .init(id: "MA", name: "毎日新聞", domain: "mainichi.jp"),
        .init(id: "YO", name: "読売新聞", domain: "yomiuri.co.jp"),
        .init(id: "NI", name: "日本経済新聞", domain: "nikkei.com"),
        .init(id: "KY", name: "47NEWS", domain: "47news.jp")
    ]
    static let defaultSelection = "NH,AS,MA,YO,NI,KY"

    static func feedURL(sourceID: String, feed: CountryFeedViewModel.FeedType = .top) throws -> URL {
        guard let source = all.first(where: { $0.id == sourceID }) else {
            throw NewsService.NewsServiceError.invalidConfiguration
        }
        let categories = ["politics": "政治", "business": "企業", "economy": "経済", "sports": "スポーツ",
                          "tech": "技術", "culture": "文化", "crime": "事件", "world": "国際"]
        let category = feed.categoryKey.flatMap { categories[$0] } ?? ""
        var components = URLComponents(string: "https://news.google.com/rss/search")!
        components.queryItems = [
            URLQueryItem(name: "q", value: "site:\(source.domain) \(category) when:7d"),
            URLQueryItem(name: "hl", value: "ja"),
            URLQueryItem(name: "gl", value: "JP"),
            URLQueryItem(name: "ceid", value: "JP:ja")
        ]
        guard let url = components.url else { throw NewsService.NewsServiceError.invalidConfiguration }
        return url
    }
}
#endif
