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
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
// TEMPORARY: Commented out due to dependency resolution failure
// import androidx.media.app.NotificationCompat.MediaStyle
// import androidx.media.session.MediaSessionCompat
// import androidx.media.session.PlaybackStateCompat
// import androidx.media.session.MediaMetadataCompat
import java.util.Locale

class TTSForegroundService : Service(), TextToSpeech.OnInitListener {
    private var tts: TextToSpeech? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var isTtsInitialized = false
    private val binder = TTSBinder()
    private var ttsListener: TTSListener? = null
    // TEMPORARY: Commented out due to dependency resolution failure
    // private var mediaSession: MediaSessionCompat? = null

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

    companion object {
        const val CHANNEL_ID = "tts_service_channel"
        const val NOTIFICATION_ID = 1001
        const val ACTION_STOP_TTS = "com.rajarsheechatterjee.LNReader.STOP_TTS"

        const val ACTION_MEDIA_PREV_CHAPTER = "com.rajarsheechatterjee.LNReader.TTS.PREV_CHAPTER"
        const val ACTION_MEDIA_SEEK_BACK = "com.rajarsheechatterjee.LNReader.TTS.SEEK_BACK"
        const val ACTION_MEDIA_PLAY_PAUSE = "com.rajarsheechatterjee.LNReader.TTS.PLAY_PAUSE"
        const val ACTION_MEDIA_SEEK_FORWARD = "com.rajarsheechatterjee.LNReader.TTS.SEEK_FORWARD"
        const val ACTION_MEDIA_NEXT_CHAPTER = "com.rajarsheechatterjee.LNReader.TTS.NEXT_CHAPTER"
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

    // TEMPORARY: Commented out MediaSessionCallback due to dependency resolution failure
    /*
    private inner class MediaSessionCallback : MediaSessionCompat.Callback() {
        override fun onPlay() {
            ttsListener?.onMediaAction(ACTION_MEDIA_PLAY_PAUSE)
        }

        override fun onPause() {
            ttsListener?.onMediaAction(ACTION_MEDIA_PLAY_PAUSE)
        }

        override fun onSkipToNext() {
            ttsListener?.onMediaAction(ACTION_MEDIA_NEXT_CHAPTER)
        }

        override fun onSkipToPrevious() {
            ttsListener?.onMediaAction(ACTION_MEDIA_PREV_CHAPTER)
        }

        override fun onFastForward() {
            ttsListener?.onMediaAction(ACTION_MEDIA_SEEK_FORWARD)
        }

        override fun onRewind() {
            ttsListener?.onMediaAction(ACTION_MEDIA_SEEK_BACK)
        }

        override fun onStop() {
            stopTTS()
        }
    }
    */

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        tts = TextToSpeech(this, this)
        
        
        // TEMPORARY: Commented out MediaSession initialization due to dependency resolution failure
        /*
        // Initialize MediaSessionCompat
        mediaSession = MediaSessionCompat(this, "TTSForegroundService").apply {
            setCallback(MediaSessionCallback())
            isActive = true
        }
        */

        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "LNReader::TTSWakeLock"
        ).apply {
            setReferenceCounted(false)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP_TTS -> stopTTS()
            ACTION_MEDIA_PREV_CHAPTER,
            ACTION_MEDIA_SEEK_BACK,
            ACTION_MEDIA_PLAY_PAUSE,
            ACTION_MEDIA_SEEK_FORWARD,
            ACTION_MEDIA_NEXT_CHAPTER -> {
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

    fun speak(text: String, utteranceId: String, rate: Float, pitch: Float, voiceId: String?): Boolean {
        if (!isTtsInitialized) return false

        tts?.let { ttsInstance ->
            ttsInstance.setSpeechRate(rate)
            ttsInstance.setPitch(pitch)
            
            if (voiceId != null) {
                var voiceFound = false
                try {
                    for (voice in ttsInstance.voices) {
                        if (voice.name == voiceId) {
                            ttsInstance.voice = voice
                            voiceFound = true
                            break
                        }
                    }
                    // If preferred voice not found, try to find a high-quality alternative
                    if (!voiceFound) {
                        android.util.Log.w("TTSForegroundService", "Preferred voice '$voiceId' not found, attempting fallback")
                        // Retry: refresh voices and try again
                        val refreshedVoices = ttsInstance.voices
                        for (voice in refreshedVoices) {
                            if (voice.name == voiceId) {
                                ttsInstance.voice = voice
                                voiceFound = true
                                android.util.Log.i("TTSForegroundService", "Voice found on retry")
                                break
                            }
                        }
                        // If still not found, select best quality voice for same language
                        if (!voiceFound) {
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
                        }
                    }
                } catch (e: Exception) {
                    android.util.Log.e("TTSForegroundService", "Voice setting error: ${e.message}")
                }
            }

            val params = android.os.Bundle()
            params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId)
            
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
            
            if (voiceId != null) {
                var voiceFound = false
                try {
                    for (voice in ttsInstance.voices) {
                        if (voice.name == voiceId) {
                            ttsInstance.voice = voice
                            voiceFound = true
                            break
                        }
                    }
                    // If preferred voice not found, try to find a high-quality alternative
                    if (!voiceFound) {
                        android.util.Log.w("TTSForegroundService", "Preferred voice '$voiceId' not found for batch, attempting fallback")
                        // Retry: refresh voices and try again
                        val refreshedVoices = ttsInstance.voices
                        for (voice in refreshedVoices) {
                            if (voice.name == voiceId) {
                                ttsInstance.voice = voice
                                voiceFound = true
                                android.util.Log.i("TTSForegroundService", "Voice found on retry")
                                break
                            }
                        }
                        // If still not found, select best quality voice for same language
                        if (!voiceFound) {
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
                                android.util.Log.w("TTSForegroundService", "Using fallback voice for batch: ${bestVoice.name} (quality: $bestQuality)")
                                // FIX Case 7.2: Notify listener about voice fallback
                                ttsListener?.onVoiceFallback(voiceId, bestVoice.name)
                            }
                        }
                    }
                } catch (e: Exception) {
                    android.util.Log.e("TTSForegroundService", "Voice setting error in batch: ${e.message}")
                }
            }

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
        stopForegroundService()
    }

    /**
     * MVP pause semantics: stop audio output but keep service + notification.
     * Resume is handled by RN via speakBatch from last known paragraph.
     */
    fun stopAudioKeepService() {
        tts?.stop()
        synchronized(queuedUtteranceIds) {
            queuedUtteranceIds.clear()
        }
        currentBatchIndex = 0
        mediaIsPlaying = false
        updatePlaybackState()
        updateNotification()
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
        stopForeground(true)
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

        val prevChapterPI = actionPendingIntent(ACTION_MEDIA_PREV_CHAPTER, 101)
        val seekBackPI = actionPendingIntent(ACTION_MEDIA_SEEK_BACK, 102)
        val playPausePI = actionPendingIntent(ACTION_MEDIA_PLAY_PAUSE, 103)
        val seekForwardPI = actionPendingIntent(ACTION_MEDIA_SEEK_FORWARD, 104)
        val nextChapterPI = actionPendingIntent(ACTION_MEDIA_NEXT_CHAPTER, 105)

        val stopIntent = Intent(this, TTSForegroundService::class.java).apply {
            action = ACTION_STOP_TTS
        }
        val stopPI = PendingIntent.getService(this, 106, stopIntent, PendingIntent.FLAG_IMMUTABLE)

        val title = if (mediaNovelName.isNotBlank()) mediaNovelName else "LNReader"
        val chapterText = if (mediaChapterLabel.isNotBlank()) mediaChapterLabel else ""

        val progressPercent = if (mediaTotalParagraphs > 0) {
            val safeIndex = mediaParagraphIndex.coerceIn(0, mediaTotalParagraphs - 1)
            (((safeIndex + 1).toDouble() / mediaTotalParagraphs.toDouble()) * 100.0).toInt().coerceIn(0, 100)
        } else {
            0
        }

        val playPauseIcon = if (mediaIsPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play
        val playPauseLabel = if (mediaIsPlaying) "Pause" else "Play"

        // TEMPORARY: Commented out MediaStyle due to dependency resolution failure
        /*
        // Use standard MediaStyle notification with progress bar and action buttons
        // Connect to MediaSessionCompat for native progress support
        val mediaStyle = MediaStyle()
            .setShowActionsInCompactView(1, 2, 3) // Show seek back, play/pause, seek forward in compact
        
        // Set the media session token to enable native progress bar
        mediaSession?.let { session ->
            mediaStyle.setMediaSession(session.sessionToken)
        }
        */
        
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(chapterText)
            .setSubText("$progressPercent%") // Show progress as subtext
            .setProgress(100, progressPercent, false) // Seek bar: max=100, current=progressPercent, indeterminate=false
            .setContentIntent(appPendingIntent)
            .setOnlyAlertOnce(true)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            // TEMPORARY: Commented out .setStyle() due to MediaStyle dependency resolution failure
            // .setStyle(mediaStyle)
            .addAction(android.R.drawable.ic_media_previous, "Previous", prevChapterPI)
            .addAction(android.R.drawable.ic_media_rew, "-5", seekBackPI)
            .addAction(playPauseIcon, playPauseLabel, playPausePI)
            .addAction(android.R.drawable.ic_media_ff, "+5", seekForwardPI)
            .addAction(android.R.drawable.ic_media_next, "Next", nextChapterPI)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Close", stopPI)
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
        if (novelName != null) mediaNovelName = novelName
        if (chapterLabel != null) mediaChapterLabel = chapterLabel
        mediaChapterId = chapterId
        mediaParagraphIndex = paragraphIndex
        mediaTotalParagraphs = totalParagraphs
        mediaIsPlaying = isPlaying
        updatePlaybackState()
        updateNotification()
    }

    // TEMPORARY: Commented out updatePlaybackState due to dependency resolution failure
    /*
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
                    PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                    PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                    PlaybackStateCompat.ACTION_FAST_FORWARD or
                    PlaybackStateCompat.ACTION_REWIND or
                    PlaybackStateCompat.ACTION_STOP
                )
                .setActiveQueueItemId(mediaChapterId?.toLong() ?: PlaybackStateCompat.UNKNOWN_QUEUE_ID)
                .build()
                
            session.setPlaybackState(playbackState)
            
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
    */
    
    private fun updatePlaybackState() {
        // TEMPORARY: No-op until MediaSessionCompat dependency is resolved
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
        // TEMPORARY: Commented out due to dependency resolution failure
        // mediaSession?.release()
        // mediaSession = null
        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }
        super.onDestroy()
    }
}
