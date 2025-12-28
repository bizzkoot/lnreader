# ✅ Implementation Checklist - Screen State Detection

## Pre-Build Verification

- [x] Native module created (`ScreenStateListener.kt`)
- [x] Package registered (`ScreenStateListenerPackage.kt`)
- [x] Package added to `MainApplication.kt`
- [x] TypeScript interface created (`ScreenStateListener.ts`)
- [x] AutoStopService updated to use screen detection
- [x] Type check passed (`pnpm run type-check`)
- [x] Lint passed (`pnpm run lint`)
- [x] Documentation created (3 files)
- [x] Usage examples created

## Build & Deploy

- [ ] **Clean build:** `cd android && ./gradlew clean && cd ..`
- [ ] **Build release APK:** `pnpm run build:release:android`
- [ ] **Check for build errors** in Gradle output
- [ ] **Verify APK created:** `android/app/build/outputs/apk/release/`
- [ ] **Transfer APK to device**
- [ ] **Install APK** on physical device

## Basic Testing

- [ ] **App launches** without crashes
- [ ] **Add test listener** (see code below)
- [ ] **Press power button** → Alert shows "Screen OFF"
- [ ] **Press power button again** → Alert shows "Screen ON"
- [ ] **Let screen timeout** → Alert shows "Screen OFF"
- [ ] **Unlock screen** → Alert shows "Screen ON"
- [ ] **Remove listener** → No more alerts

### Test Code

```typescript
// Add this temporarily to any screen (e.g., HomeScreen, ReaderScreen)
import { useEffect } from 'react';
import { Alert } from 'react-native';
import ScreenStateListener from '@utils/ScreenStateListener';

// In your component:
useEffect(() => {
  const subscription = ScreenStateListener.addListener((isScreenOn) => {
    Alert.alert('Screen State', isScreenOn ? '✅ ON' : '🔒 OFF');
  });

  return () => subscription.remove();
}, []);
```

## TTS AutoStop Testing

- [ ] **Enable TTS auto-stop** (e.g., "Stop after 1 minute with screen off")
- [ ] **Start TTS playback**
- [ ] **Turn screen OFF** (power button)
- [ ] **Wait 1 minute** → TTS should stop
- [ ] **Test again but turn screen ON** within 1 minute → Timer should reset
- [ ] **Verify counters reset** when screen turns on

## Advanced Testing

- [ ] **Multiple listeners:** Add 2+ listeners, verify all fire
- [ ] **Cleanup test:** Remove subscriptions, verify no memory leaks
- [ ] **Background test:** Put app in background, turn screen off/on
- [ ] **Foreground test:** Keep app in foreground, turn screen off/on
- [ ] **Lock screen test:** Let device lock, unlock, verify events

## Performance Testing

- [ ] **Monitor battery** usage over 24 hours
- [ ] **Check for memory leaks** (Android Studio Profiler)
- [ ] **Verify no excessive CPU** usage
- [ ] **Test with multiple components** using listener

## Edge Cases

- [ ] **App restart:** Verify listener starts correctly
- [ ] **Rapid screen on/off:** Toggle power button quickly
- [ ] **Screen rotation:** Rotate device while screen events happening
- [ ] **Low battery mode:** Test with battery saver enabled
- [ ] **Do Not Disturb mode:** Verify still works

## Debugging Tools

### Check if listener is active
```typescript
console.log('Active?', ScreenStateListener.isActive());
```

### View native logs
```bash
adb logcat | grep ScreenStateListener
```

### Monitor system broadcasts
```bash
adb logcat | grep "ACTION_SCREEN"
```

### Check app logs
```bash
adb logcat | grep "ReactNativeJS"
```

## Troubleshooting

### Issue: "ScreenStateListener is not defined"

**Solution:**
```bash
cd android && ./gradlew clean
cd .. && pnpm run build:release:android
```

### Issue: Events not firing

**Checks:**
1. Is listener active? `ScreenStateListener.isActive()`
2. Did you add listener? `addListener(...)`
3. Check native logs: `adb logcat | grep ScreenStateListener`

### Issue: Multiple events firing

**Solution:**
- Ensure cleanup: `return () => subscription.remove();`
- Check you're not adding multiple listeners unintentionally

### Issue: App crashes on launch

**Checks:**
1. Verify package registered in `MainApplication.kt`
2. Check Gradle build logs for errors
3. Ensure Kotlin files compiled correctly

## Production Readiness

- [ ] **Remove test code** (Alert-based listeners)
- [ ] **Verify no console.log** in production code
- [ ] **Test on multiple devices** (different Android versions)
- [ ] **Document usage** for team members
- [ ] **Monitor crash reports** (first week)
- [ ] **Track battery metrics** in analytics

## Documentation Review

- [ ] Read `docs/SCREEN_STATE_DETECTION.md` (comprehensive guide)
- [ ] Read `docs/SCREEN_STATE_QUICK_REFERENCE.md` (quick start)
- [ ] Read `docs/SCREEN_STATE_ARCHITECTURE.md` (system design)
- [ ] Review `src/examples/ScreenStateListenerExamples.tsx` (usage patterns)

## Post-Deployment

- [ ] **Monitor user feedback** for battery drain reports
- [ ] **Check crash analytics** for any native module issues
- [ ] **Track feature usage** (if analytics enabled)
- [ ] **Update docs** if any issues found

---

## Quick Commands Reference

```bash
# Type check
pnpm run type-check

# Lint
pnpm run lint

# Clean build
cd android && ./gradlew clean && cd ..

# Build release
pnpm run build:release:android

# View logs
adb logcat | grep ScreenStateListener
adb logcat | grep ReactNativeJS

# Check connected devices
adb devices

# Install APK
adb install android/app/build/outputs/apk/release/app-release.apk
```

---

## Success Criteria

✅ **Implementation complete when:**

1. APK builds without errors
2. App launches successfully
3. Screen OFF events detected (power button)
4. Screen ON events detected (unlock)
5. Screen timeout detected
6. AutoStop timer works correctly
7. No memory leaks
8. No battery drain
9. No crashes
10. All tests passed

---

## Timeline

| Task | Est. Time | Status |
|------|-----------|--------|
| Code implementation | 30 min | ✅ DONE |
| Type check & lint | 5 min | ✅ DONE |
| Build APK | 5-10 min | ⏳ TODO |
| Install on device | 2 min | ⏳ TODO |
| Basic testing | 10 min | ⏳ TODO |
| TTS testing | 10 min | ⏳ TODO |
| Edge case testing | 15 min | ⏳ TODO |
| **TOTAL** | **~1 hour** | **IN PROGRESS** |

---

## Support

**Documentation:**
- Full guide: `docs/SCREEN_STATE_DETECTION.md`
- Quick ref: `docs/SCREEN_STATE_QUICK_REFERENCE.md`
- Architecture: `docs/SCREEN_STATE_ARCHITECTURE.md`
- Examples: `src/examples/ScreenStateListenerExamples.tsx`

**Questions?**
- Check troubleshooting section in docs
- Review usage examples
- Enable debug logging (`adb logcat`)

---

*Last updated: December 28, 2025*  
*Status: Ready for build & test*
