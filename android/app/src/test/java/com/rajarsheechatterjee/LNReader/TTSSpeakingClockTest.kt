package com.rajarsheechatterjee.LNReader

import android.content.Intent
import android.os.SystemClock
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.MockedConstruction
import org.mockito.Mockito.mockConstruction
import org.mockito.Mockito.mockingDetails
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Tests for the native speaking-time clock in TTSForegroundService.
 *
 * The RN reading-time tracker tops up background listening time from this
 * clock (see useTimeTracking.ts), because JS timers freeze under Doze while
 * the service keeps speaking. Only utterance-active time may count: segments
 * open on onStart and close when the queue drains or playback stops/pauses.
 */
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [28])
class TTSSpeakingClockTest {

    private lateinit var closeable: MockedConstruction<TextToSpeech>
    private lateinit var controller: org.robolectric.android.controller.ServiceController<TTSForegroundService>
    private lateinit var listener: UtteranceProgressListener

    private fun service(): TTSForegroundService = controller.get()

    private fun getSegmentStart(): Long? {
        val field = TTSForegroundService::class.java.getDeclaredField("speakingSegmentStartMs")
        field.isAccessible = true
        return field.get(service()) as Long?
    }

    private fun setSegmentStart(value: Long) {
        val field = TTSForegroundService::class.java.getDeclaredField("speakingSegmentStartMs")
        field.isAccessible = true
        field.set(service(), value)
    }

    private fun getAccumulated(): Long {
        val field = TTSForegroundService::class.java.getDeclaredField("spokenAccumulatedMs")
        field.isAccessible = true
        return field.getLong(service())
    }

    @Before
    fun setUp() {
        closeable = mockConstruction(TextToSpeech::class.java)

        controller = Robolectric.buildService(TTSForegroundService::class.java, Intent())
        controller.create()
        val service = controller.get()
        service.onInit(TextToSpeech.SUCCESS)

        // Capture the UtteranceProgressListener the service registered on the TTS mock.
        val ttsMock = closeable.constructed().first()
        val registration = mockingDetails(ttsMock).invocations.first {
            it.method.name == "setOnUtteranceProgressListener"
        }
        listener = registration.arguments[0] as UtteranceProgressListener
    }

    @After
    fun tearDown() {
        closeable.close()
        controller.destroy()
    }

    @Test
    fun testSegmentOpensOnStartAndClosesOnDrainedDone() {
        assert(getSegmentStart() == null)
        assert(service().getSpokenPlaybackMs() == 0L)

        listener.onStart("u1")
        assert(getSegmentStart() != null)
        assert(service().isSpeakingActive())

        // Backdate the segment start, then drain: accumulated time must reflect it.
        setSegmentStart(SystemClock.elapsedRealtime() - 5000)
        assert(service().getSpokenPlaybackMs() >= 5000)

        listener.onDone("u1")
        assert(getSegmentStart() == null)
        assert(!service().isSpeakingActive())
        val accumulated = getAccumulated()
        assert(accumulated >= 5000)

        // Closed clock is stable (no growth without audio).
        assert(service().getSpokenPlaybackMs() == accumulated)
    }

    @Test
    fun testOpenIsIdempotentAndDoubleCloseIsSafe() {
        listener.onStart("u1")
        val first = getSegmentStart()
        listener.onStart("u2")
        assert(getSegmentStart() == first)

        listener.onDone("u1")
        listener.onDone("u2")
        val accumulated = getAccumulated()
        listener.onDone("u3")
        assert(getAccumulated() == accumulated)
    }

    @Test
    fun testErrorOnDrainedQueueClosesSegment() {
        listener.onStart("u1")
        assert(getSegmentStart() != null)
        listener.onError("u1")
        assert(getSegmentStart() == null)
    }

    @Test
    fun testStopAndPauseCloseOpenSegment() {
        listener.onStart("u1")
        assert(getSegmentStart() != null)
        service().stopAudioKeepService()
        assert(getSegmentStart() == null)

        listener.onStart("u2")
        assert(getSegmentStart() != null)
        service().pauseTTSKeepService()
        assert(getSegmentStart() == null)

        listener.onStart("u3")
        assert(getSegmentStart() != null)
        service().stopTTS()
        assert(getSegmentStart() == null)
    }
}
