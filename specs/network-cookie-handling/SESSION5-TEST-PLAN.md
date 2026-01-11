# Session 5: Manual Integration Testing Plan

**Date**: January 2, 2026  
**Status**: Ready for User Execution  
**Platform**: Android (DoH not supported on iOS)

---

## Pre-Test Setup

1. **Build Debug APK**:
   ```bash
   cd /workspaces/lnreader
   pnpm run dev:android
   # OR
   cd android && ./gradlew clean assembleDebug
   ```

2. **Install on Device**:
   ```bash
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```

3. **Enable Developer Logging** (optional):
   ```bash
   adb logcat | grep "DoH"
   ```

---

## Test Scenarios

### ✅ Test 1: DoH Provider Selection (Cloudflare)

**Steps:**
1. Open LNReader app
2. Navigate: More → Settings → Advanced
3. Verify "DNS over HTTPS (Privacy)" section appears at top
4. Tap "DoH Provider" (should show "Disabled (System DNS)")
5. Verify modal opens with title "Select DoH Provider"
6. Verify 4 radio options displayed:
   - ☐ Disabled (System DNS) — "Use system DNS (default)"
   - ☐ Cloudflare (1.1.1.1) — "Fast and privacy-focused DNS with WARP network"
   - ☐ Google (8.8.8.8) — "Reliable DNS with global infrastructure"
   - ☐ AdGuard (94.140.14.140) — "Unfiltered DNS without ad blocking"
7. Select "Cloudflare (1.1.1.1)"
8. Modal closes automatically
9. Verify confirmation dialog appears: "⚠️ App restart required for changes to take effect."
10. Tap "Confirm"
11. Verify toast: "DoH provider changed. Please restart the app."
12. Verify "DoH Provider" now shows "Cloudflare (1.1.1.1)"

**Expected Result:**
- ✅ UI updates correctly
- ✅ No crashes
- ✅ Toast confirmation displayed

---

### ✅ Test 2: App Restart Persistence

**Steps:**
1. Force-close LNReader app (swipe from recents)
2. Reopen app
3. Navigate: More → Settings → Advanced
4. Verify "DoH Provider" shows "Cloudflare (1.1.1.1)" (persisted)

**Expected Result:**
- ✅ Provider selection persists after restart

---

### ✅ Test 3: Network Functionality with DoH Enabled

**Steps:**
1. With Cloudflare DoH enabled (from Test 1)
2. Navigate to Browse → Select any source
3. Browse popular novels (triggers DNS + HTTP requests)
4. Open a novel → Download a chapter
5. Verify chapter downloads successfully
6. Navigate: More → Settings → Advanced → Clear Cookies
7. Verify "Cookies cleared" toast appears

**Expected Result:**
- ✅ DNS resolution works via DoH
- ✅ Novel browsing works
- ✅ Chapter downloads work
- ✅ Cookie clearing works
- ✅ No network errors

---

### ✅ Test 4: Change Provider (Google)

**Steps:**
1. Navigate: More → Settings → Advanced
2. Tap "DoH Provider" (shows "Cloudflare (1.1.1.1)")
3. Select "Google (8.8.8.8)"
4. Tap "Confirm" on restart dialog
5. Verify toast: "DoH provider changed. Please restart the app."
6. Restart app
7. Navigate: More → Settings → Advanced
8. Verify "DoH Provider" shows "Google (8.8.8.8)"

**Expected Result:**
- ✅ Provider switches correctly
- ✅ Settings persist

---

### ✅ Test 5: Disable DoH

**Steps:**
1. Navigate: More → Settings → Advanced
2. Tap "DoH Provider"
3. Select "Disabled (System DNS)"
4. Tap "Confirm" on restart dialog
5. Verify toast
6. Restart app
7. Browse novels and download chapter
8. Verify "DoH Provider" shows "Disabled (System DNS)"

**Expected Result:**
- ✅ Fallback to system DNS works
- ✅ Network requests still work

---

### ✅ Test 6: Cancel Provider Change

**Steps:**
1. Navigate: More → Settings → Advanced
2. Tap "DoH Provider" (shows "Disabled (System DNS)")
3. Select "AdGuard (94.140.14.140)"
4. On restart dialog, tap "Cancel"
5. Verify "DoH Provider" still shows "Disabled (System DNS)" (reverted)
6. Reopen modal, verify "Disabled" is selected

**Expected Result:**
- ✅ Cancellation reverts selection
- ✅ No provider change applied

---

### ✅ Test 7: iOS Platform Detection (if iOS build available)

**Steps:**
1. Build iOS version (if supported)
2. Navigate: More → Settings → Advanced
3. Verify "DoH Provider" shows "DoH is only available on Android"
4. Verify item is disabled (no tap response)

**Expected Result:**
- ✅ iOS shows "Android-only" notice
- ✅ No crashes on iOS

---

### ✅ Test 8: Performance Baseline (Optional)

**Steps:**
1. Disable DoH
2. Navigate to Browse → Source → Search "test"
3. Time first search result load (baseline)
4. Enable Cloudflare DoH
5. Restart app
6. Repeat search, time first result load
7. Compare latency (expect <100ms overhead on first query)

**Expected Result:**
- ✅ Latency overhead acceptable (<100ms first query)
- ✅ Subsequent queries cached (no overhead)

---

## Success Criteria

- [ ] All 7-8 tests pass (iOS test optional)
- [ ] No crashes or errors
- [ ] DoH works with existing features (Cookie Manager, Cloudflare Bypass)
- [ ] Network requests function correctly with all providers
- [ ] Settings persist across app restarts

---

## Debugging Commands

```bash
# View DoH logs
adb logcat | grep "DoH"

# View network logs
adb logcat | grep "OkHttp"

# View app logs
adb logcat | grep "LNReader"

# Check SharedPreferences (DoH provider)
adb shell "run-as com.rajarsheechatterjee.LNReader cat /data/data/com.rajarsheechatterjee.LNReader/shared_prefs/doh_preferences.xml"
```

---

## Known Issues

1. **App Restart Required**: DoH changes require app restart (by design, matches yokai)
2. **iOS Not Supported**: Feature is Android-only
3. **First Query Latency**: 10-50ms overhead on first DNS query (cached afterward)

---

**Test Status**: ⏸️ Awaiting User Execution  
**Next Step**: After tests pass, proceed to Session 6 (Documentation & Commit)
