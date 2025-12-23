# System Patterns

## Architectural Patterns

### TTS Background Playback Architecture

- **Native Module** (TTSHighlight): Handles Android TTS via foreground service
- **TTSAudioManager.ts**: Manages queue with BATCH_SIZE=15, REFILL_THRESHOLD=5
- **WebViewReader.tsx**: Coordinates TTS, WebView, and state management
- **MMKV Storage**: Persists chapter progress as `chapter_progress_${chapter.id}`
- **AppState API**: Detects screen wake/background transitions

### Multi-Source State Recovery Pattern

When recovering state after interruption (screen wake, chapter transition):

```javascript
// Compute authoritative index from all sources
const initialIndex = Math.max(
  dbIndex, // Database (persistent, may be stale)
  mmkvIndex, // MMKV (fast, synced on save)
  ttsStateIndex, // Native TTS state (most current during playback)
);
```

### Grace Period Filtering Pattern

Block stale events during state transitions:

```javascript
const shouldIgnore =
  isWithinGracePeriod &&
  (chapterMismatch || backwardProgress || initialZeroWithExistingProgress);
```

## Design Patterns

### Pause-Sync-Resume Flow

For screen wake during background playback:

1. **Pause**: `TTSHighlight.pause()` immediately on AppState 'active'
2. **Sync**: Inject JS to scroll/highlight current paragraph in WebView
3. **Resume**: `speakBatch()` from saved index after UI sync completes

### Ref-Based State Coordination

Use refs to avoid stale closures in event handlers:

```javascript
const nextChapterRef = useRef(nextChapter);
useEffect(() => {
  nextChapterRef.current = nextChapter;
}, [nextChapter]);
// Handler uses nextChapterRef.current instead of nextChapter
```

### Testable Utility Extraction

Extract pure logic into separate modules for unit testing:

- `ttsWakeUtils.js`: computeInitialIndex(), buildBatch(), shouldIgnoreSaveEvent()
- Enables Jest testing without React Native runtime

## Common Idioms

### Chapter ID in Utterance IDs

```javascript
utteranceId = `chapter_${chapterId}_utterance_${paragraphIndex}`;
```

Allows validation of events to prevent stale chapter processing.

### Background Navigation Tracking

```javascript
isWebViewSyncedRef.current = false; // Set before navigation
// ... navigation happens ...
// In onLoadEnd:
isWebViewSyncedRef.current = true;
```

Skip WebView JS injection when not synced during background mode.

### Hybrid App Update Pattern

Combines in-app native installation with web-based fallback:

1. **Check**: Fetch latest release from GitHub API.
2. **Prompt**: Show dialog with "Download & Install" AND "View on GitHub".
3. **Download**: Use `expo-file-system/legacy` to download APK to cache.
4. **Install**: Use `expo-intent-launcher` to trigger `android.intent.action.VIEW` on the content URI.
   Requires `REQUEST_INSTALL_PACKAGES` permission and `FileProvider` (handled by Expo).


## TTS Hook Architecture - Custom React Hook for Complex State Management

useTTSController.ts demonstrates pattern for extracting complex stateful logic from large components into reusable hooks. Key aspects: (1) Multiple useRef hooks for imperative values that shouldn't trigger re-renders, (2) useEffect dependencies carefully managed to sync with chapter changes, (3) Native module event listeners lifecycle managed in effects, (4) Explicit interface with ~15 exported functions/state for component consumption, (5) Internal state machine (wake transitions, chapter sync) isolated from component, (6) Comprehensive logging with categorized tags ([WAKE], [SYNC], [STALE]) for debugging

### Examples

- src/screens/reader/hooks/useTTSController.ts - Full implementation (~2,000 lines)
- src/screens/reader/components/WebViewReader.tsx - Hook consumption pattern (lines ~214-231)
- Chapter change synchronization effect (useTTSController.ts lines ~489-609)
- Wake handling state machine (useTTSController.ts lines ~2237-2516)


## Android WebView Background Behavior

Android optimizes battery by not rendering WebViews while app is backgrounded. This means: (1) WebView.onLoadEnd may never fire during background operations, (2) All JavaScript state (window.* globals) is lost on WebView reload after wake, (3) Refs must be used for coordination between native and WebView layers during background operations, (4) Critical flags must be re-injected in onLoadEnd handlers when resuming from background state.

### Examples

- Background TTS Effect bypasses WebView sync by setting isWebViewSyncedRef=true immediately
- Wake resume handler injects blocking flags in handleWebViewLoadEnd before WebView JS initializes
- Chapter Change Effect uses 300ms timer fallback for WebView sync, but Background TTS bypasses this entirely


## Boundary-Based Content Management

Track chapter boundaries within stitched DOM content to enable intelligent content trimming and progress synchronization across chapters without losing user's reading position.

### Examples

- Continuous scrolling boundary tracking in core.js lines 290-300
- WebView opacity transition in WebViewReader.tsx
- Chapter boundary calculation using countReadableInContainer()
- TrimPreviousChapter handling both original and stitched chapters


## WebView IIFE Self-Reference Pattern

Inside the reader constructor IIFE, use 'const self = this' to capture the instance reference before nested IIFEs. Cannot use 'reader.' because window.reader doesn't exist until the constructor completes.

### Examples

- core.js initialEnhancement() - uses self.chapterElement instead of reader.chapterElement
