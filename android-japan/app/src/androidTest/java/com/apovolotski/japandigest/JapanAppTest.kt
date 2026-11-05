package com.apovolotski.japandigest

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import android.graphics.Bitmap
import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class JapanAppTest {
    @get:Rule val app = createAndroidComposeRule<MainActivity>()

    private fun capture(name: String) {
        app.waitForIdle()
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "screenshots").apply { mkdirs() }
        instrumentation.uiAutomation.takeScreenshot().let { bitmap ->
            File(directory, "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
            bitmap.recycle()
        }
    }

    @Test fun japaneseNavigationNotebookAndRotationPersistence() {
        app.waitUntil(15000) { app.onAllNodesWithText("はじめる").fetchSemanticsNodes().isNotEmpty() || app.onAllNodesWithText("新着").fetchSemanticsNodes().isNotEmpty() }
        if (app.onAllNodesWithText("はじめる").fetchSemanticsNodes().isNotEmpty()) {
            capture("01-onboarding")
            app.onNodeWithText("はじめる").performClick()
        }
        app.waitUntil(15000) { app.onAllNodesWithTag("tab-0").fetchSemanticsNodes().isNotEmpty() }
        app.onNodeWithText("新着").assertExists()
        app.waitUntil(60000) { app.onAllNodesWithTag("news-loading").fetchSemanticsNodes().isEmpty() }
        capture("02-news")
        assertTrue("Live Japanese headlines must load", app.onAllNodesWithTag("headline-card").fetchSemanticsNodes().isNotEmpty())
        app.onNodeWithTag("tab-1").performClick()
        app.onNodeWithText("政治・外交").assertExists()
        capture("03-topics")
        app.onNodeWithTag("tab-2").performClick()
        app.onNodeWithText("保存した記事（0）").assertExists()
        app.onNodeWithTag("tab-3").performClick()
        app.onNodeWithText("新しい手帖").performClick()
        app.onNodeWithText("手帖の名前").performTextInput("日本のニュースを考える")
        app.onNodeWithText("メモ・考え").performTextInput("複数の配信元を読み比べる")
        app.onNodeWithText("保存", useUnmergedTree = true).performClick()
        app.waitUntil(10000) { app.onAllNodesWithText("日本のニュースを考える").fetchSemanticsNodes().isNotEmpty() }
        app.activityRule.scenario.recreate()
        app.waitUntil(15000) { app.onAllNodesWithText("手帖").fetchSemanticsNodes().isNotEmpty() }
        app.onNodeWithTag("tab-3").performClick()
        app.onNodeWithText("日本のニュースを考える").assertExists()
        app.onNodeWithText("複数の配信元を読み比べる").assertExists()
        capture("04-notebooks")
        app.onNodeWithContentDescription("設定").performClick()
        app.onNodeWithText("毎日の通知").assertExists()
        app.onAllNodes(isToggleable()).filterToOne(hasAnySibling(hasText("毎日の通知"))).assertIsOff()
    }
}
