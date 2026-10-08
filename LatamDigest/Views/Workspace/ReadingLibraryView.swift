import SwiftUI

struct ReadingLibraryView: View {
    @EnvironmentObject private var library: ReadingLibrary
    @AppStorage("preferredLanguage") private var languageCode = AppEdition.defaultLanguage
    @State private var searchText = ""
    @State private var showingHistory = false
    @State private var selectedArticle: Article?

    private var articles: [Article] {
        ArticleSearch.filter(showingHistory ? library.readingHistory : library.savedArticles, query: searchText)
    }
    var body: some View {
        List {
            Picker(AppLanguage.localized("library_title", languageCode: languageCode), selection: $showingHistory) {
                Text(AppLanguage.localized("library_saved", languageCode: languageCode)).tag(false)
                Text(AppLanguage.localized("library_history", languageCode: languageCode)).tag(true)
            }
            .pickerStyle(.segmented)
            if articles.isEmpty {
                ContentUnavailableView(AppLanguage.localized(searchText.isEmpty ? "library_empty" : "news_no_matches", languageCode: languageCode),
                                       systemImage: "bookmark")
            }
            ForEach(articles) { article in
                ArticleRowView(article: article, isSaved: library.isSaved(article), onToggleSave: { library.toggleSaved(article) })
                    .contentShape(Rectangle())
                    .onTapGesture { selectedArticle = article; library.markAsRead(article) }
            }
        }
        .accessibilityIdentifier("reading-library")
        .navigationTitle(AppLanguage.localized("library_title", languageCode: languageCode))
        .searchable(text: $searchText, placement: .navigationBarDrawer(displayMode: .always), prompt: AppLanguage.localized("news_search", languageCode: languageCode))
        .navigationDestination(item: $selectedArticle) { ArticleDetailView(article: $0, countryName: "") }
    }
}
