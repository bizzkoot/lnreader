package com.rajarsheechatterjee.LNReader;

import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import com.facebook.react.bridge.*;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public class TTSHighlightModule extends ReactContextBaseJavaModule {
    private TextToSpeech tts;
    private ReactContext reactContext;
    private boolean isTtsReady = false;

    public TTSHighlightModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
        initializeTTS();
    }

    @Override
    public String getName() {
        return "TTSHighlight";
    }

    private void initializeTTS() {
        tts = new TextToSpeech(getReactApplicationContext(), status -> {
            if (status == TextToSpeech.SUCCESS) {
                isTtsReady = true;
                setupProgressListener();
            } else {
                sendEvent("onSpeechError", createErrorMap("TTS Initialization failed"));
            }
        });
    }

    private void setupProgressListener() {
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override
            public void onRangeStart(String utteranceId, int start, int end, int frame) {
                WritableMap params = Arguments.createMap();
                params.putString("utteranceId", utteranceId);
                params.putInt("start", start);
                params.putInt("end", end);
                params.putInt("frame", frame);
                sendEvent("onWordRange", params);
            }

            @Override
            public void onStart(String utteranceId) {
                WritableMap params = Arguments.createMap();
                params.putString("utteranceId", utteranceId);
                sendEvent("onSpeechStart", params);
            }

            @Override
            public void onDone(String utteranceId) {
                WritableMap params = Arguments.createMap();
                params.putString("utteranceId", utteranceId);
                sendEvent("onSpeechDone", params);
            }

            @Override
            public void onError(String utteranceId) {
                WritableMap params = Arguments.createMap();
                params.putString("utteranceId", utteranceId);
                sendEvent("onSpeechError", params);
            }
        });
    }

    private void sendEvent(String eventName, WritableMap params) {
        if (reactContext.hasActiveCatalystInstance()) {
            reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit(eventName, params);
        }
    }

    private WritableMap createErrorMap(String message) {
        WritableMap map = Arguments.createMap();
        map.putString("error", message);
        return map;
    }

    @ReactMethod
    public void speak(String text, ReadableMap params, Promise promise) {
        if (!isTtsReady) {
            promise.reject("TTS_NOT_READY", "TTS is not initialized yet");
            return;
        }

        String utteranceId = params.hasKey("utteranceId") ? params.getString("utteranceId")
                : String.valueOf(System.currentTimeMillis());
        Bundle bundle = new Bundle();
        bundle.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId);

        if (params.hasKey("rate")) {
            tts.setSpeechRate((float) params.getDouble("rate"));
        }
        if (params.hasKey("pitch")) {
            tts.setPitch((float) params.getDouble("pitch"));
        }
        if (params.hasKey("voice")) {
            String voiceId = params.getString("voice");
            setVoice(voiceId);
        }

        int result = tts.speak(text, TextToSpeech.QUEUE_FLUSH, bundle, utteranceId);
        if (result == TextToSpeech.SUCCESS) {
            promise.resolve(utteranceId);
        } else {
            promise.reject("TTS_ERROR", "Failed to speak");
        }
    }

    @ReactMethod
    public void stop(Promise promise) {
        if (tts != null) {
            tts.stop();
            promise.resolve(true);
        } else {
            promise.reject("TTS_NOT_READY", "TTS is not initialized");
        }
    }

    @ReactMethod
    public void pause(Promise promise) {
        // Android TTS doesn't support pause natively in the same way, usually stop is
        // used.
        // But we can just stop for now.
        stop(promise);
    }

    @ReactMethod
    public void getVoices(Promise promise) {
        if (!isTtsReady) {
            promise.reject("TTS_NOT_READY", "TTS is not initialized");
            return;
        }

        try {
            Set<Voice> voices = tts.getVoices();
            WritableArray voiceArray = Arguments.createArray();

            for (Voice voice : voices) {
                WritableMap voiceMap = Arguments.createMap();
                voiceMap.putString("identifier", voice.getName());
                voiceMap.putString("name", voice.getName());
                voiceMap.putString("language", voice.getLocale().toLanguageTag());
                voiceMap.putString("quality", voice.getQuality() + "");
                voiceArray.pushMap(voiceMap);
            }
            promise.resolve(voiceArray);
        } catch (Exception e) {
            promise.reject("GET_VOICES_ERROR", e.getMessage());
        }
    }

    private void setVoice(String voiceId) {
        if (tts == null || voiceId == null)
            return;
        try {
            for (Voice voice : tts.getVoices()) {
                if (voice.getName().equals(voiceId)) {
                    tts.setVoice(voice);
                    break;
                }
            }
        } catch (Exception e) {
            // Ignore if voice setting fails
        }
    }

    @ReactMethod
    public void addListener(String eventName) {
        // Keep: Required for RN built-in Event Emitter Calls.
    }

    @ReactMethod
    public void removeListeners(Integer count) {
        // Keep: Required for RN built-in Event Emitter Calls.
    }

    @Override
    public void onCatalystInstanceDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
    }
}
