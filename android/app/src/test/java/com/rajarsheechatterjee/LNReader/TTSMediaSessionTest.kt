package com.rajarsheechatterjee.LNReader

import android.content.Intent
import android.media.AudioManager
import android.support.v4.media.session.PlaybackStateCompat
import android.view.KeyEvent
import android.speech.tts.TextToSpeech
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mock
import org.mockito.Mockito.*
import org.mockito.MockedConstruction
import org.mockito.Mockito.mockConstruction
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Tests for MediaSession and AudioFocus behavior in TTSForegroundService.
 *
 * Uses Robolectric.buildService() for proper Android lifecycle (base context,
 * notification channel, etc.) and mockConstruction to intercept TTS engine binding.
 */
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [28])
class TTSMediaSessionTest {

    @Mock
    private lateinit var mockAudioManager: AudioManager

    private lateinit var closeable: MockedConstruction<TextToSpeech>
    private lateinit var controller: org.robolectric.android.controller.ServiceController<TTSForegroundService>

    @Before
    fun setUp() {
        org.mockito.MockitoAnnotations.openMocks(this)

        // Intercept TextToSpeech construction to prevent TTS engine binding
        closeable = mockConstruction(TextToSpeech::class.java)

        // Use Robolectric to properly create the service with a base context
        controller = Robolectric.buildService(TTSForegroundService::class.java, Intent())
        val service = controller.get()

        val listenerMock = mock(TTSForegroundService.TTSListener::class.java)
        service.setTTSListener(listenerMock)

        // Trigger onCreate — creates MediaSession, AudioManager, notification channel
        controller.create()

        // Inject mock AudioManager
        val audioField = TTSForegroundService::class.java.getDeclaredField("audioManager")
        audioField.isAccessible = true
        audioField.set(service, mockAudioManager)

        // Manually enable TTS
        val initField = TTSForegroundService::class.java.getDeclaredField("isTtsInitialized")
        initField.isAccessible = true
        initField.setBoolean(service, true)
    }

    @After
    fun tearDown() {
        closeable.close()
        controller.destroy()
    }

    @Test
    fun testMediaSessionCreatedOnServiceStart() {
        val service = controller.get()
        val mediaSession = service.getMediaSession()
        assert(mediaSession != null) { "MediaSession should be created" }
        assert(mediaSession?.isActive == true) { "MediaSession should be active" }
    }

    @Test
    fun testMediaSessionPlaybackStateSync() {
        val service = controller.get()
        val listener = mock(TTSForegroundService.TTSListener::class.java)
        service.setTTSListener(listener)

        // Update to playing state
        service.updateMediaState(
            novelName = "Test Novel",
            chapterLabel = "Chapter 1",
            chapterId = 1,
            paragraphIndex = 10,
            totalParagraphs = 100,
            isPlaying = true
        )

        val playbackState = service.getMediaSession()?.controller?.playbackState
        assert(playbackState?.state == PlaybackStateCompat.STATE_PLAYING) {
            "PlaybackState should be PLAYING, got ${playbackState?.state}"
        }
        assert(playbackState?.position == 10_000L) {
            "Position should be 10000ms (paragraph 10 * 1000), got ${playbackState?.position}"
        }

        // Update to paused state
        service.updateMediaState(
            novelName = "Test Novel",
            chapterLabel = "Chapter 1",
            chapterId = 1,
            paragraphIndex = 20,
            totalParagraphs = 100,
            isPlaying = false
        )

        val pausedState = service.getMediaSession()?.controller?.playbackState
        assert(pausedState?.state == PlaybackStateCompat.STATE_PAUSED) {
            "PlaybackState should be PAUSED, got ${pausedState?.state}"
        }
    }

    @Test
    fun testMediaSessionCallbacksRouteToListener() {
        val service = controller.get()
        val listener = mock(TTSForegroundService.TTSListener::class.java)
        service.setTTSListener(listener)

        // Exercise the service's public media-action dispatch path used by
        // notification and hardware media-button intents.
        fun sendAction(action: String) {
            service.onStartCommand(Intent(action), 0, 1)
        }

        sendAction(TTSForegroundService.ACTION_MEDIA_PLAY_PAUSE)
        verify(listener).onMediaAction(TTSForegroundService.ACTION_MEDIA_PLAY_PAUSE)

        sendAction(TTSForegroundService.ACTION_MEDIA_NEXT_CHAPTER)
        verify(listener).onMediaAction(TTSForegroundService.ACTION_MEDIA_NEXT_CHAPTER)

        sendAction(TTSForegroundService.ACTION_MEDIA_PREV_CHAPTER)
        verify(listener).onMediaAction(TTSForegroundService.ACTION_MEDIA_PREV_CHAPTER)

        sendAction(TTSForegroundService.ACTION_MEDIA_SEEK_FORWARD)
        verify(listener).onMediaAction(TTSForegroundService.ACTION_MEDIA_SEEK_FORWARD)

        sendAction(TTSForegroundService.ACTION_MEDIA_SEEK_BACK)
        verify(listener).onMediaAction(TTSForegroundService.ACTION_MEDIA_SEEK_BACK)
    }

    @Test
    fun testAudioFocusRequestedOnPlay() {
        val service = controller.get()
        val listener = mock(TTSForegroundService.TTSListener::class.java)
        service.setTTSListener(listener)

        // speak() calls requestAudioFocus() internally
        service.speak("Test text", "utterance_1", 1.0f, 1.0f, null)

        // SDK 28 uses AudioFocusRequest API (3-arg overload is pre-O)
        verify(mockAudioManager, timeout(1000)).requestAudioFocus(any())
    }

    @Test
    fun testAudioFocusAbandonedOnStop() {
        val service = controller.get()
        val listener = mock(TTSForegroundService.TTSListener::class.java)
        service.setTTSListener(listener)

        service.speak("Test text", "utterance_1", 1.0f, 1.0f, null)
        service.stopTTS()

        // stopTTS() calls abandonAudioFocusRequest() on SDK >= O
        verify(mockAudioManager, timeout(1000)).abandonAudioFocusRequest(any())
    }
}
