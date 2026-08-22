package com.rajarsheechatterjee.LNReader

import android.content.Intent
import android.speech.tts.TextToSpeech
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.MockedConstruction
import org.mockito.Mockito.mockConstruction
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Tests for notification update throttling in TTSForegroundService.
 *
 * The service uses a 500ms throttle to prevent notification flicker during
 * rapid paragraph updates. Only high-priority changes (chapter, play state)
 * bypass the throttle.
 *
 * Uses Robolectric.buildService() for proper Android lifecycle and
 * mockConstruction to intercept TTS engine binding.
 */
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [28])
class TTSNotificationRedrawTest {

    private lateinit var closeable: MockedConstruction<TextToSpeech>
    private lateinit var controller: org.robolectric.android.controller.ServiceController<TTSForegroundService>

    @Before
    fun setUp() {
        closeable = mockConstruction(TextToSpeech::class.java)

        controller = Robolectric.buildService(TTSForegroundService::class.java, Intent())
        val service = controller.get()
        controller.create()

        // Enable TTS bypass
        val initField = TTSForegroundService::class.java.getDeclaredField("isTtsInitialized")
        initField.isAccessible = true
        initField.setBoolean(service, true)

        // Enable foreground state so updateNotification() actually executes
        val foregroundField = TTSForegroundService::class.java.getDeclaredField("isServiceForeground")
        foregroundField.isAccessible = true
        foregroundField.setBoolean(service, true)
    }

    @After
    fun tearDown() {
        closeable.close()
        controller.destroy()
    }

    @Test
    fun testNotificationNotRedrawOnParagraphChange() {
        val service = controller.get()
        service.resetNotificationTracking()

        // Initial state
        service.updateMediaState(
            novelName = "Test Novel",
            chapterLabel = "Chapter 1",
            chapterId = 1,
            paragraphIndex = 0,
            totalParagraphs = 100,
            isPlaying = true
        )
        val callsAfterInitial = service.notificationUpdateCount

        // Update only paragraph index (within 500ms throttle window)
        service.updateMediaState(
            novelName = "Test Novel",
            chapterLabel = "Chapter 1",
            chapterId = 1,
            paragraphIndex = 5,
            totalParagraphs = 100,
            isPlaying = true
        )

        // Paragraph-only update should be throttled
        assert(service.notificationUpdateCount == callsAfterInitial) {
            "Notification should not redraw for paragraph-only change, " +
                "but count went from $callsAfterInitial to ${service.notificationUpdateCount}"
        }
    }

    @Test
    fun testNotificationRedrawOnPlayStateChange() {
        val service = controller.get()
        service.resetNotificationTracking()

        service.updateMediaState(
            novelName = "Test Novel",
            chapterLabel = "Chapter 1",
            chapterId = 1,
            paragraphIndex = 0,
            totalParagraphs = 100,
            isPlaying = true
        )
        val callsBefore = service.notificationUpdateCount

        // Change play state — high-priority, bypasses throttle
        service.updateMediaState(
            novelName = "Test Novel",
            chapterLabel = "Chapter 1",
            chapterId = 1,
            paragraphIndex = 0,
            totalParagraphs = 100,
            isPlaying = false
        )

        assert(service.notificationUpdateCount > callsBefore) {
            "Notification should redraw when play state changes"
        }
    }

    @Test
    fun testNotificationRedrawOnChapterChange() {
        val service = controller.get()
        service.resetNotificationTracking()

        service.updateMediaState(
            novelName = "Test Novel",
            chapterLabel = "Chapter 1",
            chapterId = 1,
            paragraphIndex = 0,
            totalParagraphs = 100,
            isPlaying = true
        )
        val callsBefore = service.notificationUpdateCount

        // Change chapter — high-priority
        service.updateMediaState(
            novelName = "Test Novel",
            chapterLabel = "Chapter 2",
            chapterId = 2,
            paragraphIndex = 0,
            totalParagraphs = 120,
            isPlaying = true
        )

        assert(service.notificationUpdateCount > callsBefore) {
            "Notification should redraw when chapter changes"
        }
    }

    @Test
    fun testMultipleParagraphUpdatesNoRedraws() {
        val service = controller.get()
        service.resetNotificationTracking()

        service.updateMediaState(
            novelName = "Test Novel",
            chapterLabel = "Chapter 1",
            chapterId = 1,
            paragraphIndex = 0,
            totalParagraphs = 100,
            isPlaying = true
        )
        val callsBefore = service.notificationUpdateCount

        // Simulate rapid paragraph updates (all within 500ms throttle)
        for (i in 1..10) {
            service.updateMediaState(
                novelName = "Test Novel",
                chapterLabel = "Chapter 1",
                chapterId = 1,
                paragraphIndex = i,
                totalParagraphs = 100,
                isPlaying = true
            )
        }

        assert(service.notificationUpdateCount == callsBefore) {
            "Notification should not redraw 10 times for paragraph updates, " +
                "count went from $callsBefore to ${service.notificationUpdateCount}"
        }
    }

    @Test
    fun testProgressTextUpdatesCorrectly() {
        val service = controller.get()

        service.updateMediaState(
            novelName = "Test Novel",
            chapterLabel = "Chapter 1",
            chapterId = 1,
            paragraphIndex = 0,
            totalParagraphs = 100,
            isPlaying = true
        )
        val progress0 = service.getCurrentProgressText()
        assert(progress0.contains("1%")) { "Paragraph 0 should show 1% (1/100), got: $progress0" }

        service.updateMediaState(
            novelName = "Test Novel",
            chapterLabel = "Chapter 1",
            chapterId = 1,
            paragraphIndex = 49,
            totalParagraphs = 100,
            isPlaying = true
        )
        val progress50 = service.getCurrentProgressText()
        assert(progress50.contains("50%")) { "Paragraph 49 should show 50% (50/100), got: $progress50" }
    }
}
