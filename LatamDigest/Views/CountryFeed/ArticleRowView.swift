import SwiftUI

/// A row representing a single article headline.  Displays the source
/// name, title, snippet and relative publication time.  Tapping the row
/// triggers navigation to the article (handled in the parent view).
struct ArticleRowView: View {
    let article: Article
    let isSaved: Bool
    let onToggleSave: () -> Void

    private var formattedDate: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: article.publishedAt, relativeTo: Date())
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(article.sourceName)
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
                Button(action: onToggleSave) {
                    Image(systemName: isSaved ? "bookmark.fill" : "bookmark")
                        .foregroundStyle(isSaved ? Color.accentColor : Color.secondary)
                }
                .buttonStyle(.plain)
                Text(formattedDate)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            Text(article.title)
                .font(.headline)
                .foregroundColor(.primary)
                .multilineTextAlignment(.leading)
            Text(article.snippet)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .lineLimit(2)
        }
        .padding(.vertical, 8)
    }
}
