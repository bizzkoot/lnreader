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

## Important Files to Understand

1. `src/screens/reader/components/WebViewReader.tsx` - Main reader controller (~2000 LOC, manages TTS state, WebView communication)
2. `src/services/TTSAudioManager.ts` - TTS queue and audio management wrapper for native module
3. `src/services/TTSState.ts` - TTS state machine with transition validation
4. `android/app/src/main/assets/js/core.js` - In-page reader logic (DOM parsing, highlighting, scroll)
5. `src/plugins/pluginManager.ts` - Dynamic plugin loading system
6. `src/hooks/persisted/useSettings.ts` - Settings management with MMKV persistence
7. `docs/TTS/TTS_DESIGN.md` - Complete TTS implementation guide with diagrams
