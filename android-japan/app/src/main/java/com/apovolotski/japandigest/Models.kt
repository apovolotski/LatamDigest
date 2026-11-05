package com.apovolotski.japandigest

import java.net.URI
import java.net.URLEncoder
import java.security.MessageDigest
import java.text.Normalizer
import java.time.Instant
import java.util.Locale
import kotlinx.serialization.Serializable

const val WEEK_MS = 7L * 24 * 60 * 60 * 1000
const val PRIVACY_URL = "https://apovolotski.github.io/LatamDigest/japan/android-privacy.html"
const val SUPPORT_URL = "https://apovolotski.github.io/LatamDigest/japan/android-support.html"

data class NewsSource(val id: String, val name: String, val domain: String) {
    fun feedUrl(): String = "https://news.google.com/rss/search?q=" +
        URLEncoder.encode("site:$domain when:7d", "UTF-8") + "&hl=ja&gl=JP&ceid=JP%3Aja"
    companion object {
        val all = listOf(
            NewsSource("NH", "NHKニュース", "news.web.nhk"),
            NewsSource("AS", "朝日新聞", "asahi.com"),
            NewsSource("MA", "毎日新聞", "mainichi.jp"),
            NewsSource("YO", "読売新聞", "yomiuri.co.jp"),
            NewsSource("NI", "日本経済新聞", "nikkei.com"),
            NewsSource("KY", "47NEWS", "47news.jp")
        )
    }
}

@Serializable
data class Article(val title: String, val url: String, val sourceId: String, val sourceName: String, val publishedAt: Long) {
    val id: String get() = MessageDigest.getInstance("SHA-256").digest(url.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }
    fun matches(query: String): Boolean = normalize("$title $sourceName").contains(normalize(query.trim()))
    fun isSafe(): Boolean = title.isNotBlank() && title.length <= 1000 && sourceName.isNotBlank() &&
        sourceName.length <= 200 && NewsSource.all.any { it.id == sourceId } && safeArticleUrl(url) && publishedAt > 0
}

fun normalize(text: String): String = Normalizer.normalize(text, Normalizer.Form.NFKC).lowercase(Locale.JAPANESE)
fun safeArticleUrl(text: String): Boolean = runCatching {
    val uri = URI(text)
    uri.scheme == "https" && uri.host == "news.google.com" && uri.rawUserInfo == null &&
        (uri.port == -1 || uri.port == 443) && uri.path.startsWith("/rss/articles/") &&
        uri.path.length > "/rss/articles/".length && text.length <= 4096
}.getOrDefault(false)

@Serializable
data class Notebook(
    val id: String,
    val title: String,
    val note: String = "",
    val conclusion: String = "",
    val nextAction: String = "",
    val reviewDate: String = "",
    val assessment: String = "検討中",
    val articles: List<Article> = emptyList(),
    val updatedAt: Long = Instant.now().toEpochMilli()
)

@Serializable
data class FeedCache(val sourceId: String, val fetchedAt: Long, val articles: List<Article>)

@Serializable
data class UserData(
    val schema: Int = 1,
    val onboarded: Boolean = false,
    val sourceIds: Set<String> = NewsSource.all.map { it.id }.toSet(),
    val saved: List<Article> = emptyList(),
    val history: List<Article> = emptyList(),
    val notebooks: List<Notebook> = emptyList(),
    val reminders: Boolean = false,
    val reminderHour: Int = 7,
    val reminderMinute: Int = 30
) {
    fun validated(): UserData {
        require(schema == 1) { "Unsupported local data version" }
        require(reminderHour in 0..23 && reminderMinute in 0..59)
        require(saved.size <= 500 && history.size <= 200 && notebooks.size <= 100)
        require((saved + history + notebooks.flatMap { it.articles }).all { it.isSafe() })
        require(notebooks.all {
            it.title.isNotBlank() && it.title.length <= 120 && it.note.length <= 20000 &&
                it.conclusion.length <= 10000 && it.nextAction.length <= 10000 && it.articles.size <= 100 &&
                it.assessment in listOf("未整理", "検討中", "確認済み") &&
                (it.reviewDate.isEmpty() || runCatching { java.time.LocalDate.parse(it.reviewDate) }.isSuccess)
        })
        require(sourceIds.all { id -> NewsSource.all.any { it.id == id } })
        return this
    }
}

enum class NewsTopic(val title: String, private val keywords: List<String>) {
    POLITICS("政治・外交", listOf("政治", "選挙", "国会", "首相", "内閣", "衆院", "参院", "自民", "政党", "外交", "大統領")),
    ECONOMY("経済", listOf("経済", "物価", "金利", "日銀", "為替", "円安", "円高", "景気", "インフレ", "gdp", "財政", "関税", "貿易")),
    BUSINESS("ビジネス", listOf("企業", "会社", "業績", "決算", "投資", "株式", "市場", "買収", "銀行", "メーカー", "小売", "経営")),
    SAFETY("社会・防災", listOf("事件", "逮捕", "警察", "裁判", "犯罪", "事故", "地震", "台風", "災害", "避難", "大雨", "防災")),
    TECHNOLOGY("テクノロジー", listOf("技術", "半導体", "人工知能", "ai", "デジタル", "ソフト", "通信", "ロボット", "宇宙", "サイバー", "データ")),
    CULTURE("文化", listOf("文化", "映画", "音楽", "美術", "芸術", "アニメ", "出版", "書籍", "博物館", "文学")),
    SPORTS("スポーツ", listOf("スポーツ", "野球", "サッカー", "大谷", "五輪", "オリンピック", "試合", "優勝", "選手", "リーグ")),
    HEALTH("健康・医療", listOf("健康", "医療", "病院", "感染", "ワクチン", "ウイルス", "介護", "福祉", "治療")),
    ENERGY("エネルギー", listOf("エネルギー", "電力", "原発", "再生可能", "石油", "ガス", "太陽光", "脱炭素", "資源")),
    WORK("働き方", listOf("労働", "雇用", "賃金", "給与", "働き方", "人手", "採用", "労組", "春闘", "仕事"));

    fun matches(article: Article): Boolean {
        val title = normalize(article.title)
        return keywords.any { keyword ->
            if (keyword.all { it in 'a'..'z' }) Regex("(?<![a-z0-9])${Regex.escape(keyword)}(?![a-z0-9])").containsMatchIn(title)
            else title.contains(keyword)
        }
    }
}
