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
import java.util.Locale

class TTSForegroundService : Service(), TextToSpeech.OnInitListener {
    private var tts: TextToSpeech? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var isTtsInitialized = false
    private val binder = TTSBinder()
    private var ttsListener: TTSListener? = null
    
    // Queue management for batch feeding
    private var currentBatchIndex = 0
    private val queuedUtteranceIds = mutableListOf<String>()
    
    // Track if service is already in foreground state to avoid Android 12+ background start restriction
    private var isServiceForeground = false

    companion object {
        const val CHANNEL_ID = "tts_service_channel"
        const val NOTIFICATION_ID = 1001
        const val ACTION_STOP_TTS = "com.rajarsheechatterjee.LNReader.STOP_TTS"
    }

    interface TTSListener {
        fun onSpeechStart(utteranceId: String)
        fun onSpeechDone(utteranceId: String)
        fun onSpeechError(utteranceId: String)
        fun onWordRange(utteranceId: String, start: Int, end: Int, frame: Int)
        fun onQueueEmpty()  // Called when TTS queue is completely empty (chapter finished)
    }

    inner class TTSBinder : Binder() {
        fun getService(): TTSForegroundService = this@TTSForegroundService
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        tts = TextToSpeech(this, this)

        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "LNReader::TTSWakeLock"
        ).apply {
            setReferenceCounted(false)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP_TTS) {
            stopTTS()
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
        
        val notification = createNotification("TTS is reading...")
        
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

    private fun createNotification(content: String): Notification {
        val stopIntent = Intent(this, TTSForegroundService::class.java).apply {
            action = ACTION_STOP_TTS
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 0, stopIntent, PendingIntent.FLAG_IMMUTABLE
        )

        // Open app on click
        val appIntent = packageManager.getLaunchIntentForPackage(packageName)
        val appPendingIntent = PendingIntent.getActivity(
            this, 0, appIntent, PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("LNReader TTS")
            .setContentText(content)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(appPendingIntent)
            .addAction(android.R.drawable.ic_media_pause, "Stop", stopPendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    override fun onDestroy() {
        tts?.stop()
        tts?.shutdown()
        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }
        super.onDestroy()
    }
}
