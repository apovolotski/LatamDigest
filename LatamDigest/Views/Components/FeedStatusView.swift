import SwiftUI

struct FeedStatusView: View {
    let result: FeedResult
    let languageCode: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label(AppLanguage.localized(result.isCached ? "news_cached" : "news_updated", languageCode: languageCode),
                  systemImage: result.isCached ? "wifi.slash" : "checkmark.circle")
                .font(.caption.weight(.semibold))
            Text(result.fetchedAt, format: .dateTime.month().day().hour().minute())
                .font(.caption)
            if result.isCached {
                Text(AppLanguage.localized("news_cached_detail", languageCode: languageCode)).font(.caption)
            }
        }
        .foregroundStyle(.secondary)
        .accessibilityElement(children: .combine)
    }
}
