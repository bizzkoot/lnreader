# WebViewReader.tsx - Comprehensive Dependency & Usage Analysis

**Generated:** 2025-12-14  
**Target File:** `src/screens/reader/components/WebViewReader.tsx`  
**Lines of Code:** 3,379

---

## Table of Contents
1. [Files That Import WebViewReader](#1-files-that-import-webviewreader)
2. [Import Dependency Map](#2-import-dependency-map)
3. [Test Coverage](#3-test-coverage)
4. [Public Interface](#4-public-interface)
5. [Context Dependencies](#5-context-dependencies)
6. [Impact Radius Assessment](#6-impact-radius-assessment)
7. [Architecture Diagram](#7-architecture-diagram)
8. [Key Observations](#8-key-observations)

---

## 1. Files That Import WebViewReader

| File | Import Type | Line |
|------|-------------|------|
| `src/screens/reader/ReaderScreen.tsx` | Direct import | L7 |

**Summary:** Only 1 file directly imports WebViewReader - it's used exclusively by `ReaderScreen.tsx` as the main reader rendering component.

---

## 2. Import Dependency Map

### 2.1 External Libraries (React/React Native/Third-party)

| Import | Source | Usage |
|--------|--------|-------|
| `React` | `react` | Component definition |
| `memo` | `react` | Performance optimization (HOC wrapper) |
| `useEffect` | `react` | Side effects (TTS listeners, settings sync) |
| `useMemo` | `react` | Memoized HTML generation, settings |
| `useRef` | `react` | WebView ref, TTS state refs (30+ refs) |
| `useState` | `react` | Dialog visibility, TTS position state |
| `useCallback` | `react` | Memoized callbacks |
| `NativeEventEmitter` | `react-native` | Battery level events |
| `NativeModules` | `react-native` | RNDeviceInfo access |
| `StatusBar` | `react-native` | Status bar height for CSS |
| `AppState` | `react-native` | App foreground/background detection |
| `WebView` | `react-native-webview` | Main reader WebView |
| `color` | `color` | CSS color manipulation |
| `getBatteryLevelSync` | `react-native-device-info` | Battery level display |
| `useNavigation` | `@react-navigation/native` | Navigation for back handler |

### 2.2 Internal Utilities (@utils)

| Import | Source | Usage |
|--------|--------|-------|
| `READER_WEBVIEW_ORIGIN_WHITELIST` | `@utils/webviewSecurity` | WebView origin whitelist |
| `createMessageRateLimiter` | `@utils/webviewSecurity` | Rate limit WebView messages |
| `createWebViewNonce` | `@utils/webviewSecurity` | Security nonce for messages |
| `parseWebViewMessage` | `@utils/webviewSecurity` | Validate incoming messages |
| `shouldAllowReaderWebViewRequest` | `@utils/webviewSecurity` | Request validation |
| `MMKVStorage` | `@utils/mmkv/mmkv` | Fast key-value storage |
| `getMMKVObject` | `@utils/mmkv/mmkv` | Typed object retrieval |
| `PLUGIN_STORAGE` | `@utils/Storages` | Plugin custom CSS/JS path |
| `extractParagraphs` | `@utils/htmlParagraphExtractor` | Extract paragraphs from HTML |

### 2.3 Internal Hooks (@hooks)

| Import | Source | Usage |
|--------|--------|-------|
| `useTheme` | `@hooks/persisted` | Theme colors for WebView CSS |
| `useChapterReaderSettings` | `@hooks/persisted` | Live TTS settings updates |
| `useBoolean` | `@hooks` | Boolean state management |
| `useBackHandler` | `@hooks` | Android back button handler |
| `CHAPTER_GENERAL_SETTINGS` | `@hooks/persisted/useSettings` | MMKV key constant |
| `CHAPTER_READER_SETTINGS` | `@hooks/persisted/useSettings` | MMKV key constant |
| `ChapterGeneralSettings` | `@hooks/persisted/useSettings` | Type definition |
| `ChapterReaderSettings` | `@hooks/persisted/useSettings` | Type definition |
| `initialChapterGeneralSettings` | `@hooks/persisted/useSettings` | Default settings |
| `initialChapterReaderSettings` | `@hooks/persisted/useSettings` | Default settings |

### 2.4 Internal Components (@components)

| Import | Source | Usage |
|--------|--------|-------|
| `Toast` | `@components/Toast` | Toast notifications |

### 2.5 Database Queries (@database)

| Import | Alias | Source | Usage |
|--------|-------|--------|-------|
| `getChapter` | `getChapterFromDb` | `@database/queries/ChapterQueries` | Fetch chapter by ID |
| `markChaptersBeforePositionRead` | - | `@database/queries/ChapterQueries` | Mark prior chapters read |
| `resetFutureChaptersProgress` | - | `@database/queries/ChapterQueries` | Reset future chapter progress |
| `getRecentReadingChapters` | - | `@database/queries/ChapterQueries` | Get chapters with active progress |
| `updateChapterProgress` | `updateChapterProgressDb` | `@database/queries/ChapterQueries` | Update chapter progress |
| `markChapterUnread` | - | `@database/queries/ChapterQueries` | Mark chapter as unread |
| `markChapterRead` | - | `@database/queries/ChapterQueries` | Mark chapter as read |

### 2.6 Services (@services)

| Import | Source | Usage |
|--------|--------|-------|
| `TTSHighlight` | `@services/TTSHighlight` | TTS playback control |

**TTSHighlight Methods Used:**
- `speak()` - Single utterance playback
- `speakBatch()` - Batch TTS playback
- `addToBatch()` - Add to existing queue
- `stop()` - Stop playback
- `fullStop()` - Stop and clear restart flag
- `pause()` - Pause playback
- `setRestartInProgress()` - Restart flag management
- `isRestartInProgress()` - Check restart state
- `setRefillInProgress()` - Refill flag management
- `isRefillInProgress()` - Check refill state
- `hasRemainingItems()` - Check queue state
- `getSavedTTSPosition()` - Get native saved position
- `updateMediaState()` - Update notification
- `addListener()` - Event subscriptions

### 2.7 Plugins (@plugins)

| Import | Source | Usage |
|--------|--------|-------|
| `getPlugin` | `@plugins/pluginManager` | Get plugin for custom CSS/JS |

### 2.8 Strings/Translations

| Import | Source | Usage |
|--------|--------|-------|
| `getString` | `@strings/translations` | Localized strings |

### 2.9 Local Components (Reader Directory)

| Import | Source | Usage |
|--------|--------|-------|
| `useChapterContext` | `../ChapterContext` | Shared reader state |
| `TTSResumeDialog` | `./TTSResumeDialog` | Resume TTS confirmation |
| `TTSScrollSyncDialog` | `./TTSScrollSyncDialog` | Scroll position sync |
| `TTSManualModeDialog` | `./TTSManualModeDialog` | Manual mode switch |
| `TTSChapterSelectionDialog` | `./TTSChapterSelectionDialog` | Chapter conflict resolution |
| `TTSSyncDialog` | `./TTSSyncDialog` | Screen wake sync status |
| `TTSExitDialog` | `./TTSExitDialog` | Exit confirmation |
| `applyTtsUpdateToWebView` | `./ttsHelpers` | Inject TTS settings |
| `validateAndClampParagraphIndex` | `./ttsHelpers` | Index validation |

---

## 3. Test Coverage

### 3.1 Direct Tests

| Test File | Description | Coverage |
|-----------|-------------|----------|
| `WebViewReader.integration.test.tsx` | Integration tests for native TTS position restore | PREV chapter navigation |
| `WebViewReader.eventHandlers.test.tsx` | TTS event handler tests | Standard reading scenarios |
| `WebViewReader.applyTtsUpdate.test.tsx` | TTS settings update injection | Settings sync |

### 3.2 Helper Tests

| Test File | Description |
|-----------|-------------|
| `ttsHelpers.test.ts` | `applyTtsUpdateToWebView`, `validateAndClampParagraphIndex` |
| `ttsWakeUtils.test.js` | Screen wake utilities |

### 3.3 Dialog Component Tests

| Test File | Dialog |
|-----------|--------|
| `TTSChapterSelectionDialog.test.tsx` | Chapter selection |
| `TTSExitDialog.test.tsx` | Exit confirmation |
| `TTSManualModeDialog.test.tsx` | Manual mode |
| `TTSResumeDialog.test.tsx` | Resume confirmation |
| `TTSScrollSyncDialog.test.tsx` | Scroll sync |

### 3.4 Related Service Tests

| Test File | Description |
|-----------|-------------|
| `src/services/__tests__/TTSBugRegression.test.ts` | Bug regression tests (references WebViewReader) |
| `src/services/__tests__/TTSMediaControl.test.ts` | TTSHighlight service tests |

---

## 4. Public Interface

### 4.1 Export

```typescript
export default memo(WebViewReader);
```

### 4.2 Props

```typescript
type WebViewReaderProps = {
  onPress(): void;  // Callback triggered when hide action occurs
};
```

### 4.3 Internal Types

```typescript
type WebViewPostEvent = {
  type: string;
  data?: { [key: string]: string | number } | string[];
  startIndex?: number;
  autoStartTTS?: boolean;
  paragraphIndex?: number;
  ttsState?: any;
  chapterId?: number;
};
```

---

## 5. Context Dependencies

### 5.1 Required Context Provider

The component **MUST** be wrapped in `ChapterContextProvider` (from `src/screens/reader/ChapterContext.tsx`).

### 5.2 Values Consumed from useChapterContext()

| Property | Type | Usage |
|----------|------|-------|
| `novel` | `NovelInfo` | Novel metadata for TTS notifications, plugin lookup |
| `chapter` | `ChapterInfo` | Current chapter data, progress tracking |
| `chapterText` (aliased as `html`) | `string` | Chapter HTML content for WebView |
| `navigateChapter` | `(direction: 'NEXT' \| 'PREV') => void` | Chapter navigation |
| `saveProgress` | `(progress: number, paragraphIndex?: number, ttsState?: string) => void` | Progress persistence |
| `nextChapter` | `ChapterInfo \| null` | Next chapter reference |
| `prevChapter` | `ChapterInfo \| null` | Previous chapter reference |
| `webViewRef` | `RefObject<WebView>` | Shared WebView reference |
| `savedParagraphIndex` | `number \| undefined` | Saved reading position from DB |
| `getChapter` | `(chapter: ChapterInfo) => void` | Navigate to specific chapter |

### 5.3 Context Siblings (Other Consumers)

Files that also consume `useChapterContext`:
- `ReaderScreen.tsx`
- `ReaderFooter.tsx`
- `ReaderAppbar.tsx`
- `ChapterDrawer/index.tsx`
- `ReaderBottomSheet/ReaderTTSTab.tsx`

---

## 6. Impact Radius Assessment

### 6.1 File Counts

| Category | Count |
|----------|-------|
| Direct Dependents | 1 |
| Shared Context Consumers | 5 |
| TTS Dialog Components | 6 |
| Test Files | 10+ |
| Service Dependencies | 2 |

### 6.2 Change Risk Matrix

| Change Type | Risk Level | Affected Files | Notes |
|-------------|------------|----------------|-------|
| Props interface changes | 🟡 Medium | ReaderScreen.tsx | Single consumer |
| Context consumption changes | 🔴 High | 6+ files | All context consumers affected |
| TTS logic changes | 🔴 High | 8+ files | Dialogs, services, native modules |
| WebView message handlers | 🟡 Medium | JS assets, test files | core.js, index.js |
| Import path changes | 🟢 Low | 1 file | Only ReaderScreen.tsx |
| Helper function changes | 🟢 Low | 2 files | ttsHelpers.ts, tests |
| Dialog prop changes | 🟡 Medium | 6 dialog components | Each dialog independently |

### 6.3 Native Module Dependencies

| Module | Platform | File |
|--------|----------|------|
| `TTSHighlight` | Android | `android/app/src/main/java/.../TTSHighlightModule.kt` |
| `RNDeviceInfo` | Both | External package |

---

## 7. Architecture Diagram

```
                              ┌─────────────────┐
                              │  ReaderScreen   │
                              │    .tsx (L7)    │
                              └────────┬────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                      │
                    │    ┌────────────────────────────┐   │
                    │    │     ChapterContextProvider  │   │
                    │    └─────────────┬──────────────┘   │
                    │                  │                   │
          ┌─────────┴──────────────────┴───────────┬──────┴──────┐
          │                                         │              │
          ▼                                         ▼              ▼
┌─────────────────┐                      ┌─────────────────┐ ┌──────────┐
│  WebViewReader  │◄────────────────────►│  ReaderFooter   │ │ReaderApp │
│  (3379 lines)   │                      │                 │ │  bar     │
└────────┬────────┘                      └─────────────────┘ └──────────┘
         │
         ├──────────────────────────────────────────────────────────┐
         │                                                          │
    ┌────┴────┐    ┌──────────────┐    ┌──────────────┐    ┌───────┴───────┐
    │Services │    │   Dialogs    │    │   Utilities  │    │  JS Assets    │
    ├─────────┤    ├──────────────┤    ├──────────────┤    ├───────────────┤
    │TTSHigh- │    │TTSResume     │    │webviewSecur- │    │assets/js/     │
    │ light   │    │TTSScrollSync │    │   ity        │    │  core.js      │
    │TTSAudio │    │TTSManualMode │    │htmlParagraph │    │  index.js     │
    │ Manager │    │TTSChapterSel │    │   Extractor  │    │  tts.css      │
    └────┬────┘    │TTSSyncDialog │    │mmkv/mmkv     │    └───────────────┘
         │         │TTSExitDialog │    │Storages      │
         ▼         └──────────────┘    └──────────────┘
┌─────────────────┐
│  Native Module  │
│TTSHighlightMod- │
│   ule.kt        │
└─────────────────┘
```

---

## 8. Key Observations

### 8.1 Component Complexity
- **3,379 lines** - This is a very large component
- **30+ useRef hooks** - Heavy state management for TTS
- **Multiple useEffect hooks** - Complex side effect management
- **Single responsibility violation** - TTS orchestration could be extracted

### 8.2 TTS Orchestration
WebViewReader serves as the **primary TTS controller** with responsibilities:
- Native TTS playback control via TTSHighlight service
- WebView-JS bidirectional communication
- Background playback management
- Screen wake/sleep handling
- Chapter navigation during TTS
- Progress persistence (MMKV, DB, native SharedPreferences)

### 8.3 Single Consumer
Only `ReaderScreen.tsx` imports this component, making:
- **Refactoring simpler** - No need to update multiple import sites
- **API changes low-risk** - Single point of integration

### 8.4 Test Coverage
- **Good coverage** for integration scenarios
- **Event handlers tested** separately
- **Helper functions** have dedicated tests
- **Dialog components** independently tested

### 8.5 Potential Improvements
1. **Extract TTS Hook**: Create `useTTSController` custom hook to reduce component size
2. **Extract Message Handlers**: Move WebView message handling to separate module
3. **Reduce Ref Count**: Consider consolidating related refs into objects
4. **Add More Unit Tests**: Current tests focus on integration; more unit tests for edge cases

---

## Appendix: Reference Count Summary

| Dependency Type | Count |
|-----------------|-------|
| External npm packages | 5 |
| Internal utilities | 9 |
| Internal hooks | 10 |
| Database queries | 7 |
| Services | 1 (with 15+ methods) |
| Local components | 8 |
| Context values | 10 |
| **Total Imports** | **~50** |

---

## 9. Additional Findings (Verification Pass)

### 9.1 Confirmed Import Consumers

**Re-verified file imports:**
| File | Import Method | Line |
|------|--------------|------|
| `ReaderScreen.tsx` | Direct ES import | L7 |
| `WebViewReader.integration.test.tsx` | `require('../WebViewReader').default` | L189 |
| `WebViewReader.eventHandlers.test.tsx` | `require('../WebViewReader').default` | L197 |

**Component usage (JSX):**
| File | Usage | Line |
|------|-------|------|
| `ReaderScreen.tsx` | `<WebViewReader onPress={hideHeader} />` | L131 |
| `WebViewReader.integration.test.tsx` | `<WebViewReader onPress={jest.fn()} />` | L221, L266 |
| `WebViewReader.eventHandlers.test.tsx` | `<WebViewReader onPress={jest.fn()} />` | L234 |

### 9.2 Previously Missed Dependencies

#### WebView Assets (JS/CSS loaded at runtime)

**CSS Assets:** (from `android/app/src/main/assets/css/`)
| File | Purpose |
|------|---------|
| `index.css` | Base reader styles |
| `pageReader.css` | Page reader mode styles |
| `toolWrapper.css` | Tool UI styles |
| `tts.css` | TTS highlight styles |

**JS Assets:** (from `android/app/src/main/assets/js/`)
| File | Purpose |
|------|---------|
| `polyfill-onscrollend.js` | Scroll end polyfill |
| `icons.js` | SVG icon definitions |
| `van.js` | VanJS reactive UI library |
| `text-vibe.js` | Text selection haptics |
| `core.js` | Main reader logic (`window.reader`) |
| `index.js` | TTS logic (`window.tts`) |

#### Utility Module (Not Imported but Related)

| File | Purpose | Note |
|------|---------|------|
| `ttsWakeUtils.js` | Pure utility functions for TTS wake behavior | Exported for testing; logic duplicated inline in WebViewReader |

**Functions in `ttsWakeUtils.js`:**
- `computeInitialIndex()` - Calculate initial paragraph index
- `buildBatch()` - Build TTS batch from paragraphs
- `shouldIgnoreSaveEvent()` - Filter stale save events

### 9.3 Shared Helper Module (ttsHelpers.ts)

**IMPORTANT DISCOVERY:** The `ttsHelpers.ts` module exports functions used by multiple files:

| Consumer | Import | Usage |
|----------|--------|-------|
| `WebViewReader.tsx` | `applyTtsUpdateToWebView`, `validateAndClampParagraphIndex` | Direct imports, L50-53 |
| `SettingsReaderScreen.tsx` | `safeInjectJS` | WebView injection safety, L31 |

**Exported Functions from ttsHelpers.ts:**
1. `applyTtsUpdateToWebView()` - Inject TTS settings into WebView
2. `safeInjectJS()` - Safe wrapper for WebView JavaScript injection
3. `validateAndClampParagraphIndex()` - Clamp paragraph index to valid range

### 9.4 Transitive Dependencies

**Through TTSHighlight service:**
| Dependency | Source | Purpose |
|------------|--------|---------|
| `TTSAudioManager` | `@services/TTSAudioManager` | Manages TTS queue, refill logic |
| `VoiceMapper` | `@services/VoiceMapper` | Voice identifier mapping |
| Native `TTSHighlight` module | `NativeModules.TTSHighlight` | Android/iOS TTS engine bridge |

**Through ChapterContext:**
| Dependency | Source | Purpose |
|------------|--------|---------|
| `useChapter` hook | `../hooks/useChapter` | Chapter loading, navigation |
| `useNovelContext` | `@screens/novel/NovelContext` | Novel-level state |
| Database queries | `@database/queries/*` | Chapter CRUD operations |

### 9.5 Native Module Events

**Events subscribed to via `TTSHighlight.addListener()`:**
| Event | Handler Purpose |
|-------|-----------------|
| `onSpeechDone` | Play next paragraph from queue |
| `onWordRange` | Word-level highlighting |
| `onSpeechStart` | Paragraph highlighting, state sync |
| `onMediaAction` | Notification controls (play/pause/seek/chapter) |
| `onQueueEmpty` | Auto-advance to next chapter |
| `onVoiceFallback` | Voice unavailable notification |

**Other Event Subscriptions:**
| Source | Event | Handler |
|--------|-------|---------|
| `deviceInfoEmitter` | `RNDeviceInfo_batteryLevelDidChange` | Update battery display |
| `MMKVStorage` | Value change listener | Sync settings to WebView |
| `AppState` | `change` | Handle background/foreground transitions |

### 9.6 Ref Inventory (44+ refs)

| Ref Name | Type | Purpose |
|----------|------|---------|
| `webViewNonceRef` | `string` | Security nonce |
| `allowMessageRef` | `RateLimiter` | Message rate limiting |
| `toastMessageRef` | `string` | Toast content |
| `nextChapterScreenVisible` | `boolean` | Chapter transition state |
| `autoStartTTSRef` | `boolean` | Auto-start TTS flag |
| `forceStartFromParagraphZeroRef` | `boolean` | Force start from p0 |
| `isTTSReadingRef` | `boolean` | TTS active state |
| `ttsStateRef` | `any` | TTS restore state |
| `progressRef` | `number` | Current progress |
| `latestParagraphIndexRef` | `number` | Latest paragraph |
| `backgroundTTSPendingRef` | `boolean` | Background TTS flag |
| `prevChapterIdRef` | `number` | Previous chapter ID |
| `isTTSPlayingRef` | `boolean` | TTS playing state |
| `hasUserScrolledRef` | `boolean` | User scroll detection |
| `chapterTransitionTimeRef` | `number` | Chapter transition timestamp |
| `lastTTSPauseTimeRef` | `number` | Last pause timestamp |
| `isWebViewSyncedRef` | `boolean` | WebView sync state |
| `pendingScreenWakeSyncRef` | `boolean` | Wake sync pending |
| `autoResumeAfterWakeRef` | `boolean` | Auto-resume flag |
| `lastTTSChapterIdRef` | `number \| null` | Last TTS chapter |
| `wasReadingBeforeWakeRef` | `boolean` | Pre-wake state |
| `wakeChapterIdRef` | `number \| null` | Wake chapter ID |
| `wakeParagraphIndexRef` | `number \| null` | Wake paragraph |
| `wakeTransitionInProgressRef` | `boolean` | Wake transition flag |
| `capturedWakeParagraphIndexRef` | `number \| null` | Captured wake index |
| `ttsSessionRef` | `number` | TTS session counter |
| `wakeResumeGracePeriodRef` | `number` | Wake grace period |
| `lastMediaActionTimeRef` | `number` | Media action debounce |
| `mediaNavSourceChapterIdRef` | `number \| null` | Nav source chapter |
| `mediaNavDirectionRef` | `'NEXT' \| 'PREV' \| null` | Nav direction |
| `syncRetryCountRef` | `number` | Sync retry counter |
| `nextChapterRef` | `ChapterInfo \| null` | Next chapter ref |
| `navigateChapterRef` | `function` | Navigate function ref |
| `saveProgressRef` | `function` | Save progress ref |
| `readerSettingsRef` | `ChapterReaderSettings` | Settings ref |
| `chapterGeneralSettingsRef` | `ChapterGeneralSettings` | General settings ref |
| `pendingResumeIndexRef` | `number` | Pending resume index |
| `ttsScrollPromptDataRef` | `object \| null` | Scroll prompt data |
| `ttsQueueRef` | `object \| null` | TTS queue state |
| `currentParagraphIndexRef` | `number` | Current paragraph |
| `totalParagraphsRef` | `number` | Total paragraphs |
| `lastStaleLogTimeRef` | `number` | Log throttle |
| `isTTSPausedRef` | `boolean` | TTS paused state |
| `chaptersAutoPlayedRef` | `number` | Auto-played count |

### 9.7 Message Types Handled

**WebView → RN Messages (onMessage handler):**
| Type | Purpose |
|------|---------|
| `save` | Save reading progress |
| `request-tts-exit` | Exit confirmation needed |
| `exit-allowed` | Exit without confirmation |
| `tts-update-settings` | Update TTS settings |
| `hide` | Hide reader UI |
| `next` | Navigate to next chapter |
| `prev` | Navigate to previous chapter |
| `scroll-to` | Scroll to position |
| `log` | Console logging |
| `speak` | Start TTS playback |
| `stop-speak` | Stop TTS playback |
| `tts-state` | Update TTS state |
| `request-tts-confirmation` | Show resume dialog |
| `tts-resume-location-prompt` | Show location prompt |
| `tts-scroll-prompt` | Show scroll sync dialog |
| `tts-manual-mode-prompt` | Show manual mode dialog |
| `tts-positioned` | TTS positioned event |
| `tts-queue` | Queue paragraphs for batch TTS |
| `tts-apply-settings` | Apply TTS settings |
| `save-tts-position` | Save TTS button position |
| `show-toast` | Show toast message |
| `console` | Console passthrough |

### 9.8 Plugin Integration

**Custom Plugin Assets:**
```typescript
const pluginCustomJS = `file://${PLUGIN_STORAGE}/${plugin?.id}/custom.js`;
const pluginCustomCSS = `file://${PLUGIN_STORAGE}/${plugin?.id}/custom.css`;
```

Plugins can inject custom CSS and JS into the reader WebView.

## 10. Complete File Dependency Graph

### 10.1 Files That Depend on WebViewReader (Downstream)

```
WebViewReader.tsx
    └── ReaderScreen.tsx (direct consumer)
```

### 10.2 Files That WebViewReader Depends On (Upstream)

```
WebViewReader.tsx
├── Context
│   └── ChapterContext.tsx
│       └── hooks/useChapter.ts
│           └── NovelContext (from screens/novel/)
│
├── Services
│   ├── TTSHighlight.ts
│   │   ├── TTSAudioManager.ts
│   │   └── VoiceMapper.ts
│   └── pluginManager (getPlugin)
│
├── Components
│   ├── TTSResumeDialog.tsx
│   ├── TTSScrollSyncDialog.tsx
│   ├── TTSManualModeDialog.tsx
│   ├── TTSChapterSelectionDialog.tsx
│   ├── TTSSyncDialog.tsx
│   ├── TTSExitDialog.tsx
│   └── Toast.tsx (@components)
│
├── Hooks
│   ├── useTheme (@hooks/persisted)
│   ├── useChapterReaderSettings (@hooks/persisted)
│   ├── useBoolean (@hooks)
│   └── useBackHandler (@hooks)
│
├── Database
│   └── ChapterQueries.ts (7 functions)
│
├── Utilities
│   ├── webviewSecurity.ts
│   ├── mmkv/mmkv.ts
│   ├── Storages.ts
│   ├── htmlParagraphExtractor.ts
│   └── ttsHelpers.ts (local)
│       └── Also used by: SettingsReaderScreen.tsx
│
├── Translations
│   └── translations.ts
│
└── WebView Runtime Assets
    ├── css/index.css
    ├── css/pageReader.css
    ├── css/toolWrapper.css
    ├── css/tts.css
    ├── js/polyfill-onscrollend.js
    ├── js/icons.js
    ├── js/van.js
    ├── js/text-vibe.js
    ├── js/core.js (window.reader)
    └── js/index.js (window.tts)
```

### 10.3 Shared Dependencies (Impact Ripple)

**ttsHelpers.ts** is shared:
- WebViewReader.tsx → uses `applyTtsUpdateToWebView`, `validateAndClampParagraphIndex`
- SettingsReaderScreen.tsx → uses `safeInjectJS`

Changes to `ttsHelpers.ts` affect **2 screens**.

---

## 11. Dependency Summary Matrix

| Category | Count | Examples |
|----------|-------|----------|
| React hooks used | 7 | useState, useEffect, useMemo, useRef, useCallback, memo |
| External packages | 6 | react-native-webview, color, react-native-device-info, @react-navigation/native |
| Internal utilities | 9 | webviewSecurity, mmkv, Storages, htmlParagraphExtractor |
| Internal hooks | 4 | useTheme, useChapterReaderSettings, useBoolean, useBackHandler |
| Database queries | 7 | getChapter, updateChapterProgress, markChapterRead, etc. |
| Services | 1 (+2 transitive) | TTSHighlight (+ TTSAudioManager, VoiceMapper) |
| Local components | 8 | 6 dialogs + ttsHelpers + ChapterContext |
| WebView assets | 10 | 4 CSS + 6 JS files |
| Native events | 7 | TTS events + battery + app state + MMKV |
| Refs | 44+ | State management refs |
| Message types | 22+ | WebView ↔ RN communication |

---

## 12. Recommendations for Refactoring

### 12.1 High Priority
1. **Extract `useTTSController` hook** - Move all TTS-related refs and logic (~1500 lines) into a dedicated custom hook
2. **Extract message handlers** - Create `WebViewMessageHandler` module for the switch statement
3. **Consolidate refs into state objects** - Group related refs (e.g., `wakeRefs`, `ttsRefs`)

### 12.2 Medium Priority
4. **Create `TTSRefillManager`** - Extract queue refill logic
5. **Typed message parsing** - Use discriminated unions for WebView messages
6. **Document WebView ↔ RN protocol** - Create spec for message types

### 12.3 Low Priority
7. **Inline ttsWakeUtils** - Either fully integrate or import consistently
8. **Reduce magic numbers** - Extract constants (GRACE_PERIOD_MS, MEDIA_ACTION_DEBOUNCE_MS)
9. **Add JSDoc comments** - Document complex TTS flows

---

*Document generated by dependency analysis tool*  
*Last verified: 2025-12-14*
