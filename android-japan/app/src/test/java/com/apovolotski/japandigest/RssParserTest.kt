package com.apovolotski.japandigest

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class RssParserTest {
    private val source = NewsSource.all.first()
    private val now = Instant.parse("2026-11-05T12:00:00Z").toEpochMilli()
    private fun item(title: String = "日本の経済とAIのニュース", link: String = "https://news.google.com/rss/articles/test123",
                     attribution: String = "https://news.web.nhk", date: String = "Thu, 5 Nov 2026 10:00:00 GMT") =
        """<item><title>$title</title><link>$link</link><pubDate>$date</pubDate><source url="$attribution">NHKニュース</source><description>DO NOT RETAIN</description></item>"""
    private fun parse(items: String) = RssParser().parse("<rss><channel>$items</channel></rss>".toByteArray(), source, now)

    @Test fun acceptsJapaneseMetadataDeduplicatesAndKeepsStableIdentity() {
        val articles = parse(item() + item())
        assertEquals(1, articles.size)
        assertEquals("NH", articles.single().sourceId)
        assertEquals(64, articles.single().id.length)
        assertEquals(articles.single().id, parse(item()).single().id)
        assertFalse(articles.toString().contains("DO NOT RETAIN"))
    }
    @Test fun rejectsUnsafeLinksAndPublisherImpersonation() {
        for (url in listOf("http://news.google.com/rss/articles/a", "https://news.google.com.evil.example/rss/articles/a",
            "https://user@news.google.com/rss/articles/a", "https://news.google.com:8443/rss/articles/a", "javascript:alert(1)", "https://news.google.com/search/a")) {
            assertTrue(parse(item(link = url)).isEmpty())
        }
        for (domain in listOf("https://news.web.nhk.evil.example", "http://news.web.nhk", "https://user@news.web.nhk", "https://asahi.com"))
            assertTrue(parse(item(attribution = domain)).isEmpty())
    }
    @Test fun rejectsOldFutureNonJapaneseAndMalformedDates() {
        assertTrue(parse(item(date = "Thu, 1 Oct 2026 10:00:00 GMT")).isEmpty())
        assertTrue(parse(item(date = "Thu, 5 Nov 2026 18:00:00 GMT")).isEmpty())
        assertTrue(parse(item(date = "invalid")).isEmpty())
        assertTrue(parse(item(title = "English news only")).isEmpty())
    }
    @Test fun rejectsDtdEntitiesWrongRootAndOversizedData() {
        val invalid = listOf("<!DOCTYPE rss [<!ENTITY x SYSTEM 'file:///etc/passwd'>]><rss/>", "<html/>", "<rss><channel>")
        invalid.forEach { xml -> assertTrue(runCatching { RssParser().parse(xml.toByteArray(), source, now) }.isFailure) }
        assertTrue(runCatching { RssParser().parse(ByteArray(2_000_001), source, now) }.isFailure)
    }
    @Test fun enforcesSixtyArticleLimitAndDescendingDates() {
        val articles = parse((1..65).joinToString("") { item(link = "https://news.google.com/rss/articles/$it") })
        assertEquals(60, articles.size)
        assertEquals(articles.sortedByDescending { it.publishedAt }, articles)
    }
    @Test fun normalizesWidthAndMatchesAsciiTopicsWithoutSubstringFalsePositive() {
        val article = parse(item()).single()
        assertTrue(article.matches("ａｉ"))
        assertTrue(article.matches("ＮＨＫ"))
        assertTrue(NewsTopic.TECHNOLOGY.matches(article))
        assertFalse(NewsTopic.TECHNOLOGY.matches(article.copy(title = "日本のdaily生活")))
    }
    @Test fun validatesPersistedDataAndPersonalLimits() {
        val article = parse(item()).single()
        assertEquals(UserData(), UserData().validated())
        assertTrue(runCatching { UserData(saved = listOf(article.copy(url = "file:///etc/passwd"))).validated() }.isFailure)
        assertTrue(runCatching { UserData(sourceIds = setOf("XX")).validated() }.isFailure)
        assertTrue(runCatching { UserData(reminderHour = 24).validated() }.isFailure)
        assertTrue(runCatching { UserData(schema = 99).validated() }.isFailure)
        assertTrue(runCatching { UserData(notebooks = listOf(Notebook("1", "メモ", reviewDate = "2026-02-30"))).validated() }.isFailure)
    }
    @Test fun buildsJapaneseSourceBoundedQueries() {
        NewsSource.all.forEach { source ->
            val decoded = java.net.URLDecoder.decode(source.feedUrl(), "UTF-8")
            assertTrue(decoded.startsWith("https://news.google.com/rss/search?"))
            assertTrue(decoded.contains("site:${source.domain} when:7d"))
            assertTrue(decoded.contains("hl=ja&gl=JP&ceid=JP:ja"))
        }
    }
}
