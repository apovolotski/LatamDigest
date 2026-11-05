package com.apovolotski.japandigest

import android.content.Context
import android.util.AtomicFile
import androidx.test.core.app.ApplicationProvider
import java.io.File
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class StorageTest {
    @Test fun japaneseNotebooksAndLibraryRoundTripWithoutSecretsOrCloudState() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val file = File(context.cacheDir, "test-notebooks.json")
        val article = Article("日本の経済ニュース", "https://news.google.com/rss/articles/valid", "NH", "NHKニュース", System.currentTimeMillis())
        val data = UserData(onboarded = true, saved = listOf(article), history = listOf(article),
            notebooks = listOf(Notebook("notebook-1", "今週の経済", note = "自分の考え", conclusion = "比較して読む", articles = listOf(article))))
        atomicWrite(file, Json.encodeToString(data))
        val decoded = AtomicFile(file).openRead().use { Json.decodeFromString<UserData>(it.readBytes().toString(Charsets.UTF_8)) }.validated()
        assertEquals(data, decoded)
        assertFalse(decoded.reminders)
        assertEquals(listOf(article), decoded.notebooks.single().articles)
    }
    @Test fun failedAtomicUpdatePreservesPreviouslyCommittedNotes() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val file = File(context.cacheDir, "test-atomic.json")
        atomicWrite(file, "previous notes")
        val atomic = AtomicFile(file)
        val output = atomic.startWrite()
        output.write("incomplete update".toByteArray())
        atomic.failWrite(output)
        assertEquals("previous notes", atomic.openRead().use { it.readBytes().toString(Charsets.UTF_8) })
    }
}
