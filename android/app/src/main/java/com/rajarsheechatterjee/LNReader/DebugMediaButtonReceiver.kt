package com.rajarsheechatterjee.LNReader

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class DebugMediaButtonReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Log.d("TTS_DEBUG", "DebugMediaButtonReceiver onReceive action=${intent.action}")
        
        if (Intent.ACTION_MEDIA_BUTTON == intent.action) {
            val event = intent.getParcelableExtra<android.view.KeyEvent>(api = android.content.Intent.EXTRA_KEY_EVENT)
            Log.d("TTS_DEBUG", "DebugMediaButtonReceiver event=$event")
            
            if (event != null && event.action == android.view.KeyEvent.ACTION_DOWN) {
                // Forward specific actions to Service
                val serviceIntent = Intent(context, TTSForegroundService::class.java)
                
                when (event.keyCode) {
                    android.view.KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE,
                    android.view.KeyEvent.KEYCODE_HEADSETHOOK -> {
                        Log.d("TTS_DEBUG", "DebugMediaButtonReceiver forwarding PLAY_PAUSE")
                        serviceIntent.action = "com.rajarsheechatterjee.LNReader.TTS.PLAY_PAUSE"
                    }
                    android.view.KeyEvent.KEYCODE_MEDIA_PLAY -> {
                        Log.d("TTS_DEBUG", "DebugMediaButtonReceiver forwarding PLAY")
                        serviceIntent.action = "com.rajarsheechatterjee.LNReader.TTS.PLAY"
                    }
                    android.view.KeyEvent.KEYCODE_MEDIA_PAUSE -> {
                        Log.d("TTS_DEBUG", "DebugMediaButtonReceiver forwarding PAUSE")
                        serviceIntent.action = "com.rajarsheechatterjee.LNReader.TTS.PAUSE"
                    }
                    android.view.KeyEvent.KEYCODE_MEDIA_NEXT -> {
                        Log.d("TTS_DEBUG", "DebugMediaButtonReceiver forwarding NEXT")
                        serviceIntent.action = "com.rajarsheechatterjee.LNReader.TTS.NEXT_CHAPTER"
                    }
                    android.view.KeyEvent.KEYCODE_MEDIA_PREVIOUS -> {
                        Log.d("TTS_DEBUG", "DebugMediaButtonReceiver forwarding PREVIOUS")
                        serviceIntent.action = "com.rajarsheechatterjee.LNReader.TTS.PREV_CHAPTER"
                    }
                    else -> {
                        // Pass through other keys or ignore
                        Log.d("TTS_DEBUG", "DebugMediaButtonReceiver forwarding RAW event: ${event.keyCode}")
                        serviceIntent.action = intent.action
                        serviceIntent.putExtra(Intent.EXTRA_KEY_EVENT, event)
                    }
                }
                
                // Use startService (or startForegroundService for Android O+)
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
            } else {
                if (event == null) {
                    Log.w("TTS_DEBUG", "DebugMediaButtonReceiver received MEDIA_BUTTON without KeyEvent")
                }
            }
        }
    }
    
    // Helper for getParcelableExtra compatibility
    private inline fun <reified T : android.os.Parcelable> Intent.getParcelableExtra(api: String): T? {
        return if (android.os.Build.VERSION.SDK_INT >= 33) {
            getParcelableExtra(api, T::class.java)
        } else {
            @Suppress("DEPRECATION")
            getParcelableExtra(api)
        }
    }
}
