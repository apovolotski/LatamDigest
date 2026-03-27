import SwiftUI

struct DossiersView: View {
    let countries: [Country]
    let languageCode: String

    @EnvironmentObject private var workspaceStore: WorkspaceStore
    @State private var showingCreateSheet = false

    var body: some View {
        List {
            Section {
                Text(AppLanguage.localized("dossiers_intro", languageCode: languageCode))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .listRowBackground(Color.clear)
            }

            Section {
                if workspaceStore.dossiers.isEmpty {
                    EmptyWorkspaceCard(
                        title: AppLanguage.localized("dossiers_empty_title", languageCode: languageCode),
                        message: AppLanguage.localized("dossiers_empty_message", languageCode: languageCode)
                    )
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                } else {
                    ForEach(workspaceStore.dossiers) { dossier in
                        NavigationLink {
                            DossierDetailView(dossierID: dossier.id, languageCode: languageCode)
                        } label: {
                            dossierRow(dossier)
                        }
                    }
                    .onDelete(perform: deleteDossiers)
                }
            } header: {
                Text(AppLanguage.localized("dossiers_section_all", languageCode: languageCode))
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(AppLanguage.localized("dossiers_nav_title", languageCode: languageCode))
        .toolbar {
            Button {
                showingCreateSheet = true
            } label: {
                Image(systemName: "plus")
            }
        }
        .sheet(isPresented: $showingCreateSheet) {
            DossierComposerSheet(countries: countries, languageCode: languageCode)
        }
    }

    private func deleteDossiers(at offsets: IndexSet) {
        for index in offsets {
            let dossier = workspaceStore.dossiers[index]
            workspaceStore.deleteDossier(dossier)
        }
    }

    private func dossierRow(_ dossier: Dossier) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(dossier.title)
                .font(.headline)
            if !dossier.conclusion.isEmpty {
                Text(dossier.conclusion)
                    .font(.subheadline)
                    .foregroundStyle(.primary)
                    .lineLimit(2)
            } else if !dossier.note.isEmpty {
                Text(dossier.note)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            HStack(spacing: 8) {
                if let topic = dossier.topic {
                    Label(AppLanguage.localized(topic.localizationKey, languageCode: languageCode), systemImage: topic.icon)
                }
                if let countryCode = dossier.countryCode,
                   let country = countries.first(where: { $0.id == countryCode }) {
                    Label(country.localizedName(languageCode: languageCode), systemImage: "globe.americas")
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)

            Text(
                AppLanguage.localizedFormat(
                    "dossiers_evidence_count",
                    languageCode: languageCode,
                    dossier.evidence.count
                )
            )
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 6)
    }
}

struct DossierDetailView: View {
    let dossierID: UUID
    let languageCode: String

    @EnvironmentObject private var workspaceStore: WorkspaceStore
    @EnvironmentObject private var library: ReadingLibrary
    @State private var noteDraft = ""
    @State private var conclusionDraft = ""

    private var dossier: Dossier? {
        workspaceStore.dossiers.first(where: { $0.id == dossierID })
    }

    var body: some View {
        Group {
            if let dossier {
                List {
                    Section {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(dossier.title)
                                .font(.title3.weight(.bold))

                            if let topic = dossier.topic {
                                Label(AppLanguage.localized(topic.localizationKey, languageCode: languageCode), systemImage: topic.icon)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                    }

                    Section(AppLanguage.localized("dossier_detail_notes", languageCode: languageCode)) {
                        TextEditor(text: $noteDraft)
                            .frame(minHeight: 140)
                    }

                    Section(AppLanguage.localized("dossier_detail_conclusion", languageCode: languageCode)) {
                        TextEditor(text: $conclusionDraft)
                            .frame(minHeight: 140)
                    }

                    Section(AppLanguage.localized("dossier_detail_evidence", languageCode: languageCode)) {
                        ForEach(dossier.evidence) { article in
                            NavigationLink {
                                ArticleDetailView(
                                    article: article,
                                    countryName: AppLanguage.localized("dashboard_nav_title", languageCode: languageCode)
                                )
                            } label: {
                                ArticleRowView(
                                    article: article,
                                    isSaved: library.isSaved(article),
                                    onToggleSave: { library.toggleSaved(article) }
                                )
                            }
                            .swipeActions {
                                Button(role: .destructive) {
                                    workspaceStore.removeArticle(article, from: dossier)
                                } label: {
                                    Label(
                                        AppLanguage.localized("dossier_detail_remove", languageCode: languageCode),
                                        systemImage: "trash"
                                    )
                                }
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .navigationTitle(AppLanguage.localized("workspace_tab_dossiers", languageCode: languageCode))
                .onAppear {
                    noteDraft = dossier.note
                    conclusionDraft = dossier.conclusion
                }
                .onDisappear(perform: saveNotes)
            } else {
                Text(AppLanguage.localized("dossiers_missing", languageCode: languageCode))
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func saveNotes() {
        guard var dossier else { return }
        dossier.note = noteDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        dossier.conclusion = conclusionDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        workspaceStore.updateDossier(dossier)
    }
}

private struct DossierComposerSheet: View {
    let countries: [Country]
    let languageCode: String

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var workspaceStore: WorkspaceStore

    @State private var title = ""
    @State private var note = ""
    @State private var selectedTopic: WatchTopic?
    @State private var selectedCountryCode: String = ""

    var body: some View {
        NavigationStack {
            Form {
                Section(AppLanguage.localized("dossiers_create_section", languageCode: languageCode)) {
                    TextField(
                        AppLanguage.localized("dossiers_create_title_placeholder", languageCode: languageCode),
                        text: $title
                    )
                    TextField(
                        AppLanguage.localized("dossiers_create_note_placeholder", languageCode: languageCode),
                        text: $note,
                        axis: .vertical
                    )
                    .lineLimit(3...6)
                }

                Section(AppLanguage.localized("dossiers_create_topic_label", languageCode: languageCode)) {
                    Picker(
                        AppLanguage.localized("dossiers_create_topic_label", languageCode: languageCode),
                        selection: $selectedTopic
                    ) {
                        Text(AppLanguage.localized("dossiers_create_none", languageCode: languageCode))
                            .tag(nil as WatchTopic?)
                        ForEach(WatchTopic.allCases) { topic in
                            Text(AppLanguage.localized(topic.localizationKey, languageCode: languageCode))
                                .tag(Optional(topic))
                        }
                    }
                }

                Section(AppLanguage.localized("dossiers_create_country_label", languageCode: languageCode)) {
                    Picker(
                        AppLanguage.localized("dossiers_create_country_label", languageCode: languageCode),
                        selection: $selectedCountryCode
                    ) {
                        Text(AppLanguage.localized("dossiers_create_none", languageCode: languageCode))
                            .tag("")
                        ForEach(countries) { country in
                            Text(country.localizedName(languageCode: languageCode))
                                .tag(country.id)
                        }
                    }
                }
            }
            .navigationTitle(AppLanguage.localized("dossiers_create_nav_title", languageCode: languageCode))
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(AppLanguage.localized("dossiers_create_cancel", languageCode: languageCode)) {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(AppLanguage.localized("dossiers_create_save", languageCode: languageCode)) {
                        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
                        workspaceStore.createDossier(
                            title: trimmedTitle.isEmpty ? AppLanguage.localized("dossiers_create_untitled", languageCode: languageCode) : trimmedTitle,
                            note: note.trimmingCharacters(in: .whitespacesAndNewlines),
                            topic: selectedTopic,
                            countryCode: selectedCountryCode.isEmpty ? nil : selectedCountryCode
                        )
                        dismiss()
                    }
                }
            }
        }
    }
}
