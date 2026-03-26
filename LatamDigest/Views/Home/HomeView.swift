import SwiftUI

/// The main screen displayed after onboarding.  Shows the user's
/// followed countries and the full country list.  The copy makes it
/// explicit that tapping a country opens that country's digest.
struct HomeView: View {
    @AppStorage("preferredLanguage") private var preferredLanguage: String = Locale.current.language.languageCode?.identifier ?? "es"
    @AppStorage("selectedCountries") private var selectedCountriesString: String = ""
    @EnvironmentObject private var library: ReadingLibrary
    @State private var allCountries: [Country] = []
    @State private var briefingArticles: [Article] = []
    @State private var isLoadingBriefing = false

    private var selectedCountries: [String] {
        selectedCountriesString.split(separator: ",").map { String($0) }
    }

    private var followedCountries: [Country] {
        allCountries.filter { selectedCountries.contains($0.id) }
    }

    private var personalizedBriefing: BriefingCard? {
        BriefingComposer.personalizedBriefing(
            countries: followedCountries,
            articles: briefingArticles,
            languageCode: preferredLanguage
        )
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(AppLanguage.localized("home_title", languageCode: preferredLanguage))
                            .font(.largeTitle)
                            .fontWeight(.bold)
                        Text(AppLanguage.localized("home_subtitle", languageCode: preferredLanguage))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }

                    if isLoadingBriefing {
                        ProgressView(AppLanguage.localized("home_briefing_loading", languageCode: preferredLanguage))
                    } else if let personalizedBriefing {
                        briefingCard(personalizedBriefing)
                    }

                    if !briefingArticles.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text(AppLanguage.localized("home_for_you", languageCode: preferredLanguage))
                                .font(.title3)
                                .fontWeight(.semibold)
                                .foregroundStyle(.secondary)

                            ForEach(briefingArticles.prefix(4)) { article in
                                NavigationLink(destination: ArticleDetailView(
                                    article: article,
                                    countryName: followedCountries.first(where: { article.title.localizedCaseInsensitiveContains($0.localizedName(languageCode: preferredLanguage)) })?.localizedName(languageCode: preferredLanguage)
                                    ?? AppLanguage.localized("home_briefing_region", languageCode: preferredLanguage)
                                )) {
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

                    if !library.savedArticles.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text(AppLanguage.localized("home_saved_section", languageCode: preferredLanguage))
                                .font(.title3)
                                .fontWeight(.semibold)
                                .foregroundStyle(.secondary)

                            ForEach(library.savedArticles.prefix(3)) { article in
                                NavigationLink(destination: ArticleDetailView(
                                    article: article,
                                    countryName: AppLanguage.localized("home_briefing_region", languageCode: preferredLanguage)
                                )) {
                                    ArticleRowView(
                                        article: article,
                                        isSaved: true,
                                        onToggleSave: { library.toggleSaved(article) }
                                    )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    if !selectedCountries.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text(AppLanguage.localized("home_my_countries", languageCode: preferredLanguage))
                                .font(.title3)
                                .fontWeight(.semibold)
                                .foregroundStyle(.secondary)

                            ForEach(selectedCountries, id: \.self) { code in
                                if let country = allCountries.first(where: { $0.id == code }) {
                                    NavigationLink(destination: CountryFeedView(country: country)) {
                                        countryCard(
                                            country: country,
                                            subtitle: AppLanguage.localized("home_open_digest", languageCode: preferredLanguage),
                                            isSelected: true
                                        )
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        Text(AppLanguage.localized("home_all_countries", languageCode: preferredLanguage))
                            .font(.title3)
                            .fontWeight(.semibold)
                            .foregroundStyle(.secondary)

                        LazyVStack(spacing: 12) {
                            ForEach(allCountries) { country in
                                NavigationLink(destination: CountryFeedView(country: country)) {
                                    countryCard(
                                        country: country,
                                        subtitle: AppLanguage.localized("home_browse_digest", languageCode: preferredLanguage),
                                        isSelected: selectedCountries.contains(country.id)
                                    )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding()
            }
            .toolbar {
                NavigationLink(destination: SettingsView()) {
                    Image(systemName: "gearshape")
                }
            }
        }
        .onAppear {
            loadCountries()
            Task {
                await loadBriefing()
            }
        }
        .onChange(of: selectedCountriesString) { _, _ in
            Task {
                await loadBriefing()
            }
        }
        .onChange(of: preferredLanguage) { _, _ in
            allCountries.sort { $0.localizedName(languageCode: preferredLanguage) < $1.localizedName(languageCode: preferredLanguage) }
            Task {
                await loadBriefing()
            }
        }
    }

    private func countryCard(country: Country, subtitle: String, isSelected: Bool) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(country.localizedName(languageCode: preferredLanguage))
                    .font(.headline)
                    .foregroundStyle(.primary)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if isSelected {
                Image(systemName: "star.fill")
                    .foregroundStyle(.yellow)
            }

            Image(systemName: "chevron.right")
                .foregroundStyle(.tertiary)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(.background)
                .shadow(color: .black.opacity(0.05), radius: 12, y: 4)
        )
    }

    private func loadCountries() {
        guard allCountries.isEmpty else { return }
        if let url = Bundle.main.url(forResource: "Countries", withExtension: "json") {
            do {
                let data = try Data(contentsOf: url)
                let decoder = JSONDecoder()
                allCountries = try decoder.decode([Country].self, from: data)
                allCountries.sort { $0.localizedName(languageCode: preferredLanguage) < $1.localizedName(languageCode: preferredLanguage) }
            } catch {
                print("Failed to load Countries.json: \(error)")
            }
        }
    }

    private func loadBriefing() async {
        guard !selectedCountries.isEmpty else {
            await MainActor.run {
                briefingArticles = []
                isLoadingBriefing = false
            }
            return
        }

        await MainActor.run { isLoadingBriefing = true }
        var aggregated: [Article] = []

        await withTaskGroup(of: [Article].self) { group in
            for code in selectedCountries.prefix(3) {
                group.addTask {
                    (try? await NewsService.shared.fetchTopArticles(countryCode: code)) ?? []
                }
            }

            for await result in group {
                aggregated.append(contentsOf: result.prefix(3))
            }
        }

        await MainActor.run {
            briefingArticles = aggregated
                .sorted(by: { $0.publishedAt > $1.publishedAt })
            isLoadingBriefing = false
        }
    }

    private func briefingCard(_ briefing: BriefingCard) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(briefing.title)
                .font(.title2.weight(.bold))
            Text(briefing.summary)
                .foregroundStyle(.secondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(briefing.themes, id: \.self) { theme in
                        Text(theme)
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(
                                Capsule()
                                    .fill(Color.white.opacity(0.72))
                            )
                    }
                }
            }
            Text(briefing.whyItMatters)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            Color(red: 0.92, green: 0.96, blue: 1.0),
                            Color(red: 0.98, green: 0.95, blue: 0.90)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        )
    }
}
