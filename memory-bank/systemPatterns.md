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
