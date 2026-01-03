package com.rajarsheechatterjee.LNReader

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Binder
import android.os.IBinder
import android.os.PowerManager
import android.content.ComponentName
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
// MediaSession imports - re-enabled for Bluetooth headset support
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.media.app.NotificationCompat.MediaStyle
import androidx.media.session.MediaButtonReceiver
import android.content.SharedPreferences
import android.graphics.BitmapFactory
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import java.util.Locale

class TTSForegroundService : Service(), TextToSpeech.OnInitListener {
    private var tts: TextToSpeech? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var isTtsInitialized = false
    private val binder = TTSBinder()
    private var ttsListener: TTSListener? = null
    // MediaSession re-enabled for Bluetooth headset support (NOT attached to notification)
    private var mediaSession: MediaSessionCompat? = null
    // AudioFocus support for proper Bluetooth behavior
    private var audioManager: AudioManager? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    // Silent MediaPlayer to establish our app as audio focus owner
    // This allows MediaSession to receive Bluetooth/hardware media button events
    private var silentMediaPlayer: MediaPlayer? = null

    // Notification-driven state (set by RN)
    private var mediaNovelName: String = "LNReader"
    private var mediaChapterLabel: String = ""
    private var mediaChapterId: Int? = null
    private var mediaParagraphIndex: Int = 0
    private var mediaTotalParagraphs: Int = 0
    private var mediaIsPlaying: Boolean = false
    
    // Queue management for batch feeding
    private var currentBatchIndex = 0
    private val queuedUtteranceIds = mutableListOf<String>()
    
    // Track if service is already in foreground state to avoid Android 12+ background start restriction
    private var isServiceForeground = false
    
    // Notification update throttling to prevent flicker during rapid changes
    private var lastNotificationUpdateTime = 0L
    private val NOTIFICATION_UPDATE_THROTTLE_MS = 500L // Max 2 updates/second

    companion object {
        const val CHANNEL_ID = "tts_service_channel"
        const val NOTIFICATION_ID = 1001
        const val ACTION_STOP_TTS = "com.rajarsheechatterjee.LNReader.STOP_TTS"

        const val ACTION_MEDIA_PREV_CHAPTER = "com.rajarsheechatterjee.LNReader.TTS.PREV_CHAPTER"
        const val ACTION_MEDIA_SEEK_BACK = "com.rajarsheechatterjee.LNReader.TTS.SEEK_BACK"
        const val ACTION_MEDIA_PLAY_PAUSE = "com.rajarsheechatterjee.LNReader.TTS.PLAY_PAUSE"
        const val ACTION_MEDIA_SEEK_FORWARD = "com.rajarsheechatterjee.LNReader.TTS.SEEK_FORWARD"
        const val ACTION_MEDIA_NEXT_CHAPTER = "com.rajarsheechatterjee.LNReader.TTS.NEXT_CHAPTER"
        
        // PendingIntent request codes (must be unique per action)
        const val REQUEST_PREV_CHAPTER = 101
        const val REQUEST_SEEK_BACK = 102
        const val REQUEST_PLAY_PAUSE = 103
        const val REQUEST_SEEK_FORWARD = 104
        const val REQUEST_NEXT_CHAPTER = 105
        const val REQUEST_STOP = 106
        
        // Internal signal for TTS position save (not a real utterance ID)
        const val INTERNAL_SAVE_POSITION_SIGNAL = "__INTERNAL_TTS_SAVE_POSITION__"
    }

    interface TTSListener {
        fun onSpeechStart(utteranceId: String)
        fun onSpeechDone(utteranceId: String)
        fun onSpeechError(utteranceId: String)
        fun onWordRange(utteranceId: String, start: Int, end: Int, frame: Int)
        fun onQueueEmpty()  // Called when TTS queue is completely empty (chapter finished)
        fun onVoiceFallback(originalVoice: String, fallbackVoice: String)  // FIX Case 7.2: Notify when voice fallback occurs
        fun onMediaAction(action: String) // Notification media control action
    }

    inner class TTSBinder : Binder() {
        fun getService(): TTSForegroundService = this@TTSForegroundService
    }

    // Getter methods for TTS position sync
    fun getChapterId(): Int? = mediaChapterId
    fun getParagraphIndex(): Int = mediaParagraphIndex

    // MediaSession callback for hardware buttons and lock screen controls
    // Re-enabled for Bluetooth headset support
    // MediaSession callback for hardware buttons and lock screen controls
    // Re-enabled for Bluetooth headset support
    private inner class MediaSessionCallback : MediaSessionCompat.Callback() {
        // Debug raw media button events
        override fun onMediaButtonEvent(mediaButtonEvent: Intent?): Boolean {
            android.util.Log.d("TTS_DEBUG", "MediaSessionCallback.onMediaButtonEvent intent=${mediaButtonEvent?.action} key=${mediaButtonEvent?.getParcelableExtra<android.view.KeyEvent>(Intent.EXTRA_KEY_EVENT)}")
            // Return false to let the system process play/pause/etc methods
            return super.onMediaButtonEvent(mediaButtonEvent)
        }

        override fun onPlay() {
            android.util.Log.d("TTS_DEBUG", "MediaSessionCallback.onPlay")
            ttsListener?.onMediaAction(ACTION_MEDIA_PLAY_PAUSE)
        }

        override fun onPause() {
            android.util.Log.d("TTS_DEBUG", "MediaSessionCallback.onPause")
            ttsListener?.onMediaAction(ACTION_MEDIA_PLAY_PAUSE)
        }

        override fun onSkipToNext() {
            android.util.Log.d("TTS_DEBUG", "MediaSessionCallback.onSkipToNext")
            ttsListener?.onMediaAction(ACTION_MEDIA_NEXT_CHAPTER)
        }

        override fun onSkipToPrevious() {
            android.util.Log.d("TTS_DEBUG", "MediaSessionCallback.onSkipToPrevious")
            ttsListener?.onMediaAction(ACTION_MEDIA_PREV_CHAPTER)
        }

        override fun onFastForward() {
            android.util.Log.d("TTS_DEBUG", "MediaSessionCallback.onFastForward")
            ttsListener?.onMediaAction(ACTION_MEDIA_SEEK_FORWARD)
        }

        override fun onRewind() {
            android.util.Log.d("TTS_DEBUG", "MediaSessionCallback.onRewind")
            ttsListener?.onMediaAction(ACTION_MEDIA_SEEK_BACK)
        }

        override fun onStop() {
            android.util.Log.d("TTS_DEBUG", "MediaSessionCallback.onStop")
            stopTTS()
        }
        

    }

    // AudioFocus change listener for proper audio behavior
    private val audioFocusChangeListener = AudioManager.OnAudioFocusChangeListener { focusChange ->
        when (focusChange) {
            AudioManager.AUDIOFOCUS_LOSS -> {
                // Permanent loss - pause TTS but keep notification visible
                // This allows users to resume playback from the notification
                // after another app finishes playing audio
                pauseTTSKeepService()
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                // Temporary loss - pause TTS
                ttsListener?.onMediaAction(ACTION_MEDIA_PLAY_PAUSE)
            }
            AudioManager.AUDIOFOCUS_GAIN -> {
                // Regained focus - resume if was playing
                if (mediaIsPlaying) {
                    ttsListener?.onMediaAction(ACTION_MEDIA_PLAY_PAUSE)
                }
            }
        }
    }


    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        tts = TextToSpeech(this, this)
        
        // Initialize AudioManager for AudioFocus
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        
        // Create MediaSession for Bluetooth headset support
        // We target the SERVICE directly for reliability
        // Create MediaSession for Bluetooth headset support
        // CRITICAL: We explicitly pass the ComponentName of our receiver
        val receiverComponent = ComponentName(this, DebugMediaButtonReceiver::class.java)
        val mediaButtonIntent = Intent(Intent.ACTION_MEDIA_BUTTON)
        mediaButtonIntent.setClass(this, DebugMediaButtonReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(this, 0, mediaButtonIntent, PendingIntent.FLAG_IMMUTABLE)
        
        // Use constructor that links the receiver component explicitly
        mediaSession = MediaSessionCompat(this, "LNReaderTTS", receiverComponent, pendingIntent).apply {
            setCallback(MediaSessionCallback())
            
            // FIX: Explicitly set flags for media button handling
            setFlags(
                MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or 
                MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
            )
            
            // Use the same pending intent for the session
            setMediaButtonReceiver(pendingIntent)

            // FIX: Set session activity (opens app on click in some contexts)
            val appIntent = packageManager.getLaunchIntentForPackage(packageName)
            val appPendingIntent = PendingIntent.getActivity(
                this@TTSForegroundService, 
                0, 
                appIntent, 
                PendingIntent.FLAG_IMMUTABLE
            )
            setSessionActivity(appPendingIntent)

            isActive = true
            
            // Set supported actions for Bluetooth controls
            setPlaybackState(
                PlaybackStateCompat.Builder()
                    .setActions(
                        PlaybackStateCompat.ACTION_PLAY or
                        PlaybackStateCompat.ACTION_PAUSE or
                        PlaybackStateCompat.ACTION_PLAY_PAUSE or
                        PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                        PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                        PlaybackStateCompat.ACTION_FAST_FORWARD or
                        PlaybackStateCompat.ACTION_REWIND or
                        PlaybackStateCompat.ACTION_STOP
                    )
                    .setState(PlaybackStateCompat.STATE_PAUSED, 0, 1.0f)
                    .build()
            )
        }

        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "LNReader::TTSWakeLock"
        ).apply {
            setReferenceCounted(false)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        android.util.Log.d("TTS_DEBUG", "onStartCommand action=${intent?.action}")
        
        // Handle media button intents from Bluetooth/wired headsets
        // This routes MEDIA_BUTTON intents to the MediaSessionCallback
        val handled = MediaButtonReceiver.handleIntent(mediaSession, intent)
        android.util.Log.d("TTS_DEBUG", "MediaButtonReceiver.handleIntent handled=$handled")
        
        when (intent?.action) {
            ACTION_STOP_TTS -> stopTTS()
            ACTION_MEDIA_PREV_CHAPTER,
            ACTION_MEDIA_SEEK_BACK,
            ACTION_MEDIA_PLAY_PAUSE,
            ACTION_MEDIA_SEEK_FORWARD,
            ACTION_MEDIA_NEXT_CHAPTER -> {
                android.util.Log.d("TTS_DEBUG", "Processing action: ${intent.action}")
                ttsListener?.onMediaAction(intent.action!!)
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent): IBinder {
        return binder
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            isTtsInitialized = true
            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String) {
                    // CRITICAL: Ensure wake lock is still held during playback
                    // This prevents Android from releasing it during extended background sessions
                    ensureWakeLockHeld()
                    ttsListener?.onSpeechStart(utteranceId)
                }

                override fun onDone(utteranceId: String) {
                    ttsListener?.onSpeechDone(utteranceId)
                    
                    // Track completion
                    synchronized(queuedUtteranceIds) {
                        queuedUtteranceIds.remove(utteranceId)
                        // Notify when queue becomes empty (chapter finished)
                        if (queuedUtteranceIds.isEmpty()) {
                            ttsListener?.onQueueEmpty()
                        }
                    }
                }

                override fun onError(utteranceId: String) {
                    ttsListener?.onSpeechError(utteranceId)
                    synchronized(queuedUtteranceIds) {
                        queuedUtteranceIds.remove(utteranceId)
                    }
                }

                override fun onRangeStart(utteranceId: String, start: Int, end: Int, frame: Int) {
                    ttsListener?.onWordRange(utteranceId, start, end, frame)
                }
            })
        }
    }

    fun setTTSListener(listener: TTSListener) {
        this.ttsListener = listener
    }

    /**
     * Sets the TTS voice with intelligent fallback.
     * 1. Try to find exact voice by ID
     * 2. If not found, refresh voice list and retry
     * 3. If still not found, select best quality voice for same language
     * 4. Notifies listener if fallback occurs
     *
     * @param ttsInstance The TextToSpeech instance
     * @param voiceId The preferred voice identifier (can be null)
     */
    private fun setVoiceWithFallback(ttsInstance: TextToSpeech, voiceId: String?) {
        if (voiceId == null) return
        
        try {
            // Step 1: Try to find exact voice
            for (voice in ttsInstance.voices) {
                if (voice.name == voiceId) {
                    ttsInstance.voice = voice
                    return
                }
            }
            
            android.util.Log.w("TTSForegroundService", "Preferred voice '$voiceId' not found, attempting fallback")
            
            // Step 2: Refresh voices and retry
            val refreshedVoices = ttsInstance.voices
            for (voice in refreshedVoices) {
                if (voice.name == voiceId) {
                    ttsInstance.voice = voice
                    android.util.Log.i("TTSForegroundService", "Voice found on retry")
                    return
                }
            }
            
            // Step 3: Select best quality voice for same language
            val currentLocale = ttsInstance.voice?.locale ?: Locale.getDefault()
            var bestVoice: Voice? = null
            var bestQuality = -1
            
            for (voice in refreshedVoices) {
                if (voice.locale.language == currentLocale.language && voice.quality > bestQuality) {
                    bestVoice = voice
                    bestQuality = voice.quality
                }
            }
            
            if (bestVoice != null) {
                ttsInstance.voice = bestVoice
                android.util.Log.w("TTSForegroundService", "Using fallback voice: ${bestVoice.name} (quality: $bestQuality)")
                // FIX Case 7.2: Notify listener about voice fallback
                ttsListener?.onVoiceFallback(voiceId, bestVoice.name)
            }
            
        } catch (e: Exception) {
            android.util.Log.e("TTSForegroundService", "Voice setting error: ${e.message}")
        }
    }

    fun speak(text: String, utteranceId: String, rate: Float, pitch: Float, voiceId: String?): Boolean {
        if (!isTtsInitialized) return false

        tts?.let { ttsInstance ->
            ttsInstance.setSpeechRate(rate)
            ttsInstance.setPitch(pitch)
            setVoiceWithFallback(ttsInstance, voiceId)

            val params = android.os.Bundle()
            params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId)
            
            // Request audio focus before speaking
            requestAudioFocus()
            
            val result = ttsInstance.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId)
            
            if (result == TextToSpeech.SUCCESS) {
                startForegroundService()
                synchronized(queuedUtteranceIds) {
                    queuedUtteranceIds.clear()
                    queuedUtteranceIds.add(utteranceId)
                }
                return true
            }
        }
        return false
    }
    
    fun speakBatch(
        texts: List<String>, 
        utteranceIds: List<String>,
        rate: Float,
        pitch: Float,
        voiceId: String?
    ): Boolean {
        if (!isTtsInitialized) return false
        if (texts.isEmpty()) return false

        tts?.let { ttsInstance ->
            ttsInstance.setSpeechRate(rate)
            ttsInstance.setPitch(pitch)
            setVoiceWithFallback(ttsInstance, voiceId)

            // Request audio focus before starting batch
            requestAudioFocus()
            // Start silent audio to establish our app as audio focus owner for Bluetooth media buttons
            startSilentAudioForMediaSession()

            // Clear queue and start fresh
            synchronized(queuedUtteranceIds) {
                queuedUtteranceIds.clear()
            }
            currentBatchIndex = 0
            
            // Queue all texts
            for (i in texts.indices) {
                val params = android.os.Bundle()
                val utteranceId = utteranceIds.getOrNull(i) ?: "utterance_$i"
                params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId)
                
                val queueMode = if (i == 0) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD
                val result = ttsInstance.speak(texts[i], queueMode, params, utteranceId)
                
                if (result == TextToSpeech.SUCCESS) {
                    synchronized(queuedUtteranceIds) {
                        queuedUtteranceIds.add(utteranceId)
                    }
                } else {
                    android.util.Log.e("TTSForegroundService", "speak returned non-SUCCESS for utteranceId=${utteranceId} index=${i} result=${result}")
                    return false
                }
            }
            
            startForegroundService()
            return true
        }
        return false
    }

    /**
     * Adds utterances to the existing TTS queue without flushing.
     *
     * **IMPORTANT: Voice Inheritance Behavior**
     *
     * This method does NOT call setVoiceWithFallback(). The Android TextToSpeech
     * engine retains voice settings across all utterances in the same queue session.
     * Voice is set once during speakBatch() and persists for all subsequent
     * addToBatch() calls until stop() or a new speakBatch() is called.
     *
     * This design is intentional and provides:
     * - Performance: Avoids repeated voice lookups
     * - Consistency: Guarantees same voice throughout batch session
     * - Simplicity: Refill path doesn't need to re-specify voice
     *
     * @param texts Array of text strings to speak
     * @param utteranceIds Array of unique utterance identifiers
     * @return true if all utterances were added successfully, false otherwise
     */
    fun addToBatch(
        texts: List<String>,
        utteranceIds: List<String>
    ): Boolean {
        if (!isTtsInitialized) return false
        if (texts.isEmpty()) return false

        tts?.let { ttsInstance ->
            for (i in texts.indices) {
                val params = android.os.Bundle()
                val utteranceId = utteranceIds.getOrNull(i) ?: "utterance_${currentBatchIndex + i}"
                params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId)
                
                val result = ttsInstance.speak(texts[i], TextToSpeech.QUEUE_ADD, params, utteranceId)
                
                if (result == TextToSpeech.SUCCESS) {
                    synchronized(queuedUtteranceIds) {
                        queuedUtteranceIds.add(utteranceId)
                    }
                } else {
                    android.util.Log.e("TTSForegroundService", "addToBatch speak returned non-SUCCESS for utteranceId=${utteranceId} batchIndex=${currentBatchIndex + i} result=${result}")
                    return false
                }
            }
            
            currentBatchIndex += texts.size
            return true
        }
        return false
    }
    
    fun getQueueSize(): Int {
        synchronized(queuedUtteranceIds) {
            return queuedUtteranceIds.size
        }
    }

    fun stopTTS() {
        tts?.stop()
        synchronized(queuedUtteranceIds) {
            queuedUtteranceIds.clear()
        }
        currentBatchIndex = 0
        // Stop silent audio and abandon audio focus when stopping
        stopSilentAudio()
        abandonAudioFocus()
        stopForegroundService()
    }

    fun stopAudioKeepService() {
        android.util.Log.d("TTS_DEBUG", "TTSForegroundService.stopAudioKeepService called. tts=$tts")
        val stopResult = tts?.stop() ?: -999
        android.util.Log.d("TTS_DEBUG", "tts.stop() result=$stopResult (0=SUCCESS, -1=ERROR, -999=NULL)")
        synchronized(queuedUtteranceIds) {
            queuedUtteranceIds.clear()
        }
        currentBatchIndex = 0
        // IMPORTANT: Do not mutate mediaIsPlaying here.
        // React Native is the source of truth and will call updateMediaState(isPlaying=false)
        // after a pause request succeeds. If we set mediaIsPlaying=false here, then
        // updateMediaState() may not detect playStateChanged and will skip updating the
        // notification, leaving the Play/Pause icon stuck.
        updatePlaybackState()  // MediaSession re-enabled
        // NOTE: Do NOT call updateNotification() directly here!
        // Notification updates should be controlled via updateMediaState() from React Native.
        // Calling updateNotification() here causes flicker during pause/seek operations
        // because RN will also call updateMediaState() shortly after.
    }

    /**
     * Pause TTS audio but keep the foreground service and notification visible.
     * This is used when audio focus is lost (e.g., another app plays audio),
     * allowing users to resume playback from the notification after the interruption.
     * 
     * Unlike stopTTS(), this does NOT call stopForegroundService(), so the notification
     * remains visible with a "Paused" state.
     * 
     * IMPORTANT: We notify the React Native layer to handle the pause through its
     * state machine, rather than directly mutating mediaIsPlaying. This ensures
     * the RN and native layers stay synchronized.
     */
    fun pauseTTSKeepService() {
        android.util.Log.d("TTS_DEBUG", "TTSForegroundService.pauseTTSKeepService called")
        
        // Stop TTS audio playback
        tts?.stop()
        synchronized(queuedUtteranceIds) {
            queuedUtteranceIds.clear()
        }
        currentBatchIndex = 0
        
        // Stop silent audio and abandon audio focus (we're not playing anymore)
        stopSilentAudio()
        abandonAudioFocus()
        
        // Notify React Native layer to handle pause through its state machine
        // This ensures RN state stays in sync with native state
        // RN will then call updateMediaState(isPlaying=false), which will update
        // the notification and MediaSession properly
        ttsListener?.onMediaAction(ACTION_MEDIA_PLAY_PAUSE)
    }

    fun getVoices(): List<Voice> {
        return tts?.voices?.toList() ?: emptyList()
    }

    private fun startForegroundService() {
        // CRITICAL: Only call startForeground() if not already in foreground state
        // This prevents Android 12+ ForegroundServiceStartNotAllowedException when
        // transitioning between chapters while the app is in background
        if (isServiceForeground) {
            // Already foreground, just ensure wake lock is held
            try {
                if (wakeLock?.isHeld == false) {
                    wakeLock?.acquire()
                }
            } catch (e: Exception) {
                // Best-effort wake lock acquisition
            }
            return
        }
        
        // Acquire a persistent wake lock while the foreground TTS service
        // is active to prevent the device from sleeping mid-playback.
        // Previously this used a 10-minute timeout which could cause long
        // reading sessions to stop after ~10 minutes (observed ~50 paragraphs).
        // Acquire without timeout and release when the service stops.
        try {
            if (wakeLock?.isHeld == false) {
                wakeLock?.acquire()
            }
        } catch (e: Exception) {
            // Best-effort: if acquiring fails (security/behavioral differences),
            // continue — service will remain foreground and most devices allow
            // media playback to continue without an explicit wake lock.
        }
        
        val notification = createNotification()
        
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
            isServiceForeground = true
        } catch (e: Exception) {
            // If we still fail (edge case), log but don't crash
            // The TTS will still work, just without foreground state
            android.util.Log.e("TTSForegroundService", "Failed to start foreground: ${e.message}")
        }
    }

    private fun stopForegroundService() {
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
        } catch (e: Exception) {
            // ignore release errors
        }
        stopForeground(Service.STOP_FOREGROUND_REMOVE)
        isServiceForeground = false
    }
    
    /**
     * Ensures the wake lock is held during TTS playback.
     * Called on every utterance start to prevent Android from releasing it
     * during extended background sessions (Bug 1 fix).
     */
    private fun ensureWakeLockHeld() {
        try {
            if (wakeLock?.isHeld == false) {
                android.util.Log.d("TTSForegroundService", "Re-acquiring wake lock during playback")
                wakeLock?.acquire()
            }
        } catch (e: Exception) {
            android.util.Log.w("TTSForegroundService", "Failed to re-acquire wake lock: ${e.message}")
        }
    }

    /**
     * Request audio focus for TTS playback
     * Required for proper Bluetooth headset behavior
     */
    private fun requestAudioFocus() {
        audioManager?.let { am ->
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    // Android 8.0+ - use AudioFocusRequest
                    if (audioFocusRequest == null) {
                        val audioAttributes = AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build()
                        
                        audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                            .setAudioAttributes(audioAttributes)
                            .setOnAudioFocusChangeListener(audioFocusChangeListener)
                            .build()
                    }
                    
                    audioFocusRequest?.let { request ->
                        val result = am.requestAudioFocus(request)
                        if (result != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                            android.util.Log.w("TTSForegroundService", "Audio focus request denied")
                        } else {
                            android.util.Log.d("TTS_DEBUG", "Audio focus GRANTED")
                        }
                    }
                } else {
                    // Pre-Android 8.0
                    @Suppress("DEPRECATION")
                    val result = am.requestAudioFocus(
                        audioFocusChangeListener,
                        AudioManager.STREAM_MUSIC,
                        AudioManager.AUDIOFOCUS_GAIN
                    )
                    if (result != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                        android.util.Log.w("TTSForegroundService", "Audio focus request denied")
                    } else {
                        android.util.Log.d("TTS_DEBUG", "Audio focus GRANTED (legacy)")
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("TTSForegroundService", "Failed to request audio focus: ${e.message}")
            }
        }
    }

    /**
     * Abandon audio focus when TTS stops
     */
    private fun abandonAudioFocus() {
        android.util.Log.d("TTS_DEBUG", "abandonAudioFocus")
        audioManager?.let { am ->
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    audioFocusRequest?.let { request ->
                        am.abandonAudioFocusRequest(request)
                    }
                } else {
                    @Suppress("DEPRECATION")
                    am.abandonAudioFocus(audioFocusChangeListener)
                }
            } catch (e: Exception) {
                android.util.Log.e("TTSForegroundService", "Failed to abandon audio focus: ${e.message}")
            }
        }
    }

    /**
     * Start silent audio playback to establish our app as the audio focus owner.
     * This workaround is needed because TTS audio is actually played by com.google.android.tts,
     * not by our app. By playing silent audio, Android sees our app as the active media player,
     * which allows our MediaSession to receive Bluetooth/hardware media button events.
     */
    private fun startSilentAudioForMediaSession() {
        if (silentMediaPlayer != null) {
            android.util.Log.d("TTS_DEBUG", "Silent audio already playing")
            return
        }
        
        try {
            // Create MediaPlayer with proper AudioAttributes so Android recognizes it as media playback
            silentMediaPlayer = MediaPlayer().apply {
                // Set audio attributes BEFORE setting data source
                val audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
                setAudioAttributes(audioAttributes)
                
                // Load the silent audio resource
                val afd = resources.openRawResourceFd(R.raw.silence)
                if (afd != null) {
                    setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
                    afd.close()
                    prepare()
                    isLooping = true
                    setVolume(0f, 0f)
                    start()
                    android.util.Log.d("TTS_DEBUG", "Silent audio started with AudioAttributes for MediaSession")
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("TTS_DEBUG", "Failed to start silent audio: ${e.message}")
        }
    }

    /**
     * Stop silent audio playback when TTS stops
     */
    private fun stopSilentAudio() {
        silentMediaPlayer?.let { player ->
            try {
                if (player.isPlaying) {
                    player.stop()
                }
                player.release()
                android.util.Log.d("TTS_DEBUG", "Silent audio stopped")
            } catch (e: Exception) {
                android.util.Log.e("TTS_DEBUG", "Failed to stop silent audio: ${e.message}")
            }
        }
        silentMediaPlayer = null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "TTS Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps TTS running in background"
                setSound(null, null)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        // Open app on click
        val appIntent = packageManager.getLaunchIntentForPackage(packageName)
        val appPendingIntent = PendingIntent.getActivity(
            this, 0, appIntent, PendingIntent.FLAG_IMMUTABLE
        )

        fun actionPendingIntent(action: String, requestCode: Int): PendingIntent {
            val intent = Intent(this, TTSForegroundService::class.java).apply {
                this.action = action
            }
            return PendingIntent.getService(
                this,
                requestCode,
                intent,
                PendingIntent.FLAG_IMMUTABLE
            )
        }

        val prevChapterPI = actionPendingIntent(ACTION_MEDIA_PREV_CHAPTER, REQUEST_PREV_CHAPTER)
        val seekBackPI = actionPendingIntent(ACTION_MEDIA_SEEK_BACK, REQUEST_SEEK_BACK)
        val playPausePI = actionPendingIntent(ACTION_MEDIA_PLAY_PAUSE, REQUEST_PLAY_PAUSE)
        val seekForwardPI = actionPendingIntent(ACTION_MEDIA_SEEK_FORWARD, REQUEST_SEEK_FORWARD)
        val nextChapterPI = actionPendingIntent(ACTION_MEDIA_NEXT_CHAPTER, REQUEST_NEXT_CHAPTER)

        val stopIntent = Intent(this, TTSForegroundService::class.java).apply {
            action = ACTION_STOP_TTS
        }
        val stopPI = PendingIntent.getService(this, REQUEST_STOP, stopIntent, PendingIntent.FLAG_IMMUTABLE)

        val title = if (mediaNovelName.isNotBlank()) mediaNovelName else "LNReader"
        val chapterText = if (mediaChapterLabel.isNotBlank()) mediaChapterLabel else ""

        // Calculate progress percentage and paragraph position
        val progressPercent = if (mediaTotalParagraphs > 0) {
            val safeIndex = mediaParagraphIndex.coerceIn(0, mediaTotalParagraphs - 1)
            (((safeIndex + 1).toDouble() / mediaTotalParagraphs.toDouble()) * 100.0).toInt().coerceIn(0, 100)
        } else {
            0
        }

        // Enhanced progress text: "28% • Paragraph 42 of 150"
        val progressText = if (mediaTotalParagraphs > 0) {
            val currentParagraph = (mediaParagraphIndex + 1).coerceIn(1, mediaTotalParagraphs)
            "$progressPercent% • Paragraph $currentParagraph of $mediaTotalParagraphs"
        } else {
            "$progressPercent%"
        }

        val playPauseIcon = if (mediaIsPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play
        val playPauseLabel = if (mediaIsPlaying) "Pause" else "Play"

        // Icon references for media controls (using standard Android drawables)
        // These icons are built into Android and work across all devices
        val prevIcon = android.R.drawable.ic_media_previous      // ⏮ Previous Chapter
        val rewindIcon = android.R.drawable.ic_media_rew         // ⏪ Rewind 5 paragraphs
        val forwardIcon = android.R.drawable.ic_media_ff         // ⏩ Forward 5 paragraphs
        val nextIcon = android.R.drawable.ic_media_next          // ⏭ Next Chapter  
        val stopIcon = android.R.drawable.ic_delete              // 🗑 Stop/Close (cleaner than cancel icon)

        // Create large icon from app launcher icon to fill the left area of notification
        // This improves visual balance and prevents the "gap on left" appearance
        val largeIcon = BitmapFactory.decodeResource(resources, R.mipmap.ic_launcher)



        // Debug: Check MediaSession state before building notification
        android.util.Log.d("TTS_DEBUG", "createNotification: mediaSession=$mediaSession, token=${mediaSession?.sessionToken}, isActive=${mediaSession?.isActive}")

        // Build notification with all media control buttons using MediaStyle
        // MediaStyle provides proper icon-based media buttons layout
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setLargeIcon(largeIcon)  // Fills the left area, improves visual balance
            .setContentTitle(title)
            .setContentText(chapterText)
            .setSubText(progressText) // Enhanced: "28% • Paragraph 42 of 150"
            .setContentIntent(appPendingIntent)
            .setOnlyAlertOnce(true)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            // Action buttons with standard media icons
            .addAction(prevIcon, "Previous Chapter", prevChapterPI)       // #0 ⏮
            .addAction(rewindIcon, "Rewind 5", seekBackPI)                // #1 ⏪
            .addAction(playPauseIcon, playPauseLabel, playPausePI)        // #2 ⏸/▶
            .addAction(forwardIcon, "Forward 5", seekForwardPI)           // #3 ⏩
            .addAction(nextIcon, "Next Chapter", nextChapterPI)           // #4 ⏭
            .addAction(stopIcon, "Stop", stopPI)                          // #5 🗑
            // Apply MediaStyle for icon-based media control buttons
            // NOTE: We do NOT attach MediaSession because:
            // 1. TTS audio is played by com.google.android.tts (system service), not our app
            // 2. Attaching it breaks our custom 6-button layout
            // 3. It doesn't fix media button routing anyway (system TTS owns the audio)
            .setStyle(MediaStyle()
                .setShowActionsInCompactView(1, 2, 3)) // Show [⏪] [⏸/▶] [⏩] in compact view (most used)
            .build()
    }

    fun updateMediaState(
        novelName: String?,
        chapterLabel: String?,
        chapterId: Int?,
        paragraphIndex: Int,
        totalParagraphs: Int,
        isPlaying: Boolean
    ) {
        // Track what changed to decide if notification needs update
        val novelChanged = novelName != null && novelName != mediaNovelName
        val chapterChanged = (chapterLabel != null && chapterLabel != mediaChapterLabel) || 
                             (chapterId != null && chapterId != mediaChapterId)
        val playStateChanged = isPlaying != mediaIsPlaying
        val totalParagraphsChanged = totalParagraphs != mediaTotalParagraphs
        val paragraphChanged = paragraphIndex != mediaParagraphIndex
        
        // Update state
        if (novelName != null) mediaNovelName = novelName
        if (chapterLabel != null) mediaChapterLabel = chapterLabel
        if (chapterId != null) mediaChapterId = chapterId
        mediaParagraphIndex = paragraphIndex
        mediaTotalParagraphs = totalParagraphs
        mediaIsPlaying = isPlaying
        
        // Always update MediaSession playback state for Bluetooth headsets
        updatePlaybackState()
        
        // Decide if notification should be updated
        val highPriorityChange = novelChanged || chapterChanged || playStateChanged || totalParagraphsChanged
        val lowPriorityChange = paragraphChanged && !highPriorityChange
        
        if (highPriorityChange) {
            // Critical changes: update immediately (chapter change, play/pause)
            updateNotification()
            lastNotificationUpdateTime = System.currentTimeMillis()
        } else if (lowPriorityChange) {
            // Paragraph progress: throttle to prevent flicker during rapid seeks
            val now = System.currentTimeMillis()
            if (now - lastNotificationUpdateTime >= NOTIFICATION_UPDATE_THROTTLE_MS) {
                updateNotification()
                lastNotificationUpdateTime = now
            }
            // If throttled, notification will update on next high-priority change
        }
    }

    // MediaSession playback state sync for Bluetooth headsets
    private fun updatePlaybackState() {
        mediaSession?.let { session ->
            val state = if (mediaIsPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED
            
            // Calculate position in milliseconds (using paragraph index * 1000 as a reasonable approximation)
            val position = (mediaParagraphIndex * 1000).toLong()
            // Calculate duration in milliseconds (using total paragraphs * 1000 as a reasonable approximation)
            val duration = (mediaTotalParagraphs * 1000).toLong()
            
            val playbackState = PlaybackStateCompat.Builder()
                .setState(state, position, 1.0f) // 1.0f is normal playback speed
                .setActions(
                    PlaybackStateCompat.ACTION_PLAY or
                    PlaybackStateCompat.ACTION_PAUSE or
                    PlaybackStateCompat.ACTION_PLAY_PAUSE or
                    PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                    PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                    PlaybackStateCompat.ACTION_FAST_FORWARD or
                    PlaybackStateCompat.ACTION_REWIND or
                    PlaybackStateCompat.ACTION_STOP
                )
                .setActiveQueueItemId(mediaChapterId?.toLong() ?: MediaSessionCompat.QueueItem.UNKNOWN_ID.toLong())
                .build()
                
            session.setPlaybackState(playbackState)
            android.util.Log.d("TTS_DEBUG", "updatePlaybackState: state=$state position=$position isActive=${session.isActive}")
            
            // Set metadata for better media control display
            val metadata = MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, mediaNovelName)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, mediaChapterLabel)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, "LNReader TTS")
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, duration)
                .build()
                
            session.setMetadata(metadata)
        }
    }

    private fun updateNotification() {
        if (!isServiceForeground) return
        val notification = createNotification()
        try {
            NotificationManagerCompat.from(this).notify(NOTIFICATION_ID, notification)
        } catch (e: Exception) {
            android.util.Log.w("TTSForegroundService", "notify failed: ${e.message}")
        }
    }

    override fun onDestroy() {
        tts?.stop()
        tts?.shutdown()
        
        // Release MediaSession
        mediaSession?.release()
        mediaSession = null
        
        // Stop silent audio and abandon audio focus
        stopSilentAudio()
        abandonAudioFocus()
        
        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }
        super.onDestroy()
    }
}
