package com.apovolotski.japandigest

import android.app.Application
import android.util.AtomicFile
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import java.io.File
import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

data class AppState(
    val ready: Boolean = false,
    val readOnly: Boolean = false,
    val data: UserData = UserData(),
    val news: NewsResult = NewsResult(emptyList(), emptyList(), emptyList(), null),
    val loading: Boolean = false,
    val error: String? = null
)

class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val mutable = MutableStateFlow(AppState())
    val state = mutable.asStateFlow()
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val file = File(application.filesDir, "notebook-v1.json")
    private val mutex = Mutex()
    private val repository = NewsRepository(File(application.cacheDir, "headlines-v1"))
    private var refreshJob: Job? = null

    init {
        viewModelScope.launch {
            try {
                val data = withContext(Dispatchers.IO) {
                    val atomic = AtomicFile(file)
                    if (atomic.baseFile.exists() || File(file.path + ".bak").exists()) {
                        atomic.openRead().use { input ->
                            require(input.channel.size() <= 12_000_000)
                            val bytes = input.readBytes()
                            json.decodeFromString<UserData>(bytes.toString(Charsets.UTF_8)).validated()
                        }
                    } else UserData()
                }
                mutable.value = AppState(ready = true, data = data)
                ReminderScheduler.configure(application, data)
                if (data.onboarded) refresh()
            } catch (_: Exception) {
                mutable.value = AppState(ready = true, readOnly = true,
                    error = "保存情報を開けませんでした。情報を上書きせず保護しています。アプリを再起動しても解決しない場合はサポートへお問い合わせください。")
            }
        }
    }

    private fun update(transform: (UserData) -> UserData) = update(transform, null)

    private fun update(transform: (UserData) -> UserData, after: (() -> Unit)?) {
        viewModelScope.launch {
            mutex.withLock {
                if (!mutable.value.ready || mutable.value.readOnly) return@withLock
                try {
                    val updated = transform(mutable.value.data).validated()
                    withContext(Dispatchers.IO) { atomicWrite(file, json.encodeToString(updated)) }
                    mutable.value = mutable.value.copy(data = updated)
                    after?.invoke()
                } catch (cancelled: CancellationException) { throw cancelled }
                catch (_: Exception) { mutable.value = mutable.value.copy(error = "保存できませんでした。空き容量や入力内容を確認してください。") }
            }
        }
    }

    fun dismissError() { if (!mutable.value.readOnly) mutable.value = mutable.value.copy(error = null) }
    fun message(message: String) { mutable.value = mutable.value.copy(error = message) }

    fun start(sourceIds: Set<String>) {
        if (sourceIds.isEmpty()) return
        update({ it.copy(onboarded = true, sourceIds = sourceIds) }) { refresh() }
    }

    fun sources(sourceIds: Set<String>) {
        update({ it.copy(sourceIds = sourceIds) }) {
            // Clear results immediately: deselected sources must not remain visible while refreshing.
            mutable.value = mutable.value.copy(news = mutable.value.news.copy(articles = mutable.value.news.articles.filter { it.sourceId in sourceIds }))
            refresh()
        }
    }

    fun refresh() {
        refreshJob?.cancel()
        val sources = mutable.value.data.sourceIds
        refreshJob = viewModelScope.launch {
            mutable.value = mutable.value.copy(loading = true)
            try {
                val result = repository.load(sources)
                mutable.value = mutable.value.copy(news = result, loading = false)
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { mutable.value = mutable.value.copy(loading = false, error = "ニュースを取得できませんでした。接続を確認して再試行してください。") }
        }
    }

    fun toggleSaved(article: Article) = update { data ->
        val exists = data.saved.any { it.id == article.id }
        if (!exists && data.saved.size >= 500) throw IllegalArgumentException("Saved limit")
        data.copy(saved = if (exists) data.saved.filterNot { it.id == article.id } else listOf(article) + data.saved)
    }

    fun recordRead(article: Article) = update { data ->
        data.copy(history = (listOf(article) + data.history.filterNot { it.id == article.id }).take(200))
    }
    fun clearHistory() = update { it.copy(history = emptyList()) }

    fun saveNotebook(notebook: Notebook, onSaved: () -> Unit) = update({ data ->
        val exists = data.notebooks.any { it.id == notebook.id }
        require(exists || data.notebooks.size < 100)
        data.copy(notebooks = (listOf(notebook.copy(updatedAt = System.currentTimeMillis())) +
            data.notebooks.filterNot { it.id == notebook.id }).sortedByDescending { it.updatedAt })
    }, onSaved)

    fun attach(article: Article, notebookId: String?, title: String, onSaved: () -> Unit) = update({ data ->
        val old = data.notebooks.find { it.id == notebookId }
        require(old != null || data.notebooks.size < 100)
        val notebook = old ?: Notebook(UUID.randomUUID().toString(), title.trim())
        val articles = if (notebook.articles.any { it.id == article.id }) notebook.articles else notebook.articles + article
        require(articles.size <= 100)
        data.copy(notebooks = (listOf(notebook.copy(articles = articles, updatedAt = System.currentTimeMillis())) +
            data.notebooks.filterNot { it.id == notebook.id }).sortedByDescending { it.updatedAt })
    }, onSaved)

    fun deleteNotebook(id: String) = update { it.copy(notebooks = it.notebooks.filterNot { notebook -> notebook.id == id }) }
    fun removeArticle(notebookId: String, articleId: String) = update { data ->
        data.copy(notebooks = data.notebooks.map { notebook ->
            if (notebook.id == notebookId) notebook.copy(articles = notebook.articles.filterNot { it.id == articleId }) else notebook
        })
    }

    fun reminder(enabled: Boolean, hour: Int = state.value.data.reminderHour, minute: Int = state.value.data.reminderMinute) {
        update({ it.copy(reminders = enabled, reminderHour = hour, reminderMinute = minute) }) {
            ReminderScheduler.configure(getApplication(), mutable.value.data)
        }
    }
}
