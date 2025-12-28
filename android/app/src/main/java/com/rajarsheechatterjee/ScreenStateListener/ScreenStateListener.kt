package com.rajarsheechatterjee.ScreenStateListener

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Native module to detect Android screen ON/OFF events.
 * Uses BroadcastReceiver to listen to ACTION_SCREEN_OFF and ACTION_SCREEN_ON.
 * 
 * Events emitted:
 * - "screenStateChanged" with { isScreenOn: boolean }
 */
class ScreenStateListener(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val MODULE_NAME = "ScreenStateListener"
        const val EVENT_SCREEN_STATE_CHANGED = "screenStateChanged"
        private const val TAG = "ScreenStateListener"
        private var isListening = false
    }

    private var screenReceiver: BroadcastReceiver? = null
    private var listenerCount = 0

    override fun getName(): String = MODULE_NAME

    /**
     * Required for NativeEventEmitter.
     * Called when JavaScript adds a listener.
     */
    @ReactMethod
    fun addListener(eventName: String) {
        listenerCount += 1
        Log.d(TAG, "addListener called: eventName=$eventName, count=$listenerCount")
    }

    /**
     * Required for NativeEventEmitter.
     * Called when JavaScript removes listeners.
     */
    @ReactMethod
    fun removeListeners(count: Int) {
        listenerCount -= count
        if (listenerCount <= 0) {
            listenerCount = 0
        }
        Log.d(TAG, "removeListeners called: count=$count, remaining=$listenerCount")
    }

    /**
     * Start listening to screen state changes.
     * Safe to call multiple times - will only register receiver once.
     */
    @ReactMethod
    fun startListening() {
        Log.d(TAG, "startListening called, isListening=$isListening")
        
        if (isListening) {
            Log.d(TAG, "Already listening, skipping")
            return
        }

        val reactContext = reactApplicationContext
        if (reactContext == null) {
            Log.e(TAG, "reactApplicationContext is null!")
            return
        }

        screenReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                Log.d(TAG, "BroadcastReceiver.onReceive: action=${intent?.action}")
                when (intent?.action) {
                    Intent.ACTION_SCREEN_OFF -> {
                        Log.d(TAG, "Screen OFF detected, sending event")
                        sendEvent(false)
                    }
                    Intent.ACTION_SCREEN_ON -> {
                        Log.d(TAG, "Screen ON detected, sending event")
                        sendEvent(true)
                    }
                }
            }
        }

        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_OFF)
            addAction(Intent.ACTION_SCREEN_ON)
        }

        try {
            // Android 14+ requires RECEIVER_NOT_EXPORTED for non-system broadcasts
            // But screen ON/OFF are system broadcasts, so we use RECEIVER_EXPORTED
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                reactContext.registerReceiver(screenReceiver, filter, Context.RECEIVER_EXPORTED)
            } else {
                reactContext.registerReceiver(screenReceiver, filter)
            }
            isListening = true
            Log.d(TAG, "BroadcastReceiver registered successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to register BroadcastReceiver", e)
            screenReceiver = null
            isListening = false
        }
    }

    /**
     * Stop listening to screen state changes.
     * Safe to call multiple times.
     */
    @ReactMethod
    fun stopListening() {
        Log.d(TAG, "stopListening called, isListening=$isListening")
        if (!isListening || screenReceiver == null) return

        try {
            reactApplicationContext?.unregisterReceiver(screenReceiver)
            Log.d(TAG, "BroadcastReceiver unregistered successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to unregister BroadcastReceiver", e)
        } finally {
            screenReceiver = null
            isListening = false
        }
    }

    /**
     * Check if currently listening for screen events.
     */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun isActive(): Boolean {
        Log.d(TAG, "isActive called, returning $isListening")
        return isListening
    }

    /**
     * Send screen state event to React Native.
     */
    private fun sendEvent(isScreenOn: Boolean) {
        Log.d(TAG, "sendEvent: isScreenOn=$isScreenOn")
        try {
            reactApplicationContext
                ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit(EVENT_SCREEN_STATE_CHANGED, isScreenOn)
            Log.d(TAG, "Event emitted successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to emit event", e)
        }
    }

    /**
     * Clean up receiver when module is destroyed.
     */
    override fun invalidate() {
        Log.d(TAG, "invalidate called, cleaning up")
        stopListening()
        super.invalidate()
    }
}
