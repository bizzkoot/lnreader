# Android Screen State Detection - Implementation Guide

## Overview

Native Android module to detect **actual screen power-off events** (not just app background state). Uses `BroadcastReceiver` to listen to `ACTION_SCREEN_OFF` and `ACTION_SCREEN_ON` system broadcasts.

## Problem Solved

React Native's `AppState` only detects when the app goes to background/foreground (e.g., user presses home button). It **does NOT detect** when:
- User presses the power button to turn screen off
- Screen auto-locks after timeout
- Screen turns on from lock screen

This module solves that by listening to Android system broadcasts.

---

## Files Created

### 1. Native Android Module
- **`android/.../ScreenStateListener/ScreenStateListener.kt`**
  - Kotlin native module using BroadcastReceiver
  - Listens to `Intent.ACTION_SCREEN_OFF` and `Intent.ACTION_SCREEN_ON`
  - Emits events to React Native JavaScript layer

- **`android/.../ScreenStateListener/ScreenStateListenerPackage.kt`**
  - Package registration for React Native

### 2. React Native Interface
- **`src/utils/ScreenStateListener.ts`**
  - TypeScript wrapper for native module
  - Type-safe event listener interface
  - Auto-starts/stops native listener

### 3. Integration
- **`android/.../MainApplication.kt`**
  - Registered `ScreenStateListenerPackage` in packages list

- **`src/services/tts/AutoStopService.ts`**
  - Updated to use real screen detection instead of AppState
  - Maintains AppState as fallback for iOS compatibility

---

## API Reference

### `ScreenStateListener.addListener(callback)`

Add listener for screen state changes.

```typescript
const subscription = ScreenStateListener.addListener((isScreenOn: boolean) => {
  if (isScreenOn) {
    console.log('Screen ON');
  } else {
    console.log('Screen OFF');
  }
});

// Clean up
subscription.remove();
```

**Parameters:**
- `callback: (isScreenOn: boolean) => void` - Called when screen state changes

**Returns:**
- `EmitterSubscription` - Subscription object with `remove()` method

**Behavior:**
- Automatically starts native listener when first listener is added
- Safe to call multiple times - won't duplicate listeners
- Native listener stops when all JS listeners are removed

### `ScreenStateListener.stopListening()`

Manually stop native listener (usually not needed).

```typescript
ScreenStateListener.stopListening();
```

### `ScreenStateListener.isActive()`

Check if native listener is active.

```typescript
const isListening = ScreenStateListener.isActive();
console.log('Is monitoring?', isListening);
```

**Returns:** `boolean`

---

## Usage Examples

### Basic Usage

```typescript
import { useEffect } from 'react';
import ScreenStateListener from '@utils/ScreenStateListener';

export function MyComponent() {
  useEffect(() => {
    const subscription = ScreenStateListener.addListener((isScreenOn) => {
      console.log('Screen state:', isScreenOn ? 'ON' : 'OFF');
    });

    return () => subscription.remove();
  }, []);

  return null;
}
```

### TTS Auto-Stop (30 min after screen off)

```typescript
useEffect(() => {
  let timer: NodeJS.Timeout | null = null;

  const subscription = ScreenStateListener.addListener((isScreenOn) => {
    if (!isScreenOn) {
      // Start 30-minute timer
      timer = setTimeout(() => {
        console.log('Stopping TTS - screen off for 30 min');
        TTSService.stop();
      }, 30 * 60 * 1000);
    } else {
      // Cancel timer if screen turns on
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }
  });

  return () => {
    if (timer) clearTimeout(timer);
    subscription.remove();
  };
}, []);
```

### Track Screen Off Duration

```typescript
useEffect(() => {
  let startTime: number | null = null;

  const subscription = ScreenStateListener.addListener((isScreenOn) => {
    if (!isScreenOn) {
      startTime = Date.now();
    } else if (startTime) {
      const duration = Date.now() - startTime;
      console.log(`Screen was off for ${Math.floor(duration / 1000)}s`);
      startTime = null;
    }
  });

  return () => subscription.remove();
}, []);
```

---

## Implementation Details

### How It Works

1. **Native Layer (Kotlin):**
   - Registers `BroadcastReceiver` for `ACTION_SCREEN_OFF` and `ACTION_SCREEN_ON`
   - When broadcast received, emits event to React Native with boolean value
   - Uses `ReactApplicationContext` to register/unregister receiver
   - Automatically cleans up on module invalidation

2. **JavaScript Layer (TypeScript):**
   - Wraps native module with type-safe interface
   - Uses `NativeEventEmitter` to listen to native events
   - Auto-starts native listener when first JS listener is added
   - Manages subscription lifecycle

### Event Flow

```
Android System Broadcast (ACTION_SCREEN_OFF)
    ↓
BroadcastReceiver.onReceive()
    ↓
screenReceiver emits "screenStateChanged" event
    ↓
NativeEventEmitter propagates to JS
    ↓
Your callback receives isScreenOn=false
```

### Memory Management

- **Native listener** is a singleton (static `isListening` flag)
- Only one `BroadcastReceiver` registered at a time
- Automatically unregisters when module is destroyed
- JavaScript subscriptions are independent - each component can add its own

---

## Gotchas & Limitations

### ✅ What Works

- Detects power button press (screen off)
- Detects screen auto-lock after timeout
- Works while app is in foreground
- Works while app is in background (if not killed)
- Multiple listeners supported
- Low battery impact (passive system broadcast)

### ❌ Limitations

1. **Android Only**
   - iOS doesn't provide access to screen power events
   - App is suspended when screen locks on iOS
   - Use `AppState` as fallback on iOS

2. **App Must Be Running**
   - If Android kills the app (memory pressure), listener stops
   - Receiver won't detect screen events when app is not running
   - Use `WorkManager` or `JobScheduler` for background work after app death

3. **Battery Optimization**
   - Aggressive battery savers may delay/drop broadcasts
   - `ACTION_SCREEN_OFF` is usually exempt from battery restrictions
   - Still, not 100% guaranteed delivery

4. **React Native 0.73+ Changes**
   - RN 0.73+ changed some native module registration patterns
   - This implementation tested on RN 0.82.1
   - May need minor adjustments for older/newer versions

---

## Testing

### Manual Testing

1. **Build and install app:**
   ```bash
   pnpm run build:release:android
   ```

2. **Add test listener in your app:**
   ```typescript
   useEffect(() => {
     const sub = ScreenStateListener.addListener((isOn) => {
       Alert.alert('Screen State', isOn ? 'ON' : 'OFF');
     });
     return () => sub.remove();
   }, []);
   ```

3. **Test scenarios:**
   - Press power button → Should show "OFF" alert
   - Press power button again → Should show "ON" alert
   - Let screen timeout → Should show "OFF" alert
   - Unlock screen → Should show "ON" alert

### ADB Testing

Monitor broadcasts via adb:

```bash
# Watch for screen broadcasts
adb logcat | grep "ACTION_SCREEN"

# Simulate screen off (won't trigger listener, but confirms broadcast exists)
adb shell input keyevent KEYCODE_POWER
```

### Debugging

Enable logging in native module:

```kotlin
// In ScreenStateListener.kt
private fun sendEvent(isScreenOn: Boolean) {
    android.util.Log.d("ScreenStateListener", "Screen state: $isScreenOn")
    // ... rest of code
}
```

View logs:
```bash
adb logcat | grep ScreenStateListener
```

---

## Comparison: AppState vs ScreenStateListener

| Feature | AppState | ScreenStateListener |
|---------|----------|---------------------|
| Detects home button | ✅ | ❌ |
| Detects power button | ❌ | ✅ |
| Detects screen timeout | ❌ | ✅ |
| iOS support | ✅ | ❌ |
| Android support | ✅ | ✅ |
| Background detection | Limited | ✅ |
| Battery impact | Negligible | Negligible |
| React Native API | Built-in | Custom native module |

### Recommendation

**Use BOTH for best coverage:**

```typescript
// For Android: Use ScreenStateListener (accurate screen power detection)
// For iOS: Use AppState (only option available)
// Keep AppState as fallback in case native module fails

useEffect(() => {
  // Primary: Native screen detection (Android)
  const screenSub = ScreenStateListener.addListener(handleScreenChange);
  
  // Fallback: AppState (iOS + Android backup)
  const appStateSub = AppState.addEventListener('change', handleAppStateChange);
  
  return () => {
    screenSub.remove();
    appStateSub.remove();
  };
}, []);
```

---

## Troubleshooting

### "ScreenStateListener is not defined"

**Cause:** Native module not linked or not built.

**Solution:**
1. Verify package is registered in `MainApplication.kt`
2. Clean build:
   ```bash
   cd android && ./gradlew clean
   cd .. && pnpm run build:release:android
   ```
3. Check for build errors in Gradle output

### Events not firing

**Cause:** Listener not started or receiver not registered.

**Solution:**
1. Check if listener is active:
   ```typescript
   console.log('Is active?', ScreenStateListener.isActive());
   ```
2. Verify native logs:
   ```bash
   adb logcat | grep ScreenStateListener
   ```
3. Ensure you're calling `addListener()` after app is mounted

### Multiple events fired

**Cause:** Multiple listeners registered without cleanup.

**Solution:**
- Always remove subscription in cleanup function:
  ```typescript
  useEffect(() => {
    const sub = ScreenStateListener.addListener(handler);
    return () => sub.remove(); // ← CRITICAL
  }, []);
  ```

---

## Alternative Approaches

### 1. React Native Library (NOT FOUND)

Searched npm for existing libraries - **none found** that reliably detect screen off on modern React Native versions.

Libraries like `react-native-device-power` are abandoned and don't work on RN 0.60+.

### 2. Wake Lock API

Android's `PowerManager.WakeLock` can **prevent** screen from turning off, but can't **detect** when it happens.

### 3. Proximity Sensor

Can detect when phone is near face (pocket), but not screen power state.

### 4. Headless JS Task

Can run JavaScript in background, but doesn't solve screen detection problem.

---

## Performance Impact

- **Memory:** ~1KB (single BroadcastReceiver instance)
- **CPU:** Negligible (only runs when screen state changes)
- **Battery:** Minimal (passive system broadcast, no polling)
- **Startup time:** No impact (lazy initialization)

---

## Future Enhancements

Potential improvements:

1. **Add TypeScript types for native module** (TurboModules)
2. **Support for display brightness changes** (if needed)
3. **Detect "AOD" (Always On Display) state** on supported devices
4. **Add promise-based sync method** to get current screen state
5. **iOS no-op implementation** for cross-platform consistency

---

## References

- [Android BroadcastReceiver Guide](https://developer.android.com/guide/components/broadcasts)
- [Intent.ACTION_SCREEN_OFF](https://developer.android.com/reference/android/content/Intent#ACTION_SCREEN_OFF)
- [React Native Native Modules (Android)](https://reactnative.dev/docs/native-modules-android)
- [React Native NativeEventEmitter](https://reactnative.dev/docs/nativeeventemitter)

---

## License

Part of LNReader project - same license as main app.
