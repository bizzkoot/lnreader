# Commit Audit: v2.0.13 → HEAD

**Date:** December 31, 2025  
**Scope:** 21 commits since `chore(release): v2.0.13` (56a953c0)  
**Auditor:** AI Code Review Agent

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Commits | 21 |
| Features | 8 |
| Bug Fixes | 7 |
| Tests | 2 |
| Docs/Chores | 4 |
| Test Suite | **953/953 passed** |
| TypeScript | **0 errors** |
| ESLint | **Clean** |
| Overall Risk | **Medium** (new Bluetooth + auto-stop features) |
| Release Recommendation | **✅ GOOD TO RELEASE** |

---

## Detailed Commit Analysis

### Feature Commits

#### 1. `823d0c3d` - Bluetooth/Wired Headset Media Button Support
**Risk Level:** 🟡 Medium

**Files Changed:**
- `android/app/src/main/AndroidManifest.xml` (+18 lines)
- `android/app/src/main/java/.../TTSForegroundService.kt` (+11 lines)

**What It Does:**
- Adds `MediaButtonReceiver` to AndroidManifest.xml for receiving `MEDIA_BUTTON` intents
- Adds `MEDIA_BUTTON` intent-filter to TTSForegroundService
- Routes Bluetooth button events to MediaSessionCallback

**Implementation Details:**
```xml
<!-- MediaButtonReceiver for Bluetooth/wired headset media button support -->
<receiver
    android:name="androidx.media.session.MediaButtonReceiver"
    android:exported="true">
    <intent-filter>
        <action android:name="android.intent.action.MEDIA_BUTTON" />
    </intent-filter>
</receiver>
```

**Button Mapping:**
| Headset Action | TTS Action |
|----------------|------------|
| Play/Pause | ACTION_MEDIA_PLAY_PAUSE |
| Next | Next Chapter |
| Previous | Previous Chapter |
| Forward | Forward 5 paragraphs |
| Rewind | Rewind 5 paragraphs |

**Risk Assessment:**
- ✅ MediaSession NOT attached to notification (preserves 5-button UI)
- ✅ Initial state set to `STATE_PAUSED` (not `STATE_NONE`) for active session
- ⚠️ Requires real-device testing (emulator cannot test Bluetooth)
- ⚠️ Potential AudioFocus conflicts with other media apps

---

#### 2. `6af3f6c3` - Bluetooth Headset Support + Notification Fix
**Risk Level:** 🟡 Medium

**Files Changed:**
- `TTSForegroundService.kt` (+179 lines)
- `TTSMediaSessionTest.kt` (+287 lines) - New test file
- `TTSNotificationRedrawTest.kt` (+241 lines) - New test file

**What It Does:**
- Re-enables MediaSession for Bluetooth controls
- Implements AudioFocus management
- Fixes notification redraw flicker

**AudioFocus Implementation:**
```kotlin
// Request focus on TTS start
audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
    .setAudioAttributes(...)
    .setOnAudioFocusChangeListener(this)
    .build()

// Abandon focus on TTS stop
audioManager?.abandonAudioFocusRequest(audioFocusRequest!!)
```

**Notification Throttling:**
```kotlin
private var lastNotificationUpdateTime = 0L
private val NOTIFICATION_UPDATE_THROTTLE_MS = 500L // Max 2 updates/second
```

**Risk Assessment:**
- ✅ Comprehensive test coverage (287 + 241 lines of tests)
- ✅ Only redraws on meaningful state changes (play/pause, chapter change)
- ✅ Skips redraw for paragraph-only updates
- ⚠️ AudioFocus loss handling may pause TTS unexpectedly

---

#### 3. `4d8e3400` - TTS Auto-Stop with Screen State Detection
**Risk Level:** 🟡 Medium

**Files Changed:**
- `ScreenStateListener.kt` (+168 lines) - New native module
- `ScreenStateListenerPackage.kt` (+16 lines)
- `AutoStopService.ts` (+307 lines)
- `ScreenStateListener.ts` (+180 lines)
- Multiple test files and documentation

**Architecture:**

```
┌─────────────────────────────────────────────────────┐
│                  AutoStopService                    │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────┐   ┌─────────────────────────┐  │
│  │ ScreenStateListener │ │    AppState (fallback)  │  │
│  │    (Android)        │ │         (iOS)           │  │
│  └─────────────────┘   └─────────────────────────┘  │
├─────────────────────────────────────────────────────┤
│  Conservative Default: Assume screen ON until       │
│  explicit SCREEN_OFF event received                 │
└─────────────────────────────────────────────────────┘
```

**Native Implementation (Kotlin):**
```kotlin
class ScreenStateListener : ReactContextBaseJavaModule {
    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                Intent.ACTION_SCREEN_OFF -> emit(false)
                Intent.ACTION_SCREEN_ON -> emit(true)
            }
        }
    }
}
```

**Auto-Stop Modes:**
| Mode | Behavior | Trigger |
|------|----------|---------|
| `off` | Disabled | Never |
| `minutes` | Timer | 15/30/45/60 min |
| `chapters` | Counter | 1/3/5/10 chapters |
| `paragraphs` | Counter | 5/10/15/20/30 paragraphs |

**Risk Assessment:**
- ✅ 26 comprehensive tests cover all modes and edge cases
- ✅ Conservative default prevents false positives
- ⚠️ iOS uses AppState fallback (less accurate)
- ⚠️ Doze mode may delay BroadcastReceiver events

---

#### 4. `0a2756ee` - Auto-Stop Controls in TTS Bottom Sheet
**Risk Level:** 🟢 Low

**Files Changed:**
- `ReaderTTSTab.tsx` (+112 lines)

**What It Does:**
- Adds mode picker (Off, Time, Chapters, Paragraphs)
- Adds limit picker with dynamic options based on mode
- Syncs with global settings via `useChapterGeneralSettings`

**Risk Assessment:**
- ✅ UI only, no logic changes
- ✅ Uses existing settings infrastructure

---

#### 5. `f593fd06` - Sleep Timer → Auto-Stop Redesign
**Risk Level:** 🟡 Medium

**Files Changed:**
- `useSettings.ts` - Schema change
- `useTTSController.ts` - Integration
- `AccessibilityTab.tsx` - UI update
- Multiple spec files

**Settings Schema Change:**
```typescript
// Before
ttsSleepTimer: number; // minutes

// After
ttsAutoStopMode: 'off' | 'minutes' | 'chapters' | 'paragraphs';
ttsAutoStopAmount: number;
```

**Risk Assessment:**
- ✅ Backward compatible (defaults to 'off')
- ✅ MMKV handles missing keys gracefully
- ⚠️ Users with old settings will see auto-stop as "off" initially

---

#### 6. `200ac435` - Adopt Upstream PRs #1573 and #1599
**Risk Level:** 🟢 Low

**Files Changed:**
- `sanitizeChapterText.ts` - Allow 'style' on span
- `Epub.cpp` - Add `clean_summary()` function

**PR #1573 Change:**
```typescript
// Allow 'style' attribute on span for EPUB styling preservation
span: ['class', 'id', 'lang', 'style'],
```

**PR #1599 Change (C++):**
```cpp
std::string clean_summary(const std::string& summary) {
    // Strip HTML tags and convert entities (&amp; → &, etc.)
}
```

**Risk Assessment:**
- ✅ Well-tested upstream PRs
- ✅ Minimal code changes
- ⚠️ Native C++ change requires full rebuild

---

#### 7. `467a97dc` / `a19a0fa5` - Volume Button Offset Setting
**Risk Level:** 🟢 Low

**Files Changed:**
- `useSettings.ts` - Add `volumeButtonsOffset`
- `useChapter.ts` - Apply offset
- `NavigationTab.tsx` - UI control
- `styles.xml` - Splash screen animation

**What It Does:**
- Configurable scroll offset when using volume buttons to scroll
- Uses `defaultTo` for backward compatibility

**Risk Assessment:**
- ✅ Additive changes only
- ✅ Backward compatible

---

### Bug Fix Commits

#### 1. `5bcb6a9f` - Fix Stale Closure in TTS Progress Save
**Risk Level:** 🟢 Low (Critical Bug Fix)

**Problem:**
```typescript
// BEFORE (Bug)
const saveProgressFromRef = saveProgressRef.current; // Captured once at mount
onSpeechDone: () => {
    saveProgressFromRef(...); // Uses stale reference
}
```

**Solution:**
```typescript
// AFTER (Fixed)
onSpeechDone: () => {
    saveProgressRef.current(...); // Uses live reference
}
```

**Impact:**
- Progress was being saved to wrong chapter after navigation
- Now correctly saves to current chapter

---

#### 2. `00f2328e` - Keep Media Notification State in Sync
**Risk Level:** 🟢 Low

**Problem:** Play/Pause icon not updating reliably when pausing from notification

**Solution:**
- Throttle paragraph-only updates
- Don't mutate native play state during pause
- Let React Native control Play/Pause icon state

---

#### 3. `9ab5b1ac` - Eliminate Notification Flicker During Seek
**Risk Level:** 🟢 Low

**Problem:** Rewind 5 / Forward 5 caused notification flicker

**Root Cause Chain:**
1. `restartTtsFromParagraphIndex()` called `TTSHighlight.stop()`
2. `stop()` → `stopForegroundService()` → REMOVES notification
3. `speakBatch()` → `startForegroundService()` → CREATES notification

**Solution:**
- Remove `TTSHighlight.stop()` call from `restartTtsFromParagraphIndex()`
- `speakBatch()` already uses `QUEUE_FLUSH` mode to clear native queue

---

#### 4. `126363f0` - Restore Position After Pause from Notification
**Risk Level:** 🟢 Low

**Problem:** When user pauses from notification and returns to app, position not restored

**Root Cause:**
- AppState 'active' handler only checked `isTTSReadingRef.current`
- When paused, `isTTSReadingRef` is FALSE → wake sync skipped

**Solution:**
```typescript
// Handle paused state separately
} else if (isTTSPausedRef.current === true) {
    // Scroll to saved position
    // Highlight paragraph
    // Do NOT auto-resume (respect user's pause)
}
```

---

#### 5. `89b8e205` - Fix Three Auto-Stop Bugs
**Risk Level:** 🟢 Low

**Bug 1:** TTS not continuing to next chapter when auto-stop mode is 'off'
- Fixed queue-empty handler logic

**Bug 2:** Auto-stop settings not updating instantly
- Enhanced MMKV listener to update `chapterGeneralSettingsRef.current` immediately

**Bug 3:** Auto-stop during refill causes state errors
- Added `refillCancelled` flag to prevent invalid state transitions

---

#### 6. `07f7b424` - Fix MainActivity Startup Crash
**Risk Level:** 🟢 Low (Critical Bug Fix)

**Problem:**
```kotlin
// BEFORE (Crash)
window.insetsController?.setSystemBarsAppearance(...) // DecorView is NULL
super.onCreate(null)
```

**Solution:**
```kotlin
// AFTER (Fixed)
super.onCreate(null) // Initialize DecorView FIRST
window.insetsController?.setSystemBarsAppearance(...) // Now safe
```

---

#### 7. `ab193e22` - Fix Gradle and API Deprecation Warnings
**Risk Level:** 🟢 Low

**What It Does:**
- Fix Gradle Groovy DSL syntax for Gradle 10.0 compatibility
- Migrate to WindowInsetsController (Android R+)
- Add deprecation suppressions for React Native framework methods

**Warnings Resolved:** 15 → 0 (local code)

---

### Test Commits

#### 1. `9cc211db` - Implement Skipped Auto-Stop Mode Tests
- 4 tests in `useTTSController` for auto-stop modes
- 3 tests in `WebViewReader` for MMKV settings update
- Fixed `ScreenStateListener` mock

#### 2. `caf796ea` - Comprehensive AutoStopService Test Coverage
- Expanded from 5 to 26 tests
- Parametric testing with `it.each()` for all parameter values
- Coverage: all modes, invalid configs, lifecycle, edge cases

---

## Risk Matrix

| Area | Risk | Impact | Likelihood | Mitigation |
|------|------|--------|------------|------------|
| Bluetooth Integration | Medium | High | Low | Real-device testing needed |
| AudioFocus Conflicts | Medium | Medium | Medium | Proper focus handling implemented |
| Screen State Detection (iOS) | Medium | Low | Medium | AppState fallback works |
| Auto-Stop Schema Migration | Low | Low | Low | Defaults handle gracefully |
| Native C++ Changes | Low | Medium | Very Low | Upstream tested |
| Notification Flicker | Low | Low | Very Low | Throttling implemented |

---

## Dependency Changes

| Package | Change | Risk |
|---------|--------|------|
| `lottie-react-native` | Added ^5.1.3 | 🟢 Low - splash animation |

---

## Recommended Pre-Release Testing

### Priority 1: Bluetooth Testing (Real Device Required)
```
[ ] Connect Bluetooth headset
[ ] Start TTS playback
[ ] Test single tap (Play/Pause)
[ ] Test double tap (Next Chapter)
[ ] Test triple tap (Previous Chapter)
[ ] Disconnect headset mid-playback
[ ] Reconnect headset
```

### Priority 2: Auto-Stop Testing
```
[ ] Set mode to "minutes" (15)
[ ] Lock screen while TTS playing
[ ] Verify TTS stops after 15 min
[ ] Unlock screen, verify counters reset
[ ] Repeat for "paragraphs" and "chapters" modes
```

### Priority 3: Notification Behavior
```
[ ] Start TTS
[ ] Pull down notification
[ ] Test all 5 buttons (Prev Ch, Rewind, Play/Pause, Forward, Next Ch)
[ ] Verify no flicker during seek operations
[ ] Pause from notification, return to app, verify position restored
```

### Priority 4: Progress Save
```
[ ] Read chapter with TTS
[ ] Navigate to different chapter mid-TTS
[ ] Return to first chapter
[ ] Verify progress saved correctly
```

---

## Conclusion

### Strengths
1. **Excellent test coverage** - 953 tests, 26 new auto-stop tests
2. **Clean code quality** - 0 TypeScript errors, 0 ESLint issues
3. **Critical bug fixes** - MainActivity crash, progress save stale closure
4. **Backward compatibility** - All schema changes have safe defaults

### Areas for Attention
1. **Bluetooth integration** - New feature, requires real-device validation
2. **Screen state detection** - iOS relies on AppState fallback
3. **AudioFocus** - May interact unexpectedly with other audio apps

### Release Recommendation

**✅ APPROVED FOR RELEASE**

Confidence: **85/100**

The codebase is in excellent shape with comprehensive test coverage and clean static analysis. The main risk vectors (Bluetooth, auto-stop) are new features that have been well-implemented with proper error handling and test coverage. Recommend real-device Bluetooth testing before marking as stable release.

---

## Appendix: Full Commit List

```
823d0c3d feat: add Bluetooth/wired headset media button support for TTS
5bcb6a9f fix(progress): resolve stale closure in TTS progress save
00f2328e fix(tts): keep media notification state in sync
9ab5b1ac fix: eliminate notification flicker during TTS seek operations
6af3f6c3 feat(tts): add Bluetooth headset support and fix notification redraw
9cc211db test: implement skipped auto-stop mode tests
126363f0 fix(tts): restore position when returning after pause from notification
8fe0b831 docs: document upstream synchronization verification (2025-12-30)
7c57b742 chore: Add rules to ignore MCP server cache files.
953f1ea2 docs: refactor AI agent guidance files for conciseness
89b8e205 fix(tts): Fix three auto-stop bugs in TTS system
caf796ea test: Add comprehensive AutoStopService test coverage
4d8e3400 feat: Implement TTS auto-stop with screen state detection
0a2756ee feat: Add auto-stop controls to reader TTS bottom sheet
f593fd06 feat(tts): redesign sleep timer into Auto-Stop
bd8bccd6 docs(specs): preserve feature request docs and notes
200ac435 feat: adopt upstream PRs #1573 and #1599 for EPUB improvements
07f7b424 fix(android): resolve MainActivity startup crash
ab193e22 fix(android): resolve Gradle and API deprecation warnings
a19a0fa5 chore: merge upstream/master - Volume button offset setting (#1685)
467a97dc feat: Add Volume Button Offset Setting (#1685)
```
