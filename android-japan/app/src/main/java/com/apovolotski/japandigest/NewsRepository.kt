package com.apovolotski.japandigest

import java.io.ByteArrayInputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.xml.parsers.SAXParserFactory
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.xml.sax.Attributes
import org.xml.sax.InputSource
import org.xml.sax.SAXException
import org.xml.sax.helpers.DefaultHandler
import kotlin.coroutines.coroutineContext

/** Strictly parses headline metadata. No descriptions, article bodies, logos or images. */
class RssParser {
    fun parse(data: ByteArray, source: NewsSource, now: Long = System.currentTimeMillis()): List<Article> {
        require(data.size <= 2_000_000) { "Feed too large" }
        val xml = Charsets.UTF_8.newDecoder().onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
            .decode(java.nio.ByteBuffer.wrap(data)).toString()
        require(!xml.contains('\u0000') && !xml.contains("<!DOCTYPE", true) && !xml.contains("<!ENTITY", true)) { "DTD forbidden" }
        val factory = SAXParserFactory.newInstance()
        factory.isNamespaceAware = false
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false)
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false)
        val handler = object : DefaultHandler() {
            var rss = false
            var depth = 0
            var itemDepth = -1
            var element = ""
            var sourceUrl = ""
            var itemCount = 0
            val values = mutableMapOf<String, StringBuilder>()
            val items = mutableListOf<Article>()
            override fun resolveEntity(publicId: String?, systemId: String?): InputSource = throw SAXException("External entity forbidden")
            override fun startElement(uri: String?, localName: String?, qName: String, attributes: Attributes) {
                depth++
                if (depth > 32) throw SAXException("Feed nesting too deep")
                if (depth == 1 && qName == "rss") rss = true
                if (qName == "item") {
                    if (++itemCount > 1000 || itemDepth != -1) throw SAXException("Invalid feed items")
                    itemDepth = depth; values.clear(); sourceUrl = ""
                }
                element = if (itemDepth > 0 && depth == itemDepth + 1) qName else ""
                if (element == "source") sourceUrl = attributes.getValue("url") ?: ""
            }
            override fun characters(ch: CharArray, start: Int, length: Int) {
                if (element in setOf("title", "link", "pubDate", "source")) {
                    val value = values.getOrPut(element) { StringBuilder() }
                    if (value.length + length > 8192) throw SAXException("Field too long")
                    value.append(ch, start, length)
                }
            }
            override fun endElement(uri: String?, localName: String?, qName: String) {
                if (qName == "item" && depth == itemDepth) {
                    buildArticle(values.mapValues { it.value.toString().trim() }, sourceUrl, source, now)?.let(items::add)
                    itemDepth = -1
                }
                element = ""; depth--
            }
        }
        factory.newSAXParser().parse(ByteArrayInputStream(data), handler)
        require(handler.rss) { "Not RSS" }
        return handler.items.distinctBy { it.id }.sortedByDescending { it.publishedAt }.take(60)
    }

    private fun buildArticle(values: Map<String, String>, attribution: String, source: NewsSource, now: Long): Article? {
        val title = values["title"] ?: return null
        val sourceName = values["source"] ?: return null
        val url = values["link"] ?: return null
        if (title.none { it.code in 0x3040..0x30ff || it.code in 0x3400..0x9fff }) return null
        val attributed = runCatching { java.net.URI(attribution) }.getOrNull() ?: return null
        val host = attributed.host?.lowercase(Locale.ROOT) ?: return null
        if (attributed.scheme != "https" || attributed.userInfo != null ||
            (attributed.port != -1 && attributed.port != 443) ||
            (host != source.domain && !host.endsWith(".${source.domain}"))) return null
        val date = runCatching { ZonedDateTime.parse(values["pubDate"], DateTimeFormatter.RFC_1123_DATE_TIME).toInstant().toEpochMilli() }.getOrNull() ?: return null
        if (date > now + 3600000 || date < now - WEEK_MS) return null
        return Article(title, url, source.id, sourceName, date).takeIf { it.isSafe() }
    }
}

data class NewsResult(val articles: List<Article>, val cached: List<String>, val unavailable: List<String>, val fetchedAt: Long?)

class NewsRepository(private val directory: File) {
    private val json = Json { ignoreUnknownKeys = true }
    private val cacheMutex = Mutex()

    suspend fun load(sourceIds: Set<String>): NewsResult = coroutineScope {
        val results = NewsSource.all.filter { it.id in sourceIds }.map { source -> async(Dispatchers.IO) {
            try {
                val bytes = download(source.feedUrl())
                coroutineContext.ensureActive()
                val now = System.currentTimeMillis()
                val articles = RssParser().parse(bytes, source, now)
                // A structurally valid but empty result can still be a temporary upstream failure.
                require(articles.isNotEmpty()) { "Empty feed" }
                cacheMutex.withLock {
                    atomicWrite(File(directory, "${source.id}.json"), json.encodeToString(FeedCache(source.id, now, articles)))
                }
                SourceResult(source.id, articles, now, false, false)
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) {
                val now = System.currentTimeMillis()
                val cache = cacheMutex.withLock {
                    runCatching {
                        val file = File(directory, "${source.id}.json")
                        val text = android.util.AtomicFile(file).openRead().use { input ->
                            require(input.channel.size() <= 2_000_000)
                            input.readBytes().toString(Charsets.UTF_8)
                        }
                        json.decodeFromString<FeedCache>(text).takeIf {
                            it.sourceId == source.id && it.fetchedAt <= now + 3600000 && now - it.fetchedAt <= WEEK_MS &&
                                it.articles.size <= 60 && it.articles.all { article -> article.isSafe() && article.sourceId == source.id }
                        }
                    }.getOrNull()
                }
                val articles = cache?.articles.orEmpty().filter { it.publishedAt in (now - WEEK_MS)..(now + 3600000) }
                SourceResult(source.id, articles, cache?.fetchedAt, articles.isNotEmpty(), true)
            }
        } }.awaitAll()
        NewsResult(results.flatMap { it.articles }.distinctBy { it.id }.sortedByDescending { it.publishedAt },
            results.filter { it.cached }.map { it.id }, results.filter { it.unavailable }.map { it.id },
            results.mapNotNull { it.fetchedAt }.minOrNull())
    }

    private data class SourceResult(val id: String, val articles: List<Article>, val fetchedAt: Long?, val cached: Boolean, val unavailable: Boolean)

    private suspend fun download(url: String): ByteArray = withContext(Dispatchers.IO) {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = 12000
        connection.readTimeout = 12000
        connection.instanceFollowRedirects = false
        connection.setRequestProperty("Accept", "application/rss+xml, application/xml, text/xml")
        connection.setRequestProperty("User-Agent", "JapanNewsNotebook/1.0")
        try {
            require(connection.responseCode == 200) { "Feed unavailable" }
            require(connection.contentLengthLong <= 2_000_000) { "Feed too large" }
            connection.inputStream.use { input ->
                val output = java.io.ByteArrayOutputStream()
                val buffer = ByteArray(8192)
                while (true) {
                    coroutineContext.ensureActive()
                    val count = input.read(buffer)
                    if (count < 0) break
                    require(output.size() + count <= 2_000_000) { "Feed too large" }
                    output.write(buffer, 0, count)
                }
                output.toByteArray()
            }
        } finally { connection.disconnect() }
    }
}

internal fun atomicWrite(file: File, value: String) {
    file.parentFile?.mkdirs()
    val atomic = android.util.AtomicFile(file)
    val output = atomic.startWrite()
    try { output.write(value.toByteArray(Charsets.UTF_8)); atomic.finishWrite(output) }
    catch (failure: Exception) { atomic.failWrite(output); throw failure }
}
