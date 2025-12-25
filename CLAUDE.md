# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LNReader is a free and open source light novel reader for Android, built with React Native. Inspired by Tachiyomi, it specializes in reading light novels with advanced Text-to-Speech (TTS) capabilities.

## Development Commands

### Basic Development

```bash
# Install dependencies
pnpm install

# Start Metro bundler
pnpm run dev:start

# Run on Android device/emulator
pnpm run dev:android

# Clean start with cache reset
pnpm run dev:clean-start
```

### Building & Release

```bash
# Generate environment files for debug
pnpm run generate:env:debug

# Generate environment files for release
pnpm run generate:env:release

# Build release APK
pnpm run build:release:android

# Open built APK location
pnpm run build:open-apk
```

### Code Quality

```bash
# Lint code
pnpm run lint

# Fix linting issues
pnpm run lint:fix

# Type checking
pnpm run type-check

# Format code
pnpm run format

# Check formatting
pnpm run format:check
```

### Git Workflow

**IMPORTANT:** Always run `pnpm run format` before staging files for commit to avoid pre-commit hook failures.

```bash
# 1. Make your changes
# 2. Format code before staging
pnpm run format

# 3. Stage your changes
git add <files>

# 4. Commit (pre-commit hooks will auto-run lint + format)
git commit -m "message"

# 5. Push
git push
```

### Testing

```bash
# Run Jest tests
pnpm run test

# Run single test file
pnpm run test -- --testPathPattern="FileName.test"

# Run tests matching a pattern
pnpm run test -- --testNamePattern="should do something"

# TTS-specific tests (simulator scripts)
pnpm run test:tts-refill
pnpm run test:tts-wake-cycle
```

### Environment Management

- Uses `react-native-dotenv` with environment generation scripts
- Debug: `node scripts/generate-env-file.cjs Debug`
- Release: `node scripts/generate-env-file.cjs Release`

## Architecture Overview

### Core TTS Architecture (3-Layer Hybrid Design)

The TTS system is the most complex feature, using a sophisticated 3-layer architecture:

1. **React Native Layer** (`src/screens/reader/components/WebViewReader.tsx`)
   - Main controller and state management
   - Handles background playback queueing
   - Manages TTS settings and UI
   - Key file: `src/services/TTSAudioManager.ts` - JS wrapper for Native Module

2. **WebView Layer** (`android/app/src/main/assets/js/core.js`)
   - Renders chapter content
   - Parses DOM to find readable text nodes
   - Handles visual highlighting and scrolling
   - Drives "Foreground" playback loop
   - Provides `window.reader` and `window.tts` APIs

3. **Native Android Layer**
   - `TTSHighlightModule.kt`: Exposes system TTS engine to RN
   - `TTSForegroundService.kt`: Keeps app alive during background playback
   - `UtteranceProgressListener`: Provides speech events (`onSpeechStart`, `onSpeechDone`, `onRangeStart`)

### TTS Settings Locations

- **Global Settings**: More → Settings → Reader → Accessibility Tab
- **Quick Access**: Reader Bottom Sheet → TTS Tab
- Both sync to same underlying state (`useChapterGeneralSettings` / `useChapterReaderSettings`)

### TTS State Machine

The TTS system uses an explicit state machine (`TTSState` enum) for lifecycle management:
- **IDLE**: No TTS activity
- **STARTING**: Initializing session, loading voice, preparing queue
- **PLAYING**: Actively playing audio
- **REFILLING**: Refilling native queue during playback
- **STOPPING**: Cleanup in progress

Valid transitions are enforced via `isValidTransition()` in `src/services/TTSState.ts`.

### Key TTS Concepts

**Playback Modes:**

- **Foreground (per-paragraph)**: `speak()` - stops when screen off/minimized
- **Background (batch)**: `speakBatch()` - continues in background, default mode

**Queue Management:**

- Proactive refill mechanism (REFILL_THRESHOLD=10, MIN_BATCH_SIZE=20)
- Prevents audio gaps during continuous playback
- Race condition protection for fast speech/short paragraphs
- `addToBatch()` appends to native queue without stopping playback

**State Persistence:**

- Progress saved to Database (`ChapterQueries`) and MMKV
- Refs protect against race conditions (`currentParagraphIndexRef`, `wakeTransitionInProgressRef`)

## Project Structure

### Database Layer

- **Tables**: `src/database/tables/` - Novel, Chapter, Category, Repository tables
- **Queries**: `src/database/queries/` - Database operations for each entity
- **Migrations**: `src/database/migrations/` - Schema evolution

### Services

- **TTS**: `src/services/TTSAudioManager.ts`, `src/services/TTSHighlight.ts`
- **Backup**: `src/services/backup/` - Local, Drive, Self-host options
- **Trackers**: `src/services/Trackers/` - AniList, MAL, MangaUpdates
- **Updates**: `src/services/updates/` - Library update management

### Plugins System

- **Manager**: `src/plugins/pluginManager.ts` - Dynamic plugin loading
- **Types**: `src/plugins/types/` - TypeScript interfaces
- **Helpers**: `src/plugins/helpers/` - Fetch, storage, constants

### UI Components

- **Common**: `src/components/` - Reusable UI components
- **Reader**: `src/screens/reader/` - Reading interface and TTS controls
- **Navigation**: `src/navigators/` - React Navigation setup

### State Management

- **Persisted Hooks**: `src/hooks/persisted/` - Settings and app state
- **Common Hooks**: `src/hooks/common/` - Reusable logic

Key persisted hooks:
- `useSettings.ts` - General app settings
- `useChapterGeneralSettings` / `useChapterReaderSettings` - TTS settings (synced between global and reader UI)

## Key Implementation Patterns

### WebView Communication

- Uses `window.ReactNativeWebView.postMessage()` for WebView→RN
- Uses `injectJavaScript()` for RN→WebView
- Messages follow `{type: string, data?: any}` pattern

### TTS Dialog System

- **Resume Dialog**: Chapter opening with saved progress
- **Manual Mode Dialog**: Backward scroll while paused
- **Scroll Sync Dialog**: Scroll position vs TTS position mismatch
- **Sync Failure Dialog**: Critical wake-up synchronization failure

### TTS Media Notification

Native Android MediaStyle notification with 5-button controls:
- **Previous Chapter** / **Next Chapter** - Always starts from paragraph 0, marks source chapter 100% complete after 5 paragraphs
- **Rewind 5** / **Forward 5** - Skip paragraphs
- **Play/Pause** - Saves progress immediately on pause
- **Stop** - Stops playback and dismisses notification

Actions debounced by 500ms (`MEDIA_ACTION_DEBOUNCE_MS`) to prevent queue corruption.

### Settings Management

- Uses MMKV for fast key-value storage
- Database for structured data (novels, chapters, progress)
- Real-time sync between different settings locations
- **Progress Reconciliation**: On load, uses `Math.max(dbIndex, mmkvIndex, nativeIndex)` to find most advanced progress

### Race Condition Protection

Critical refs used to prevent race conditions:
- `currentParagraphIndexRef` - Source of truth for active TTS position
- `wakeTransitionInProgressRef` - Ignores events during app wake-up
- `chapterTransitionTimeRef` - Ignores stale save events after chapter switch
- `ttsLastStopTime` - 2-second grace period for scroll-based saves after TTS stops

## Testing Strategy

### TTS Testing

- Refill simulator: `scripts/tts_refill_simulator.js`
- Wake cycle test: `scripts/tts_wake_cycle_test.js`
- Unit tests: `src/services/__tests__/VoiceMapper.test.ts`

### Type Safety

- Strict TypeScript configuration
- ESLint with React Native rules
- Prettier for code formatting
- Pre-commit hooks: Husky with lint-staged (auto-formats and lints staged files)

## Native Dependencies

### Android-Specific

- React Native 0.82.1 with New Architecture support
- Expo modules for file system, speech, notifications
- Custom native modules for TTS highlighting
- React Compiler (RC.3) enabled via `babel-plugin-react-compiler`

### Minimum Requirements

- Node.js >= 20
- Java SDK >= 17
- Android SDK (API 24+ minimum, Android 7.0)

## Development Notes

- Package manager: pnpm (10.26.0)
- Husky for pre-commit hooks with lint-staged
- Flash List (`@legendapp/list`) for performant novel lists
- WebView for chapter rendering with custom CSS injection
- MMKV for high-performance key-value storage
- **Important**: Always read files before editing - use Read tool to understand context

## Path Aliases

The project uses TypeScript path aliases (defined in `tsconfig.json`):
- `@components/*` → `src/components/*`
- `@database/*` → `src/database/*`
- `@hooks/*` → `src/hooks/*`
- `@screens/*` → `src/screens/*`
- `@strings/*` → `strings/*`
- `@theme/*` → `src/theme/*`
- `@utils/*` → `src/utils/*`
- `@plugins/*` → `src/plugins/*`
- `@services/*` → `src/services/*`
- `@navigators/*` → `src/navigators/*`
- `@native/*` → `src/native/*`
- `@api/*` → `src/api/*`
- `@type/*` → `src/type/*`
- `@specs/*` → `specs/*`

## ESLint Rules

Key linting rules enforced:
- `no-console`: Error level (use rate-limited logger from `@utils/rateLimitedLogger` instead)
- `@typescript-eslint/no-shadow`: Warn level
- `react-hooks/exhaustive-deps`: Warn level
- `prefer-const`: Error level
- `no-duplicate-imports`: Error level

## Code Map: Quick File Reference

### TTS System Files
```
TTS Architecture (3-Layer Hybrid)
├── React Native Layer
│   ├── src/screens/reader/components/WebViewReader.tsx          Main reader controller (~2000 LOC)
│   ├── src/screens/reader/hooks/useTTSController.ts            TTS state machine & actions
│   ├── src/screens/reader/hooks/useTTSUtilities.ts             TTS utility functions
│   ├── src/screens/reader/hooks/useTTSConfirmationHandler.ts   Dialog handlers
│   ├── src/services/TTSAudioManager.ts                         Native module wrapper
│   ├── src/services/TTSState.ts                                State machine definition
│   ├── src/services/TTSHighlight.ts                            Highlight coordination
│   ├── src/utils/ttsBridge.ts                                  RN↔WebView bridge
│   └── src/utils/ttsNotification.ts                            Media notification utils
│
├── WebView Layer
│   └── android/app/src/main/assets/js/core.js                  DOM parsing, highlighting, scroll
│
└── Native Android Layer
    ├── android/app/src/main/java/com/rajarsheechatterjee/LNReader/TTSHighlightModule.kt
    ├── android/app/src/main/java/com/rajarsheechatterjee/LNReader/TTSForegroundService.kt
    └── android/app/src/main/java/com/rajarsheechatterjee/LNReader/TTSPackage.java
```

### TTS UI Components
```
Reader UI
├── src/screens/reader/components/ReaderBottomSheet/ReaderTTSTab.tsx    TTS control panel
├── src/screens/reader/components/ReaderFooter.tsx                      Footer with TTS controls
└── src/screens/reader/components/WebViewReader.tsx                     Main reader integration

Dialog Components
├── src/screens/reader/components/TTSResumeDialog.tsx                   Resume from saved progress
├── src/screens/reader/components/TTSManualModeDialog.tsx               Manual mode activation
├── src/screens/reader/components/TTSScrollSyncDialog.tsx               Position mismatch
├── src/screens/reader/components/TTSChapterSelectionDialog.tsx         Chapter picker
└── src/screens/reader/components/TTSExitDialog.tsx                     Exit confirmation

Settings Modals
├── src/screens/settings/SettingsReaderScreen/Modals/VoicePickerModal.tsx
└── src/screens/settings/SettingsReaderScreen/Modals/TTSScrollBehaviorModal.tsx
```

### Plugin System
```
Plugin Architecture
├── src/plugins/pluginManager.ts                    Dynamic plugin loader
├── src/plugins/types/index.ts                      Plugin interfaces
├── src/plugins/helpers/
│   ├── constants.ts                                Default constants
│   ├── fetch.ts                                    HTTP helpers
│   ├── storage.ts                                  Plugin storage
│   └── isAbsoluteUrl.ts                            URL validation
└── Repository sources (loaded dynamically)
    ├── Official LNReader repository
    └── User-added repositories
```

### Database Layer
```
Schema & Migrations
├── src/database/db.ts                              Connection setup
├── src/database/tables/
│   ├── NovelTable.ts
│   ├── ChapterTable.ts
│   ├── CategoryTable.ts
│   ├── RepositoryTable.ts
│   └── NovelCategoryTable.ts
├── src/database/queries/
│   ├── NovelQueries.ts
│   ├── ChapterQueries.ts                           Progress persistence
│   ├── LibraryQueries.ts
│   ├── HistoryQueries.ts
│   ├── CategoryQueries.ts
│   ├── RepositoryQueries.ts
│   └── StatsQueries.ts
└── src/database/migrations/
    ├── 002_add_novel_counters.ts
    └── 003_add_tts_state.ts
```

### Navigation Structure
```
Navigation Stack
├── src/navigators/Main.tsx                         Root navigator
├── src/navigators/BottomNavigator.tsx              Tab bar
├── src/navigators/ReaderStack.tsx                  Reader screen stack
├── src/navigators/MoreStack.tsx                    Settings stack
└── src/navigators/types/index.ts                   Navigation types
```

### State Management (Persisted Hooks)
```
Settings Storage (MMKV)
├── src/hooks/persisted/useSettings.ts              General + TTS settings ⭐
├── src/hooks/persisted/useTheme.ts                 Theme preferences
├── src/hooks/persisted/useDownload.ts              Download settings
├── src/hooks/persisted/useHistory.ts               History settings
├── src/hooks/persisted/useCategories.ts            Library categories
├── src/hooks/persisted/usePlugins.ts               Plugin configurations
├── src/hooks/persisted/useAutoBackup.ts            Backup settings
└── src/hooks/persisted/useTracker.ts               AniList/MAL tracking
```

## Important Files to Understand

**Top 7 files to read first:**
1. `src/screens/reader/components/WebViewReader.tsx` - Main reader controller (~2000 LOC, manages TTS state, WebView communication)
2. `src/screens/reader/hooks/useTTSController.ts` - TTS state machine and action handlers
3. `src/services/TTSAudioManager.ts` - TTS queue and audio management wrapper for native module
4. `src/services/TTSState.ts` - TTS state machine with transition validation
5. `android/app/src/main/assets/js/core.js` - In-page reader logic (DOM parsing, highlighting, scroll)
6. `src/plugins/pluginManager.ts` - Dynamic plugin loading system
7. `src/hooks/persisted/useSettings.ts` - Settings management with MMKV persistence

**Documentation:**
- `docs/TTS/TTS_DESIGN.md` - Complete TTS implementation guide with diagrams

## Quick Reference: Common Tasks

### Adding a New TTS Feature
1. Add state to `TTSState.ts` if new state needed
2. Implement in `useTTSController.ts` for React Native logic
3. Add WebView bridge code in `src/utils/ttsBridge.ts`
4. Update native layer if needed (`.kt` files)
5. Add UI controls in `ReaderTTSTab.tsx`
6. Test with `pnpm run test:tts-refill`

### Adding a New Novel Source Plugin
1. Create plugin implementing `Plugin` interface from `src/plugins/types/`
2. Add to repository or host as standalone
3. Plugin manager loads it dynamically at runtime
4. Required methods: `popularNovels()`, `parseNovel()`, `parseChapter()`

### Debugging TTS Issues
1. Check `TTSState.ts` for valid state transitions
2. Review race condition protection refs in `useTTSController.ts`
3. Use rate-limited logger from `@utils/rateLimitedLogger` (NOT console.log)
4. Check native module events in `TTSHighlightModule.kt`
5. WebView logs: `window.reader` and `window.tts` APIs in `core.js`

### Tracing TTS Data Flow
```
User Action → useTTSController → TTSAudioManager → Native Module
                                    ↓
                              ttsBridge.ts → core.js (WebView)
                                    ↓
                            onSpeechDone/onRangeStart → useTTSController
```

### Adding a New Setting
1. Add to `ChapterGeneralSettings` or `ChapterReaderSettings` in `useSettings.ts`
2. Settings auto-sync between global and reader UI via MMKV
3. Add UI controls in appropriate settings modal
4. Type definitions in `src/screens/reader/types/tts.ts`

## Data Flow Summaries

### TTS Playback Flow
```
1. User presses Play
   ↓
2. useTTSController: STARTING state → load voice → build queue
   ↓
3. TTSAudioManager: speakBatch() with initial paragraphs
   ↓
4. Native Layer: UtteranceProgressListener fires events
   ↓
5. WebView: core.js highlights current paragraph (onRangeStart)
   ↓
6. Queue depletes → REFILLING state → addToBatch() more paragraphs
   ↓
7. Chapter ends → play next chapter or stop
```

### Progress Save Flow
```
1. onSpeechDone(index) or onRangeStart(index, char)
   ↓
2. wakeTransitionInProgressRef check (ignore if waking)
   ↓
3. Update currentParagraphIndexRef
   ↓
4. Save to Database (ChapterQueries) AND MMKV
   ↓
5. On chapter load: Math.max(dbIndex, mmkvIndex, nativeIndex)
```

### Plugin Loading Flow
```
1. App startup
   ↓
2. pluginManager: fetch repository manifest
   ↓
3. Download and cache plugin files
   ↓
4. Dynamic import() of plugin code
   ↓
5. Validate plugin implements required interface
   ↓
6. Register in available plugins list
```

## Troubleshooting Guide

### Common Issues

| Symptom | Likely Cause | Fix Location |
|---------|--------------|--------------|
| TTS stops after 1 paragraph | Race condition in queue refill | `useTTSController.ts:handleSpeechDone` |
| Highlight out of sync | Missing wake cycle protection | Check `wakeTransitionInProgressRef` |
| Settings not saving | MMKV key mismatch | `useSettings.ts` key names |
| Plugin not loading | Repository URL invalid | `pluginManager.ts` fetch logic |
| Scroll position lost | Progress not reconciled | `Math.max()` logic in reader load |
| Console.log error | Used instead of rate-limited logger | Replace with `@utils/rateLimitedLogger` |
| Build fails | TypeScript errors | Run `pnpm run type-check` |

### Race Condition Hotspots
- `currentParagraphIndexRef` vs `currentIndex` state
- Native `onSpeechDone` arriving before `onSpeechStart`
- App wake-up triggering stale events
- Chapter transition with pending saves
- Queue refill timing (speechRate affects)

### Native Bridge Debugging
- Check `TTSHighlightModule.kt` for event emission
- Verify `TTSForegroundService.kt` notification actions
- WebView messages use `window.ReactNativeWebView.postMessage()`
- RN→WebView uses `injectJavaScript()`

## TTS Quick Reference

### TTS State Transitions (Valid Paths)
```
IDLE → STARTING → PLAYING → REFILLING → PLAYING (loop)
PLAYING → STOPPING → IDLE
IDLE → PLAYING (direct resume)
```
See `TTSState.ts:isValidTransition()` for enforcement

### Key Constants
| Constant | Value | Purpose |
|----------|-------|---------|
| REFILL_THRESHOLD | 10 | Queue size triggers refill |
| MIN_BATCH_SIZE | 20 | Minimum paragraphs per batch |
| MEDIA_ACTION_DEBOUNCE_MS | 500 | Notification button debounce |
| WAKE_SYNC_TIMEOUT_MS | 3000 | Max time to wait for wake sync |

### TTS Actions by Method
| Action | Method | File |
|--------|--------|------|
| Play/Pause | `playTTS()` / `pauseTTS()` | `useTTSController.ts` |
| Stop | `stopTTS()` | `useTTSController.ts` |
| Skip Forward | `handleForward()` | `useTTSController.ts` |
| Skip Backward | `handleRewind()` | `useTTSController.ts` |
| Next/Prev Chapter | `handleNextChapter()` / `handlePrevChapter()` | `useTTSController.ts` |
| Queue Refill | `refillQueue()` | `useTTSController.ts` |

### TTS Events (Native → RN)
- `onSpeechStart(index)` - Paragraph started
- `onSpeechDone(index)` - Paragraph completed
- `onRangeStart(index, charOffset, charLength)` - For highlighting

### TTS Bridge APIs (RN ↔ WebView)
```javascript
// WebView exposed APIs (call via injectJavaScript)
window.reader.highlightElement(selector)   // Highlight text
window.reader.scrollToElement(selector)     // Scroll to paragraph
window.tts.getTextNodes()                   // Get readable text
window.tts.getCurrentParagraphIndex()       // Get position

// WebView → RN messages
window.ReactNativeWebView.postMessage(JSON.stringify({
  type: 'ready' | 'error' | 'log',
  data: {...}
}))
```

## Concept Index

| Concept | Location | Description |
|---------|----------|-------------|
| 3-Layer TTS | Architecture Overview | RN + WebView + Native layers |
| Proactive Refill | `useTTSController.ts` | Queue before empty |
| Wake Cycle Protection | `ttsWakeUtils.js` | Ignore events on app wake |
| Progress Reconciliation | `WebViewReader.tsx` load | Math.max of all sources |
| Manual Mode | `TTSManualModeDialog.tsx` | User controls playback manually |
| Scroll Sync | `TTSScrollSyncDialog.tsx` | Detect position mismatch |
| Background Playback | `TTSForegroundService.kt` | Continue when app hidden |
| Dynamic Plugins | `pluginManager.ts` | Load sources at runtime |
| MMKV Persistence | `useSettings.ts` | Fast key-value storage |
| Media Notification | `ttsNotification.ts` | 5-button notification controls |
