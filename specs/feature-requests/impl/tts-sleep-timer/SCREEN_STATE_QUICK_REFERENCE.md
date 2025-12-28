# Screen State Detection - Quick Reference

## Implementation Complete ✅

Native Android module to detect screen ON/OFF events (power button, auto-lock).

---

## Quick Start

```typescript
import ScreenStateListener from '@utils/ScreenStateListener';

// In your component
useEffect(() => {
  const subscription = ScreenStateListener.addListener((isScreenOn) => {
    if (isScreenOn) {
      console.log('Screen ON');
    } else {
      console.log('Screen OFF - power button or timeout');
    }
  });

  return () => subscription.remove();
}, []);
```

---

## Files Modified/Created

### Native Android (Kotlin)
- ✅ `android/.../ScreenStateListener/ScreenStateListener.kt` - Native module
- ✅ `android/.../ScreenStateListener/ScreenStateListenerPackage.kt` - Package
- ✅ `android/.../MainApplication.kt` - Package registration

### React Native (TypeScript)
- ✅ `src/utils/ScreenStateListener.ts` - JS interface
- ✅ `src/services/tts/AutoStopService.ts` - Updated to use screen detection
- ✅ `src/examples/ScreenStateListenerExamples.tsx` - Usage examples
- ✅ `docs/SCREEN_STATE_DETECTION.md` - Full documentation

---

## Build & Test

```bash
# Clean build
cd android && ./gradlew clean && cd ..

# Build release APK
pnpm run build:release:android

# Install and test
# - Press power button → Should detect screen OFF
# - Unlock device → Should detect screen ON
# - Let screen timeout → Should detect screen OFF
```

---

## API

### `addListener(callback)`
```typescript
const subscription = ScreenStateListener.addListener((isScreenOn: boolean) => {
  // Handle screen state change
});

subscription.remove(); // Clean up
```

### `stopListening()`
```typescript
ScreenStateListener.stopListening(); // Manually stop (rarely needed)
```

### `isActive()`
```typescript
const isActive = ScreenStateListener.isActive(); // true/false
```

---

## Key Differences: AppState vs ScreenStateListener

| Event | AppState | ScreenStateListener |
|-------|----------|---------------------|
| Press power button | ❌ No event | ✅ Detects OFF |
| Screen timeout | ❌ No event | ✅ Detects OFF |
| Press home button | ✅ background | ❌ No event |
| Switch apps | ✅ background | ❌ No event |
| Lock screen | ❌ No event | ✅ Detects OFF |
| Unlock screen | ✅ active | ✅ Detects ON |

**Best practice:** Use BOTH for complete coverage.

---

## AutoStopService Integration

The TTS AutoStopService now uses **real screen detection** instead of AppState:

```typescript
// Old (AppState) - Only detected app background/foreground
AppState.addEventListener('change', ...) 

// New (ScreenStateListener) - Detects actual screen power events
ScreenStateListener.addListener(...)
```

**Behavior:**
- Timer/counters only start when screen turns OFF
- Timer/counters reset when screen turns ON
- Works correctly with power button and screen timeout

---

## Gotchas

### ⚠️ Android Only
iOS doesn't provide access to screen power events. Use AppState as fallback.

### ⚠️ App Must Be Running
If Android kills the app (memory pressure), listener stops.

### ⚠️ Multiple Listeners
Each component can add its own listener - they're independent. Always clean up:
```typescript
return () => subscription.remove();
```

---

## Troubleshooting

### Module not found
```bash
# Clean and rebuild
cd android && ./gradlew clean
pnpm run build:release:android
```

### Events not firing
```bash
# Check logs
adb logcat | grep ScreenStateListener

# Check if active
console.log(ScreenStateListener.isActive());
```

---

## Documentation

**Full guide:** [docs/SCREEN_STATE_DETECTION.md](./SCREEN_STATE_DETECTION.md)

**Examples:** [src/examples/ScreenStateListenerExamples.tsx](../src/examples/ScreenStateListenerExamples.tsx)

---

## Testing Checklist

- [ ] Build release APK without errors
- [ ] Install on physical device
- [ ] Add test listener with Alert/console.log
- [ ] Press power button → Screen OFF event fires
- [ ] Press power button again → Screen ON event fires
- [ ] Let screen timeout → Screen OFF event fires
- [ ] Unlock screen → Screen ON event fires
- [ ] Verify no memory leaks (remove subscriptions)

---

## Next Steps

1. **Build:** `pnpm run build:release:android`
2. **Install:** Transfer APK to device
3. **Test:** Verify screen events fire correctly
4. **Integrate:** Use in your TTS or other features
5. **Monitor:** Check battery impact over time

---

## Support

- React Native version: 0.82.1
- Minimum Android API: 21 (Android 5.0)
- Tested on Android 11-14
- No iOS support (platform limitation)
