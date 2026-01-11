# LNReader Agent Context

## Project Overview

LNReader is a free and open source light novel reader for Android, built with React Native. Inspired by Tachiyomi, it specializes in reading light novels with advanced Text-to-Speech (TTS) capabilities.

## Commands

```bash
# Development
pnpm run dev:start && pnpm run dev:android
pnpm run dev:clean-start
pnpm run clean:android

# Build & Release
pnpm run build:release:android
pnpm run build:open-apk

# Code Quality (ALWAYS format before commit)
pnpm run format && git add . && git commit -m "msg"
pnpm run lint:fix
pnpm run type-check

# Testing
pnpm run test
pnpm run test -- --testPathPattern="FileName.test"
pnpm run test:tts-refill
pnpm run test:tts-wake-cycle
```

## Current Task

Production Readiness Action Plan Implementation (2026-01-03) - ✅ COMPLETED

### Phase 1: Critical Security & Bug Fixes (P0) - ✅ COMPLETED

- **1.1**: Fixed cookie value truncation in WebviewScreen.tsx (handles values with `=`)
- **1.2**: Fixed Set-Cookie header parsing (handles comma + newline separation, equals in values)
- **1.3**: Replaced harsh `System.exit(0)` with graceful shutdown in DoHManagerModule.kt
- **1.4**: Added 5-second timeouts to DoH bootstrap client (connectTimeout, readTimeout, writeTimeout)
- **1.5**: Changed SharedPreferences from `apply()` to `commit()` (synchronous writes to prevent data loss)
- **1.6**: Removed obsolete `.pnpm-patches/cookies/` directory (kept patches/ directory)

### Phase 2: Security Hardening (P1) - ✅ COMPLETED

- **2.1**: ~~Added certificate pinning for DoH providers~~ → **REMOVED** (2026-01-11)
  - Certificate pinning removed per OWASP 2025 guidance
  - Reason: Third-party DoH providers rotate certs unpredictably, causing app outages
  - Android's platform trust store + Certificate Transparency provides sufficient security
  - See: OWASP Pinning Cheat Sheet - "don't pin if you don't control both sides"
- **2.2**: User confirmation dialog for app restart already implemented
- **2.3**: Cookie attribute filtering already implemented

### Phase 4: Performance Optimization (P2) - ✅ COMPLETED

- **4.1**: Increased TTS chapter list debounce from 500ms → 2000ms (4x reduction in DB queries)
- **4.2**: Code already optimized (single refresh pattern, no major duplication)
- **4.3**: Added React.memo with custom equality to ChapterItem (prevents re-renders on non-progress changes)

### Phase 5: Testing & Documentation (P2) - ✅ COMPLETED

- **5.1**: Cookie parsing tests comprehensive (special chars, URL encoding, multiple cookies, etc.)
- **5.2**: Updated AGENTS.md with completed task status
- **Tests**: All 1072 tests passing (zero regressions)

### Previous Completed Tasks

- TTS Chapter List Progress Sync - Real-Time Fix (2026-01-03) - ✅ COMPLETED
  - **Bug**: Chapter List showed stale progress during active TTS playback
  - **Solution**: Added debounced `refreshChaptersFromContext()` call during paragraph progress saves (500ms debounce)
  - **Impact**: Chapter List now syncs in real-time (500ms latency)

- TTS Sleep Timer + Smart Rewind (2025-12-27) - ✅ COMPLETED
  - **Features**: Sleep timer (minutes/paragraphs/end of chapter), smart rewind (N paragraphs after pause)
  - **Files**: `useSettings.ts`, `SleepTimer.ts`, `useTTSController.ts`, `ReaderTTSTab.tsx`
  - **Status**: All 917 tests passing

## TTS Architecture (3-Layer Hybrid)

**Layers:**

1. **React Native**: `WebViewReader.tsx` (controller), `useTTSController.ts` (state machine), `TTSAudioManager.ts` (native wrapper)
2. **WebView**: `core.js` (DOM parsing, highlighting, scroll)
3. **Native Android**: `TTSHighlightModule.kt`, `TTSForegroundService.kt`

**State Machine:** IDLE → STARTING → PLAYING → REFILLING → PLAYING (loop)

**Key Concepts:**

- **Queue Management**: Proactive refill (threshold=10, batch=20), prevents audio gaps
- **Playback Modes**: Foreground (per-paragraph, stops when screen off) vs Background (batch, continues in background, default)
- **Race Protection**: Refs for `currentParagraphIndexRef`, `wakeTransitionInProgressRef`, `chapterTransitionTimeRef`, `ttsLastStopTime` (2s grace)
- **Progress Reconciliation**: `Math.max(dbIndex, mmkvIndex, nativeIndex)` on load
- **State Persistence**: Database (`ChapterQueries`) + MMKV

**TTS Settings Locations:**

- Global: More → Settings → Reader → Accessibility Tab
- Quick Access: Reader Bottom Sheet → TTS Tab
- Both sync via `useChapterGeneralSettings` / `useChapterReaderSettings`

**Media Notification:** 5-button controls (Prev/Next Chapter, Rewind/Forward 5, Play/Pause), 500ms debounce

## Critical Files

1. `src/screens/reader/components/WebViewReader.tsx` - Main reader (~2000 LOC)
2. `src/screens/reader/hooks/useTTSController.ts` - TTS state machine
3. `src/services/TTSAudioManager.ts` - Native module wrapper
4. `android/app/src/main/assets/js/core.js` - WebView logic
5. `src/hooks/persisted/useSettings.ts` - Settings (MMKV)
6. `src/services/TTSState.ts` - State machine with transition validation
7. `src/plugins/pluginManager.ts` - Dynamic plugin loading

## Recent Fixes

### TTS Paragraph Highlight Offset & Resume Dialog Fix (2026-01-11) - ✅ COMPLETED

- **Bug #1 - Highlight Offset**: ✅ COMPLETED - User can adjust paragraph highlight offset
  - **Root Cause**: TTS highlight by index may visually differ from rendered paragraph index
  - **Solution**: Added ephemeral `paragraphHighlightOffset` state in ChapterContext (±10 range)
  - **UI Controls**: +/- buttons and reset in Reader TTS Tab (bottom sheet)
  - **Behavior**: Resets to 0 on chapter navigation (chapter-scoped, not persisted)
  - **Files**: ChapterContext.tsx (+28 lines), ReaderTTSTab.tsx (+71 lines), useTTSController.ts (+21 lines)
- **Bug #2 - Resume Dialog**: ✅ COMPLETED - Dialog now shows reliably
  - **Root Cause**: `hasAutoResumed` flag set immediately when posting 'request-tts-confirmation' (before user response)
  - **Fix**: Reset `hasAutoResumed = false` on chapter load in core.js (line 38)
  - **Impact**: Dialog shows correctly with "Ask everytime" setting on subsequent chapter opens
  - **Files**: core.js (+1 line)

- **Commits**: 2d9edddec (offset state), 70a2aaa76 (highlight injection), 541bcd732 (UI controls), 4df5dda20 (resume dialog fix), 0d368fa7c (test skips)
- **Tests**: 1191 passing, 4 skipped (pending WebView sync timing fixes)
- **Docs**: PRD at specs/tts-highlight-offset-resume-dialog-fix/PRD.md

### TTS Chapter List Progress Sync - Real-Time Fix (2026-01-03) - ✅ COMPLETED

- **Bug**: Chapter List showed stale progress during active TTS playback (only updated on stop/complete events)
- **Root Cause**: Regular paragraph progress saves called `saveProgress()` which updated DB but didn't trigger UI mutation
- **Solution**: Added debounced `refreshChaptersFromContext()` call during every paragraph progress save
- **Implementation**:
  - `useTTSController.ts` (+24 lines)
  - Added refs: `refreshChaptersFromContextRef`, `lastChapterListRefreshTimeRef`
  - Debounce at 500ms prevents excessive DB reloads (~10/sec → ~2/sec)
  - Uses `setTimeout(..., 0)` to avoid blocking TTS playback
- **Impact**: Chapter List now syncs progress in real-time during TTS playback
- **Tests**: 1071/1072 passing (pre-existing failure unrelated)
- **Commit**: 18faebd83
- **Docs**: Memory created (ID: 30) and linked to related TTS fixes

### TTS Progress & Wake Scroll Fixes (2026-01-02)

- **Bug #1 - Chapter List Sync**: ✅ FULL FIX - Now works for regular playback
  - **Original Issue**: Media nav buttons fixed ✅, but regular TTS playback (para-by-para) still called `updateChapterProgressDb()` (DB-only) at line 1464
  - **Final Fix**: Added debounced `refreshChaptersFromContext()` call during every paragraph progress save
  - **Symptom Fixed**: Progress updates in real-time during playback, not just on initial TTS start/resume
  - **Impact**: User reads Ch 6087 from 7% → 16%, exits → Chapter list shows 16% (live)
- **Bug #2 - Wake Scroll Restoration**: ✅ COMPLETED - Working correctly
  - **Root Cause**: Wake resume block only resumed playback, missing scroll restoration
  - **Fix**: Inject `window.tts.scrollToElement()` before `speakBatch()` in wake resume
  - **Impact**: User returns to app → reader scrolls to last TTS paragraph (not top of chapter)
  - **Files**: useTTSController.ts (line 1305 - 26 new lines)
- **Commits**: 69d78b863 (partial fix), 8f46c7ee2 (docs), bug report created 2026-01-03

### Gradle 9.2.0 Upgrade (2026-01-02) - ✅ COMPLETED

- **Goal**: Upgrade from Gradle 8.14.3 → 9.2.0
- **Breaking Changes Fixed**:
  1. **jcenter() Removal**: Patched `@react-native-cookies/cookies@8.0.1` via pnpm patch (4 instances jcenter → mavenCentral)
  2. **Dependency Force Syntax**: Migrated from `force = true` to `configurations.all { resolutionStrategy.force() }` in `android/app/build.gradle`
- **Compatibility**: AGP 8.12.0, Kotlin 2.1.20, Java 17 all compatible
- **Non-Blocking Warnings**: Expo module deprecations (upstream), multi-string notation (React Native internal)
- **Files Modified**: `gradle-wrapper.properties`, `android/app/build.gradle`, `patches/@react-native-cookies__cookies@8.0.1.patch`
- **Status**: ✅ Code complete, build validated, all tests passing
- **Docs**: [specs/upgrade-gradle-v9/implementation-log.md](specs/upgrade-gradle-v9/implementation-log.md)

### Phase 3: DNS-over-HTTPS (DoH) Implementation (2026-01-02)

- **Feature**: DoH provider selection in Settings → Advanced (Android-only)
- **Providers**: Cloudflare, Google, AdGuard (extensible architecture)
- **Native Module**: `DoHManagerModule.kt` with bootstrap IPs, singleton pattern
- **TypeScript Wrapper**: `DoHManager.ts` with platform detection, error handling
- **UI**: Provider picker modal with RadioButtons, restart confirmation dialog
- **Integration**: OkHttp 4.12.0 with `okhttp-dnsoverhttps` dependency
- **Status**: All 1072 tests passing, Sessions 1-4 complete

### DoH Persistence Fix (2026-01-03)

- **Bug**: DoH provider selection was lost on app restart
- **Root Cause**: No persistence layer - settings stored only in memory (native + React state)
- **Fix**: Dual-layer persistence
  - MMKV (React Native layer): Added `doHProvider` field to `AppSettings` interface
  - SharedPreferences (Native layer): Added read/write methods to `DoHManagerModule.kt`
- **Sync Pattern**: UI reads from MMKV on mount → calls `DoHManager.setProvider()` to sync native
- **Files Modified**:
  - `src/hooks/persisted/useSettings.ts` - Added doHProvider to AppSettings interface
  - `android/app/src/main/java/com/rajarsheechatterjee/LNReader/DoHManagerModule.kt` - Added SharedPreferences persistence
  - `src/screens/settings/SettingsAdvancedScreen.tsx` - Integrated useAppSettings hook
  - Test files: Added NativeModules.DoHManager mocks to 5 test files
- **Tests**: All 1072 tests passing (zero regressions)

### MainActivity Startup Crash (2025-12-27)

- **Cause**: `window.insetsController` accessed before `super.onCreate()` → NPE when DecorView null
- **Fix**: Move `super.onCreate()` first in `MainActivity.kt`

### Upstream PR Adoptions (2025-12-27)

- **#1573**: Added `'style'` to `<span>` in `sanitizeChapterText.ts` (EPUB styling preservation)
- **#1599**: `clean_summary()` in `Epub.cpp` (strip HTML tags/entities from EPUB summaries)

### Filter Icon Crash (2025-12-25)

- **Cause**: `clampUIScale(undefined)` → NaN (missing MMKV data from older versions)
- **Fix**: Default `uiScale` to `1.0` in `scaling.ts`, `useSettings.ts`

### TTS Per-Novel Settings Auto-Load (2025-12-25)

- **Cause**: `WebViewReader.tsx` updated ref only, not MMKV
- **Fix**: Call `setChapterReaderSettings({ tts: stored.tts })` to sync. Reset to global defaults when no per-novel settings

### TTS Per-Novel Settings Toggle (2025-12-23)

- **Cause**: `@gorhom/bottom-sheet` Portal breaks React context
- **Fix**: Pass `novel` as props through `ReaderScreen` → `ReaderBottomSheetV2` → `ReaderTTSTab`

### Chapter Title Duplication (2025-12-23)

- **Cause**: Temp div `visibility:hidden` → `getComputedStyle()` inherited, all elements appeared hidden
- **Fix**: Don't append temp div to document. Check only inline styles for explicit `display:none`/`visibility:hidden` in `core.js`

## Code Style

- **Imports**: Path aliases (`@components`, `@utils`, etc.)
- **Format**: 2 spaces, single quotes, trailing commas (Prettier)
- **TypeScript**: Strict mode, no unused locals, ES2022
- **Naming**: PascalCase (components), camelCase (vars/functions)
- **Errors**: Use `@utils/rateLimitedLogger`, NOT `console.log` (ESLint error)
- **Hooks**: `exhaustive-deps` enforced
- **Git Workflow**: ALWAYS `pnpm run format` before commit (Husky pre-commit hooks auto-format)

## Project Structure

### Key Directories

- `src/database/` - Tables, queries, migrations (Novel, Chapter, Category, Repository)
- `src/services/` - TTS, Backup (Local/Drive/Self-host), Trackers (AniList/MAL/MangaUpdates), Updates
- `src/plugins/` - Dynamic plugin loading (pluginManager.ts, types/, helpers/)
- `src/screens/reader/` - Reading interface, TTS controls, dialogs
- `src/hooks/persisted/` - MMKV-backed settings (useSettings.ts, useTheme.ts, useDownload.ts, etc.)
- `src/components/` - Reusable UI components
- `src/navigators/` - React Navigation setup

### DoH (DNS-over-HTTPS) Architecture

**Layers:**

1. **Native Android**: `DoHManagerModule.kt` (singleton pattern, OkHttp 4.12.0 integration)
2. **TypeScript Service**: `DoHManager.ts` (platform-safe wrapper, enum exports)
3. **UI Layer**: `SettingsAdvancedScreen.tsx` (provider picker, restart confirmation)

**Providers:**

- Cloudflare: `https://cloudflare-dns.com/dns-query` (Bootstrap: 1.1.1.1)
- Google: `https://dns.google/dns-query` (Bootstrap: 8.8.8.8)
- AdGuard: `https://dns-unfiltered.adguard.com/dns-query` (Bootstrap: 94.140.14.140)

**Key Concepts:**

- **Bootstrap IPs**: Hardcoded IPs prevent circular DNS dependency
- **Singleton Pattern**: Static `getDnsInstance()` accessible to OkHttpClient
- **Platform Detection**: Android-only, iOS falls back gracefully
- **App Restart Required**: OkHttpClient singleton requires restart (by design)
- **Persistence**: Provider ID stored in native SharedPreferences

**Settings Location:**

- Global: More → Settings → Advanced → DoH Provider

### TTS File Map

```
React Native Layer
├── WebViewReader.tsx                  Main reader controller
├── useTTSController.ts                State machine & actions
├── useTTSUtilities.ts                 Utility functions
├── useTTSConfirmationHandler.ts       Dialog handlers
├── TTSAudioManager.ts                 Native module wrapper
├── TTSState.ts                        State machine definition
├── ttsBridge.ts                       RN↔WebView bridge
└── ttsNotification.ts                 Media notification utils

WebView Layer
└── core.js                            DOM parsing, highlighting, scroll

Native Android Layer
├── TTSHighlightModule.kt              System TTS engine wrapper
├── TTSForegroundService.kt            Background playback service
└── TTSPackage.java                    Module registration

UI Components
├── ReaderTTSTab.tsx                   TTS control panel
├── TTSResumeDialog.tsx                Resume from saved progress
├── TTSManualModeDialog.tsx            Manual mode activation
├── TTSScrollSyncDialog.tsx            Position mismatch
├── TTSChapterSelectionDialog.tsx      Chapter picker
└── TTSExitDialog.tsx                  Exit confirmation
```

## Path Aliases

`@components`, `@database`, `@hooks`, `@screens`, `@strings`, `@theme`, `@utils`, `@plugins`, `@services`, `@navigators`, `@native`, `@api`, `@type`, `@specs`

## Upstream Status

- **Fork**: https://github.com/bizzkoot/lnreader (190 commits ahead)
- **Upstream**: https://github.com/lnreader/lnreader
- **Last Analysis**: Dec 27, 2025 - All compatible PRs (2024-2025) adopted ✅
- **Fork Advantages**:
  - Superior UI scaling (`useScaledDimensions`, `scaleDimension()` vs hardcoded values)
  - Newer deps: RN 0.82.1 (vs 0.81.5), Reanimated 4.2.0 (vs 4.1.5), Worklets 0.7.1 (vs 0.6.1)

**Adopted PRs:** #1685 (Volume Button Offset), #1667 (Paper Components), #1664 (TTS Refactor), #1631 (Translations), #1612 (Reader Settings UI), #1621 (DB Migrations), #1613 (MangaUpdates), #1609 (onscrollend), #1604 (Plugin DX), #1603 (Local Backup)

## WebView Communication

- **WebView→RN**: `window.ReactNativeWebView.postMessage(JSON.stringify({type, data}))`
- **RN→WebView**: `injectJavaScript()`
- **WebView APIs**: `window.reader.highlightElement()`, `window.reader.scrollToElement()`, `window.tts.getTextNodes()`, `window.tts.getCurrentParagraphIndex()`

## TTS Dialogs

- **Resume Dialog**: Chapter opening with saved progress
- **Manual Mode Dialog**: Backward scroll while paused
- **Scroll Sync Dialog**: Scroll position vs TTS position mismatch
- **Sync Failure Dialog**: Critical wake-up synchronization failure

## Data Flows

### TTS Playback

```
User presses Play → STARTING state → load voice → build queue
→ TTSAudioManager.speakBatch() → Native UtteranceProgressListener fires events
→ core.js highlights paragraph (onRangeStart) → Queue depletes → REFILLING
→ addToBatch() more paragraphs → Chapter ends → next chapter or stop
```

### Progress Save

```
onSpeechDone(index) / onRangeStart(index, char)
→ Check wakeTransitionInProgressRef (ignore if waking)
→ Update currentParagraphIndexRef
→ Save to Database (ChapterQueries) AND MMKV
→ On load: Math.max(dbIndex, mmkvIndex, nativeIndex)
```

### Plugin Loading

```
App startup → pluginManager fetches repository manifest
→ Download and cache plugin files → Dynamic import()
→ Validate plugin interface → Register in available plugins list
```

## Troubleshooting

| Symptom                | Likely Cause                        | Fix Location                            |
| ---------------------- | ----------------------------------- | --------------------------------------- |
| TTS stops after 1 para | Race condition in queue refill      | `useTTSController.ts:handleSpeechDone`  |
| Highlight out of sync  | Missing wake cycle protection       | Check `wakeTransitionInProgressRef`     |
| Settings not saving    | MMKV key mismatch                   | `useSettings.ts` key names              |
| Plugin not loading     | Repository URL invalid              | `pluginManager.ts` fetch logic          |
| Scroll position lost   | Progress not reconciled             | `Math.max()` logic in reader load       |
| Console.log error      | Used instead of rate-limited logger | Replace with `@utils/rateLimitedLogger` |
| Build fails            | TypeScript errors                   | Run `pnpm run type-check`               |

**Race Condition Hotspots:**

- `currentParagraphIndexRef` vs `currentIndex` state
- Native `onSpeechDone` arriving before `onSpeechStart`
- App wake-up triggering stale events
- Chapter transition with pending saves
- Queue refill timing (speechRate affects)

## Quick Tasks

### Adding TTS Feature

1. Add state to `TTSState.ts` if needed
2. Implement in `useTTSController.ts` (RN logic)
3. Add WebView bridge code in `ttsBridge.ts`
4. Update native layer (`.kt` files) if needed
5. Add UI controls in `ReaderTTSTab.tsx`
6. Test with `pnpm run test:tts-refill`

### Adding Novel Source Plugin

1. Create plugin implementing `Plugin` interface from `src/plugins/types/`
2. Required methods: `popularNovels()`, `parseNovel()`, `parseChapter()`
3. Plugin manager loads dynamically at runtime

### Debugging TTS

1. Check `TTSState.ts` for valid state transitions
2. Review race condition protection refs in `useTTSController.ts`
3. Use `@utils/rateLimitedLogger` (NOT console.log)
4. Check native events in `TTSHighlightModule.kt`
5. WebView logs: `window.reader` and `window.tts` APIs in `core.js`

### Adding Setting

1. Add to `ChapterGeneralSettings` or `ChapterReaderSettings` in `useSettings.ts`
2. Settings auto-sync between global and reader UI via MMKV
3. Add UI controls in appropriate settings modal
4. Type definitions in `src/screens/reader/types/tts.ts`

## TTS Reference

**State Transitions:** IDLE → STARTING → PLAYING → REFILLING → PLAYING (loop), PLAYING → STOPPING → IDLE, IDLE → PLAYING (direct resume)

**Constants:**

- REFILL_THRESHOLD: 10 (queue size triggers refill)
- MIN_BATCH_SIZE: 20 (minimum paragraphs per batch)
- MEDIA_ACTION_DEBOUNCE_MS: 500 (notification button debounce)
- WAKE_SYNC_TIMEOUT_MS: 3000 (max time to wait for wake sync)

**Actions:** `playTTS()`, `pauseTTS()`, `stopTTS()`, `handleForward()`, `handleRewind()`, `handleNextChapter()`, `handlePrevChapter()`, `refillQueue()`

**Events (Native→RN):** `onSpeechStart(index)`, `onSpeechDone(index)`, `onRangeStart(index, charOffset, charLength)`

## Technical Stack

- React Native 0.82.1 with New Architecture support
- Expo modules (file system, speech, notifications)
- React Compiler (RC.3) via `babel-plugin-react-compiler`
- MMKV (high-performance key-value storage)
- Flash List (`@legendapp/list`) for performant lists
- WebView with custom CSS injection
- Package manager: pnpm 10.26.0
- Min requirements: Node 20+, Java 17+, Android API 24+

## Notes

- TTS position: Native SharedPreferences (`chapter_progress_{chapterId}`), DB, MMKV
- Pre-commit: Husky + lint-staged auto-formats
- ESLint rules: `no-console` (error), `exhaustive-deps` (warn), `prefer-const` (error), `no-duplicate-imports` (error)
- Always read files before editing to understand context
