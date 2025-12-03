package com.rajarsheechatterjee.LNReader

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class TTSHighlightModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), TTSForegroundService.TTSListener {

    private var ttsService: TTSForegroundService? = null
    private var isBound = false

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(className: ComponentName, service: IBinder) {
            val binder = service as TTSForegroundService.TTSBinder
            ttsService = binder.getService()
            ttsService?.setTTSListener(this@TTSHighlightModule)
            isBound = true
        }

        override fun onServiceDisconnected(arg0: ComponentName) {
            isBound = false
            ttsService = null
        }
    }

    init {
        val intent = Intent(reactContext, TTSForegroundService::class.java)
        reactContext.bindService(intent, connection, Context.BIND_AUTO_CREATE)
    }

    override fun getName(): String {
        return "TTSHighlight"
    }

    @ReactMethod
    fun speak(text: String, params: ReadableMap, promise: Promise) {
        if (!isBound || ttsService == null) {
            // Try to rebind
            val intent = Intent(reactContext, TTSForegroundService::class.java)
            reactContext.bindService(intent, connection, Context.BIND_AUTO_CREATE)
            promise.reject("TTS_NOT_READY", "TTS Service is not bound yet. Retrying...")
            return
        }

        val utteranceId = if (params.hasKey("utteranceId")) params.getString("utteranceId")!!
        else System.currentTimeMillis().toString()

        val rate = if (params.hasKey("rate")) params.getDouble("rate").toFloat() else 1.0f
        val pitch = if (params.hasKey("pitch")) params.getDouble("pitch").toFloat() else 1.0f
        val voiceId = if (params.hasKey("voice")) params.getString("voice") else null

        val success = ttsService?.speak(text, utteranceId, rate, pitch, voiceId) ?: false
        
        if (success) {
            promise.resolve(utteranceId)
        } else {
            promise.reject("TTS_ERROR", "Failed to start TTS. Service might not be ready.")
        }
    }
    
    @ReactMethod
    fun speakBatch(texts: ReadableArray, utteranceIds: ReadableArray, params: ReadableMap, promise: Promise) {
        if (!isBound || ttsService == null) {
            promise.reject("TTS_NOT_READY", "TTS Service is not bound")
            return
        }
        
        val rate = if (params.hasKey("rate")) params.getDouble("rate").toFloat() else 1.0f
        val pitch = if (params.hasKey("pitch")) params.getDouble("pitch").toFloat() else 1.0f
        val voiceId = if (params.hasKey("voice")) params.getString("voice") else null
        
        val textList = mutableListOf<String>()
        val utteranceIdList = mutableListOf<String>()
        
        for (i in 0 until texts.size()) {
            texts.getString(i)?.let { text ->
                val utteranceId = utteranceIds.getString(i) ?: "utterance_$i"
                textList.add(text)
                utteranceIdList.add(utteranceId)
            }
        }
        
        val success = ttsService?.speakBatch(textList, utteranceIdList, rate, pitch, voiceId) ?: false
        
        if (success) {
            promise.resolve(textList.size)
        } else {
            promise.reject("TTS_ERROR", "Failed to start batch TTS")
        }
    }
    
    @ReactMethod
    fun addToBatch(texts: ReadableArray, utteranceIds: ReadableArray, promise: Promise) {
        if (!isBound || ttsService == null) {
            promise.reject("TTS_NOT_READY", "TTS Service is not bound")
            return
        }
        
        val textList = mutableListOf<String>()
        val utteranceIdList = mutableListOf<String>()
        
        for (i in 0 until texts.size()) {
            texts.getString(i)?.let { text ->
                val utteranceId = utteranceIds.getString(i) ?: "utterance_$i"
                textList.add(text)
                utteranceIdList.add(utteranceId)
            }
        }
        
        val success = ttsService?.addToBatch(textList, utteranceIdList) ?: false
        
        if (success) {
            promise.resolve(true)
        } else {
            promise.reject("TTS_ERROR", "Failed to add to batch")
        }
    }
    
    @ReactMethod
    fun getQueueSize(promise: Promise) {
        if (isBound && ttsService != null) {
            promise.resolve(ttsService?.getQueueSize() ?: 0)
        } else {
            promise.reject("TTS_NOT_READY", "TTS Service is not bound")
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        if (isBound && ttsService != null) {
            ttsService?.stopTTS()
            promise.resolve(true)
        } else {
            promise.reject("TTS_NOT_READY", "TTS Service is not bound")
        }
    }

    @ReactMethod
    fun pause(promise: Promise) {
        stop(promise)
    }

    @ReactMethod
    fun getVoices(promise: Promise) {
        if (isBound && ttsService != null) {
            try {
                val voices = ttsService?.getVoices() ?: emptyList()
                val voiceArray = Arguments.createArray()

                for (voice in voices) {
                    val voiceMap = Arguments.createMap()
                    voiceMap.putString("identifier", voice.name)
                    voiceMap.putString("name", voice.name)
                    voiceMap.putString("language", voice.locale.toLanguageTag())
                    voiceMap.putString("quality", voice.quality.toString())
                    voiceArray.pushMap(voiceMap)
                }
                promise.resolve(voiceArray)
            } catch (e: Exception) {
                promise.reject("GET_VOICES_ERROR", e.message)
            }
        } else {
            promise.reject("TTS_NOT_READY", "TTS Service is not bound")
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Keep: Required for RN built-in Event Emitter Calls.
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Keep: Required for RN built-in Event Emitter Calls.
    }

    // TTSListener implementation
    override fun onSpeechStart(utteranceId: String) {
        val params = Arguments.createMap()
        params.putString("utteranceId", utteranceId)
        sendEvent("onSpeechStart", params)
    }

    override fun onSpeechDone(utteranceId: String) {
        val params = Arguments.createMap()
        params.putString("utteranceId", utteranceId)
        sendEvent("onSpeechDone", params)
    }

    override fun onSpeechError(utteranceId: String) {
        val params = Arguments.createMap()
        params.putString("utteranceId", utteranceId)
        sendEvent("onSpeechError", params)
    }

    override fun onWordRange(utteranceId: String, start: Int, end: Int, frame: Int) {
        val params = Arguments.createMap()
        params.putString("utteranceId", utteranceId)
        params.putInt("start", start)
        params.putInt("end", end)
        params.putInt("frame", frame)
        sendEvent("onWordRange", params)
    }

    override fun onQueueEmpty() {
        val params = Arguments.createMap()
        sendEvent("onQueueEmpty", params)
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        if (reactContext.hasActiveCatalystInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }

    override fun onCatalystInstanceDestroy() {
        if (isBound) {
            reactContext.unbindService(connection)
            isBound = false
        }
        super.onCatalystInstanceDestroy()
    }
}
