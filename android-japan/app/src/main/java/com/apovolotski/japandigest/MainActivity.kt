package com.apovolotski.japandigest

import android.Manifest
import android.app.TimePickerDialog
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.UUID

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { JapanTheme { JapanApp() } }
    }
}

@Composable
private fun JapanTheme(content: @Composable () -> Unit) {
    val dark = androidx.compose.foundation.isSystemInDarkTheme()
    val colors = if (dark) darkColorScheme(primary = Color(0xFFFFB3B8), background = Color(0xFF17191D), surface = Color(0xFF202227))
        else lightColorScheme(primary = Color(0xFFB52D39), onPrimary = Color.White, background = Color(0xFFF7F5EE),
            surface = Color(0xFFFFFDF8), secondary = Color(0xFF193044))
    MaterialTheme(colorScheme = colors, content = content)
}

private val stamp = DateTimeFormatter.ofPattern("M月d日 HH:mm", Locale.JAPAN)
private fun dateText(time: Long) = stamp.format(Instant.ofEpochMilli(time).atZone(ZoneId.systemDefault()))
private fun sourceNames(ids: List<String>) = NewsSource.all.filter { it.id in ids }.joinToString("、") { it.name }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JapanApp(vm: AppViewModel = viewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var settings by rememberSaveable { mutableStateOf(false) }
    var topic by remember { mutableStateOf<NewsTopic?>(null) }
    var article by remember { mutableStateOf<Article?>(null) }
    var notebook by remember { mutableStateOf<Notebook?>(null) }
    val context = LocalContext.current
    fun open(article: Article) {
        if (!article.isSafe()) { vm.message("安全な記事リンクを確認できませんでした。"); return }
        try {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(article.url)).addCategory(Intent.CATEGORY_BROWSABLE))
            vm.recordRead(article)
        } catch (_: Exception) { vm.message("記事を開けませんでした。ブラウザを確認してください。") }
    }
    fun openPage(url: String) {
        try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
        catch (_: Exception) { vm.message("ページを開けませんでした。") }
    }
    BackHandler(enabled = article != null || topic != null || settings) {
        when { article != null -> article = null; settings -> settings = false; else -> topic = null }
    }

    if (!state.ready) {
        Surface(Modifier.fillMaxSize()) { Box(contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
        return
    }
    if (state.readOnly) {
        Surface(Modifier.fillMaxSize()) {
            Column(Modifier.safeDrawingPadding().padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("保存情報を保護しています", style = MaterialTheme.typography.headlineSmall)
                Text(state.error.orEmpty())
                Button(onClick = { openPage(SUPPORT_URL) }) { Text("サポートを開く") }
            }
        }
        return
    }
    if (!state.data.onboarded) {
        Onboarding(state.data.sourceIds, vm::start)
    } else if (notebook != null && article == null) {
        NotebookEditor(notebook!!, onClose = { notebook = null }, onSave = { draft -> vm.saveNotebook(draft) { notebook = null } },
            onDelete = { id -> vm.deleteNotebook(id); notebook = null }, onOpen = ::open)
    } else {
        val titles = listOf("新着", "テーマ", "ライブラリ", "手帖")
        val icons = listOf(Icons.Default.Newspaper, Icons.Default.GridView, Icons.Default.Bookmarks, Icons.Default.MenuBook)
        val root = !settings && topic == null && article == null
        Scaffold(
            topBar = {
                TopAppBar(title = { Text(when {
                    article != null -> "記事の見出し"
                    settings -> "設定"
                    topic != null -> topic!!.title
                    tab == 0 -> "日本ニュース手帖"
                    else -> titles[tab]
                }) }, navigationIcon = {
                    if (!root) IconButton(onClick = { when { article != null -> article = null; settings -> settings = false; else -> topic = null } }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "戻る")
                    }
                }, actions = {
                    if (root) IconButton(onClick = { settings = true }) { Icon(Icons.Default.Settings, "設定") }
                })
            },
            bottomBar = {
                if (root) NavigationBar {
                    titles.forEachIndexed { index, title ->
                        NavigationBarItem(modifier = Modifier.testTag("tab-$index"), selected = tab == index, onClick = { tab = index },
                            icon = { Icon(icons[index], null) }, label = { Text(title) })
                    }
                }
            }
        ) { padding ->
            Box(Modifier.padding(padding).fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                Box(Modifier.widthIn(max = 840.dp).fillMaxSize()) {
                    when {
                        article != null -> ArticleDetail(article!!, state.data, { vm.toggleSaved(article!!) }, ::open,
                            { selected, id, title, done -> vm.attach(selected, id, title, done) })
                        settings -> Settings(state.data, vm, ::openPage)
                        topic != null -> HeadlineList(state.news.articles.filter { topic!!.matches(it) }, state.data,
                            "テーマの分類は見出しのキーワードによる目安です。", onDetail = { article = it }, onSave = vm::toggleSaved)
                        tab == 0 -> NewsScreen(state, vm::refresh, { article = it }, vm::toggleSaved)
                        tab == 1 -> Topics(state.news.articles) { topic = it }
                        tab == 2 -> Library(state.data, { article = it }, vm::toggleSaved)
                        else -> Notebooks(state.data.notebooks, { notebook = it }, {
                            notebook = Notebook(UUID.randomUUID().toString(), "")
                        })
                    }
                }
            }
        }
    }
    state.error?.let { message ->
        AlertDialog(onDismissRequest = vm::dismissError, title = { Text("お知らせ") }, text = { Text(message) },
            confirmButton = { TextButton(onClick = vm::dismissError) { Text("閉じる") } })
    }
}

@Composable
private fun Onboarding(initial: Set<String>, onStart: (Set<String>) -> Unit) {
    var selected by remember { mutableStateOf(initial) }
    Scaffold(bottomBar = {
        Surface(tonalElevation = 3.dp) {
            Button(onClick = { onStart(selected) }, enabled = selected.isNotEmpty(),
                modifier = Modifier.navigationBarsPadding().padding(16.dp).fillMaxWidth()) { Text("はじめる") }
        }
    }) { padding ->
        Column(Modifier.padding(padding).statusBarsPadding().fillMaxSize().verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(Icons.Default.MenuBook, null, Modifier.size(48.dp), tint = MaterialTheme.colorScheme.primary)
            Text("ようこそ", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
            Text("日本ニュース手帖", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
            Text("日本のニュースを、自分の手帖に。", style = MaterialTheme.typography.titleLarge)
            Text("配信元を選び、気になる見出しを保存。テーマごとに記事を読み比べ、手帖にメモを残せます。")
            SectionTitle("読みたい配信元")
            SourceChecks(selected) { selected = it }
            Text("個人の非商用利用のための無料フィードリーダーです。Google ニュースRSSを通じて見出しを取得し、本文は配信元で開きます。各媒体とは提携していません。", style = MaterialTheme.typography.bodySmall)
            Text("アカウント不要。保存情報はこの端末に保管されます。通知は設定から任意で有効にできます。", style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun SourceChecks(selected: Set<String>, onChange: (Set<String>) -> Unit) {
    NewsSource.all.forEach { source ->
        Row(Modifier.fillMaxWidth().clickable { onChange(if (source.id in selected) selected - source.id else selected + source.id) }
            .padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = source.id in selected, onCheckedChange = null)
            Spacer(Modifier.width(12.dp))
            Text(source.name, Modifier.weight(1f))
        }
    }
}

@Composable
private fun NewsScreen(state: AppState, refresh: () -> Unit, detail: (Article) -> Unit, save: (Article) -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    var filter by rememberSaveable { mutableStateOf("") }
    LaunchedEffect(state.data.sourceIds) { if (filter !in state.data.sourceIds) filter = "" }
    val articles = state.news.articles.filter { (filter.isEmpty() || it.sourceId == filter) && it.matches(query) }
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text(LocalDate.now().format(DateTimeFormatter.ofPattern("M月d日 EEEE", Locale.JAPAN)), color = MaterialTheme.colorScheme.primary)
            Text("気になる見出しを読み、\n保存し、考えを残す。", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(vertical = 12.dp))
            SearchField(query, { query = it })
        }
        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item { FilterChip(selected = filter.isEmpty(), onClick = { filter = "" }, label = { Text("すべて") }) }
                items(NewsSource.all.filter { it.id in state.data.sourceIds }) { source ->
                    FilterChip(selected = filter == source.id, onClick = { filter = source.id }, label = { Text(source.name) })
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("新着の見出し", style = MaterialTheme.typography.titleMedium)
                    state.news.fetchedAt?.let { Text("最終取得：${dateText(it)}", style = MaterialTheme.typography.bodySmall) }
                }
                TextButton(onClick = refresh, enabled = !state.loading && state.data.sourceIds.isNotEmpty()) {
                    Icon(Icons.Default.Refresh, null); Text("更新")
                }
            }
            if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth().testTag("news-loading"))
            if (state.news.cached.isNotEmpty()) Text("保存済みの見出し：${sourceNames(state.news.cached)}", style = MaterialTheme.typography.bodySmall)
            if (state.news.unavailable.isNotEmpty()) Text("取得できない配信元：${sourceNames(state.news.unavailable)}", style = MaterialTheme.typography.bodySmall)
        }
        if (articles.isEmpty() && !state.loading) item {
            EmptyMessage(if (state.data.sourceIds.isEmpty()) "設定から配信元を選んでください" else "一致する見出しがありません", "接続や検索条件を確認し、更新してください。")
        }
        items(articles, key = { it.id }) { article -> HeadlineCard(article, state.data.saved.any { it.id == article.id }, { detail(article) }, { save(article) }) }
        item { FeedNotice() }
    }
}

@Composable
private fun HeadlineCard(article: Article, saved: Boolean, detail: () -> Unit, save: () -> Unit) {
    OutlinedCard(Modifier.fillMaxWidth().testTag("headline-card")) {
        Column(Modifier.padding(start = 16.dp, end = 8.dp, top = 6.dp, bottom = 16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(article.sourceName, Modifier.weight(1f), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                IconButton(onClick = save) { Icon(if (saved) Icons.Default.Bookmark else Icons.Default.BookmarkBorder, if (saved) "保存を解除" else "記事を保存") }
            }
            Text(article.title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.fillMaxWidth().clickable(onClick = detail).padding(end = 8.dp, bottom = 12.dp))
            Text(dateText(article.publishedAt), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun SearchField(query: String, change: (String) -> Unit) {
    OutlinedTextField(query, change, Modifier.fillMaxWidth(), label = { Text("見出し・配信元を検索") }, singleLine = true,
        leadingIcon = { Icon(Icons.Default.Search, null) }, trailingIcon = {
            if (query.isNotEmpty()) IconButton(onClick = { change("") }) { Icon(Icons.Default.Close, "検索を消去") }
        })
}

@Composable
private fun HeadlineList(articles: List<Article>, data: UserData, note: String, onDetail: (Article) -> Unit, onSave: (Article) -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    val filtered = articles.filter { it.matches(query) }
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text(note, style = MaterialTheme.typography.bodyMedium); Spacer(Modifier.height(12.dp)); SearchField(query) { query = it } }
        if (filtered.isEmpty()) item { EmptyMessage("記事がありません", "新着画面で更新するか、検索条件を変えてください。") }
        items(filtered, key = { it.id }) { article -> HeadlineCard(article, data.saved.any { it.id == article.id }, { onDetail(article) }, { onSave(article) }) }
    }
}

@Composable
private fun Topics(articles: List<Article>, select: (NewsTopic) -> Unit) {
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text("日本語の見出しから、気になるテーマを探しましょう。分類はキーワードによる目安です。") }
        items(NewsTopic.entries) { topic ->
            OutlinedCard(onClick = { select(topic) }, modifier = Modifier.fillMaxWidth()) {
                Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(topic.title, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium)
                    Text("${articles.count { topic.matches(it) }}件", color = MaterialTheme.colorScheme.primary)
                    Icon(Icons.Default.ChevronRight, null)
                }
            }
        }
    }
}

@Composable
private fun Library(data: UserData, detail: (Article) -> Unit, save: (Article) -> Unit) {
    var history by rememberSaveable { mutableStateOf(false) }
    Column {
        Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(!history, { history = false }, label = { Text("保存した記事（${data.saved.size}）") })
            FilterChip(history, { history = true }, label = { Text("閲覧履歴（${data.history.size}）") })
        }
        HeadlineList(if (history) data.history else data.saved, data,
            if (history) "配信元で開いた記事の履歴です。設定から消去できます。" else "気になる見出しを保存して、あとから読み返せます。", detail, save)
    }
}

@Composable
private fun ArticleDetail(article: Article, data: UserData, save: () -> Unit, open: (Article) -> Unit,
                          attach: (Article, String?, String, () -> Unit) -> Unit) {
    var picker by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Text(article.sourceName, color = MaterialTheme.colorScheme.primary)
        Text(article.title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text(dateText(article.publishedAt), style = MaterialTheme.typography.bodySmall)
        Button(onClick = { open(article) }, Modifier.fillMaxWidth()) { Icon(Icons.AutoMirrored.Filled.OpenInNew, null); Spacer(Modifier.width(8.dp)); Text("配信元で記事を読む") }
        OutlinedButton(onClick = save, Modifier.fillMaxWidth()) {
            Text(if (data.saved.any { it.id == article.id }) "保存を解除" else "記事を保存")
        }
        OutlinedButton(onClick = { picker = true }, Modifier.fillMaxWidth()) { Text("手帖に追加") }
        Text("記事本文はGoogle ニュース経由で配信元のブラウザページを開きます。購読やログインが必要な場合があります。", style = MaterialTheme.typography.bodyMedium)
        FeedNotice()
    }
    if (picker) NotebookPicker(data.notebooks, { picker = false }) { id, title -> attach(article, id, title) { picker = false } }
}

@Composable
private fun NotebookPicker(notebooks: List<Notebook>, close: () -> Unit, attach: (String?, String) -> Unit) {
    var name by rememberSaveable { mutableStateOf("") }
    AlertDialog(onDismissRequest = close, title = { Text("手帖に追加") }, text = {
        Column(Modifier.heightIn(max = 460.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(name, { name = it.take(120) }, label = { Text("新しい手帖の名前") }, singleLine = true)
            Button(onClick = { attach(null, name.trim()) }, enabled = name.isNotBlank() && notebooks.size < 100) { Text("作成して記事を追加") }
            if (notebooks.isNotEmpty()) Text("既存の手帖", style = MaterialTheme.typography.titleSmall)
            notebooks.forEach { notebook ->
                TextButton(onClick = { attach(notebook.id, "") }, enabled = notebook.articles.size < 100) { Text(notebook.title) }
            }
        }
    }, confirmButton = { TextButton(onClick = close) { Text("閉じる") } })
}

@Composable
private fun Notebooks(notebooks: List<Notebook>, select: (Notebook) -> Unit, create: () -> Unit) {
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text("記事を集め、自分の考えを残す。", style = MaterialTheme.typography.headlineSmall)
            Button(onClick = create, enabled = notebooks.size < 100, modifier = Modifier.padding(vertical = 16.dp)) {
                Icon(Icons.Default.Add, null); Text("新しい手帖")
            }
        }
        if (notebooks.isEmpty()) item { EmptyMessage("まだ手帖がありません", "手帖を作成するか、記事画面から追加できます。") }
        items(notebooks, key = { it.id }) { notebook ->
            OutlinedCard(onClick = { select(notebook) }, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(notebook.title, style = MaterialTheme.typography.titleMedium)
                    Text("${notebook.articles.size}記事 ・ ${notebook.assessment}", style = MaterialTheme.typography.labelMedium)
                    if (notebook.note.isNotBlank()) Text(notebook.note, maxLines = 3)
                    Text("更新：${dateText(notebook.updatedAt)}", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NotebookEditor(original: Notebook, onClose: () -> Unit, onSave: (Notebook) -> Unit, onDelete: (String) -> Unit, onOpen: (Article) -> Unit) {
    var title by rememberSaveable(original.id) { mutableStateOf(original.title) }
    var note by rememberSaveable(original.id) { mutableStateOf(original.note) }
    var conclusion by rememberSaveable(original.id) { mutableStateOf(original.conclusion) }
    var action by rememberSaveable(original.id) { mutableStateOf(original.nextAction) }
    var review by rememberSaveable(original.id) { mutableStateOf(original.reviewDate) }
    var assessment by rememberSaveable(original.id) { mutableStateOf(original.assessment) }
    var linked by remember(original.id) { mutableStateOf(original.articles) }
    var discard by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf(false) }
    val changed = title != original.title || note != original.note || conclusion != original.conclusion || action != original.nextAction ||
        review != original.reviewDate || assessment != original.assessment || linked != original.articles
    val validDate = review.isEmpty() || runCatching { LocalDate.parse(review) }.isSuccess
    fun close() { if (changed) discard = true else onClose() }
    BackHandler { close() }
    Scaffold(topBar = {
        TopAppBar(title = { Text(if (original.title.isEmpty()) "新しい手帖" else "手帖を編集") }, navigationIcon = {
            IconButton(onClick = ::close) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "戻る") }
        }, actions = {
            TextButton(onClick = { onSave(original.copy(title = title.trim(), note = note, conclusion = conclusion, nextAction = action,
                reviewDate = review, assessment = assessment, articles = linked)) }, enabled = title.isNotBlank() && validDate) { Text("保存") }
        })
    }) { padding ->
        Column(Modifier.padding(padding).fillMaxSize().verticalScroll(rememberScrollState()).imePadding().padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)) {
            OutlinedTextField(title, { title = it.take(120) }, Modifier.fillMaxWidth(), label = { Text("手帖の名前") }, singleLine = true)
            OutlinedTextField(note, { note = it.take(20000) }, Modifier.fillMaxWidth(), label = { Text("メモ・考え") }, minLines = 4)
            OutlinedTextField(conclusion, { conclusion = it.take(10000) }, Modifier.fillMaxWidth(), label = { Text("まとめ") }, minLines = 2)
            OutlinedTextField(action, { action = it.take(10000) }, Modifier.fillMaxWidth(), label = { Text("次のアクション") }, minLines = 2)
            Text("整理の状態", style = MaterialTheme.typography.titleSmall)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("未整理", "検討中", "確認済み").forEach { value -> FilterChip(assessment == value, { assessment = value }, label = { Text(value) }) }
            }
            OutlinedTextField(review, { review = it.take(10) }, Modifier.fillMaxWidth(), label = { Text("見直し日（任意）") },
                placeholder = { Text("2026-11-15") }, supportingText = { Text(if (validDate) "年-月-日で入力してください" else "有効な日付を入力してください") },
                isError = !validDate, singleLine = true)
            SectionTitle("集めた記事（${linked.size}）")
            linked.forEach { article ->
                OutlinedCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text(article.sourceName, style = MaterialTheme.typography.labelMedium)
                        Text(article.title, fontWeight = FontWeight.SemiBold)
                        Row {
                            TextButton(onClick = { onOpen(article) }) { Text("配信元を開く") }
                            TextButton(onClick = { linked = linked.filterNot { it.id == article.id } }) { Text("手帖から外す") }
                        }
                    }
                }
            }
            if (linked.isEmpty()) Text("記事画面の「手帖に追加」から集められます。")
            if (original.title.isNotEmpty()) TextButton(onClick = { deleting = true }) { Text("手帖を削除", color = MaterialTheme.colorScheme.error) }
        }
    }
    if (discard) AlertDialog(onDismissRequest = { discard = false }, title = { Text("変更を破棄しますか？") },
        text = { Text("保存していない変更は失われます。") }, confirmButton = { TextButton(onClick = onClose) { Text("破棄") } },
        dismissButton = { TextButton(onClick = { discard = false }) { Text("編集を続ける") } })
    if (deleting) AlertDialog(onDismissRequest = { deleting = false }, title = { Text("手帖を削除しますか？") },
        text = { Text("メモと手帖内の記事リンクが削除されます。元の記事や保存記事は消えません。") },
        confirmButton = { TextButton(onClick = { onDelete(original.id) }) { Text("削除") } },
        dismissButton = { TextButton(onClick = { deleting = false }) { Text("キャンセル") } })
}

@Composable
private fun Settings(data: UserData, vm: AppViewModel, openPage: (String) -> Unit) {
    val context = LocalContext.current
    var clear by remember { mutableStateOf(false) }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        vm.reminder(granted)
        if (!granted) vm.message("通知が許可されていません。必要な場合はAndroidのアプリ設定から許可してください。")
    }
    LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { SectionTitle("配信元"); SourceChecks(data.sourceIds, vm::sources) }
        item {
            SectionTitle("毎日のリマインダー")
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("毎日の通知", Modifier.weight(1f))
                Switch(data.reminders, { enabled ->
                    if (enabled && Build.VERSION.SDK_INT >= 33 && !ReminderScheduler.permitted(context)) permission.launch(Manifest.permission.POST_NOTIFICATIONS)
                    else vm.reminder(enabled)
                })
            }
            if (data.reminders) {
                TextButton(onClick = {
                    TimePickerDialog(context, { _, hour, minute -> vm.reminder(true, hour, minute) }, data.reminderHour, data.reminderMinute, true).show()
                }) { Text("通知する時刻：%02d:%02d".format(data.reminderHour, data.reminderMinute)) }
                if (!ReminderScheduler.permitted(context)) Text("通知はAndroidの設定で許可してください。")
            }
            Text("通知は端末で予約されます。省電力設定などにより指定時刻から遅れる場合があります。ニュースはアプリを開いて更新できます。", style = MaterialTheme.typography.bodySmall)
        }
        item {
            SectionTitle("プライバシーとサポート")
            TextButton(onClick = { openPage(PRIVACY_URL) }) { Text("プライバシーポリシー") }
            TextButton(onClick = { openPage(SUPPORT_URL) }) { Text("お問い合わせ・サポート") }
            TextButton(onClick = { clear = true }, enabled = data.history.isNotEmpty()) { Text("閲覧履歴を消去") }
            Text("保存記事は最大500件、閲覧履歴は直近200件、手帖は最大100冊です。情報はこの端末に保存されます。バックアップや他端末への同期は行いません。", style = MaterialTheme.typography.bodySmall)
        }
        item { SectionTitle("ニュースの配信について"); FeedNotice() }
        item { Text("日本ニュース手帖 1.0\n表示言語：日本語", style = MaterialTheme.typography.bodySmall) }
    }
    if (clear) AlertDialog(onDismissRequest = { clear = false }, title = { Text("閲覧履歴を消去しますか？") },
        text = { Text("保存記事と手帖はそのまま残ります。") },
        confirmButton = { TextButton(onClick = { vm.clearHistory(); clear = false }) { Text("消去") } },
        dismissButton = { TextButton(onClick = { clear = false }) { Text("キャンセル") } })
}

@Composable
private fun FeedNotice() {
    Text("Google ニュースの公開RSSから見出し・配信元・公開日時・リンクを取得します。本文・写真は配信元でご覧ください。各媒体とは提携していません。\n\n個人の非商用利用に限ります。ニュース結果の商用利用や再配信はできません。記事を開くと、各サイトのプライバシーポリシーが適用されます。", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
}
@Composable
private fun SectionTitle(text: String) { Text(text, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, modifier = Modifier.semantics { heading() }) }
@Composable
private fun EmptyMessage(title: String, body: String) {
    Column(Modifier.fillMaxWidth().padding(vertical = 28.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium); Text(body, style = MaterialTheme.typography.bodyMedium)
    }
}
