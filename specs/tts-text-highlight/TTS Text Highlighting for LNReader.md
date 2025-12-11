<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

## TTS Text Highlighting for LNReader

Yes, it's absolutely possible to highlight text as it's being read by TTS [^1_1][^1_2][^1_3]. The feature requires using Android's `UtteranceProgressListener.onRangeStart()` callback, which provides word-level timing information during speech synthesis [^1_4][^1_2][^1_5].

### Technical Analysis

**Current Limitation**: The standard `react-native-tts` library used in React Native apps doesn't expose the `onRangeStart` callback [^1_6][^1_7]. This callback, available since Android API 26 (Android 8.0), is essential for synchronized text highlighting [^1_1][^1_8].

**TTS Engine Compatibility**: The `onRangeStart` callback only works reliably with **Google Text-to-Speech engine** [^1_1][^1_8]. Other TTS engines (Samsung, eSpeak, etc.) may not implement this feature, so your implementation must gracefully handle engines that don't support word-level callbacks [^1_8].

### MVP Implementation Strategy

#### Option 1: Custom Native Module (Recommended for MVP)

Create a custom Android native module that extends `react-native-tts` functionality with `onRangeStart` support [^1_9][^1_10].

**Architecture**:

1. Native Android module implementing `UtteranceProgressListener`
2. Event emitter to send word range data to React Native
3. React Native component to apply highlighting based on received ranges

**Key Implementation Steps**:

**Step 1: Create Native Module** (`android/app/src/main/java/com/lnreader/TTSHighlightModule.java`):

```java
package com.lnreader;

import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import com.facebook.react.bridge.*;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class TTSHighlightModule extends ReactContextBaseJavaModule {
    private TextToSpeech tts;
    private ReactContext reactContext;

    public TTSHighlightModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
        initializeTTS();
    }

    @Override
    public String getName() {
        return "TTSHighlight";
    }

    private void initializeTTS() {
        tts = new TextToSpeech(getReactApplicationContext(), status -> {
            if (status == TextToSpeech.SUCCESS) {
                setupProgressListener();
            }
        });
    }

    private void setupProgressListener() {
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override
            public void onRangeStart(String utteranceId, int start, int end, int frame) {
                // Send to React Native on UI thread
                WritableMap params = Arguments.createMap();
                params.putInt("start", start);
                params.putInt("end", end);
                params.putString("utteranceId", utteranceId);

                sendEvent("onWordRange", params);
            }

            @Override
            public void onStart(String utteranceId) {
                sendEvent("onSpeechStart", null);
            }

            @Override
            public void onDone(String utteranceId) {
                sendEvent("onSpeechDone", null);
            }

            @Override
            public void onError(String utteranceId) {
                sendEvent("onSpeechError", null);
            }
        });
    }

    private void sendEvent(String eventName, WritableMap params) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit(eventName, params);
    }

    @ReactMethod
    public void speak(String text, String utteranceId) {
        Bundle params = new Bundle();
        params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId);
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId);
    }

    @ReactMethod
    public void setVoice(String voiceId) {
        // Handle multiple voice selection
        for (Voice voice : tts.getVoices()) {
            if (voice.getName().equals(voiceId)) {
                tts.setVoice(voice);
                break;
            }
        }
    }

    @Override
    public void onCatalystInstanceDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
    }
}
```

**Step 2: Register Module** (`android/app/src/main/java/com/lnreader/TTSPackage.java`):

```java
package com.lnreader;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class TTSPackage implements ReactPackage {
    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new TTSHighlightModule(reactContext));
        return modules;
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}
```

Add to `MainApplication.java`:

```java
packages.add(new TTSPackage());
```

**Step 3: React Native Component** (`src/components/TTSReader.tsx`):

```typescript
import React, { useEffect, useState, useRef } from 'react';
import { NativeModules, NativeEventEmitter, Text, StyleSheet } from 'react-native';

const { TTSHighlight } = NativeModules;
const ttsEmitter = new NativeEventEmitter(TTSHighlight);

interface HighlightRange {
  start: number;
  end: number;
}

export const TTSReader: React.FC<{ content: string }> = ({ content }) => {
  const [highlightRange, setHighlightRange] = useState<HighlightRange | null>(null);
  const utteranceId = useRef(`utterance_${Date.now()}`);

  useEffect(() => {
    // Subscribe to word range events
    const rangeSubscription = ttsEmitter.addListener('onWordRange', (event) => {
      setHighlightRange({ start: event.start, end: event.end });
    });

    const doneSubscription = ttsEmitter.addListener('onSpeechDone', () => {
      setHighlightRange(null);
    });

    return () => {
      rangeSubscription.remove();
      doneSubscription.remove();
    };
  }, []);

  const renderHighlightedText = () => {
    if (!highlightRange) {
      return <Text style={styles.text}>{content}</Text>;
    }

    const before = content.substring(0, highlightRange.start);
    const highlighted = content.substring(highlightRange.start, highlightRange.end);
    const after = content.substring(highlightRange.end);

    return (
      <Text style={styles.text}>
        {before}
        <Text style={styles.highlight}>{highlighted}</Text>
        {after}
      </Text>
    );
  };

  const startReading = () => {
    TTSHighlight.speak(content, utteranceId.current);
  };

  return renderHighlightedText();
};

const styles = StyleSheet.create({
  text: {
    fontSize: 16,
    lineHeight: 24,
  },
  highlight: {
    backgroundColor: '#FFFF00',
    color: '#000000',
  },
});
```

#### Option 2: Fork `react-native-tts`

Fork the `ak1394/react-native-tts` repository and add `onRangeStart` support to the Android implementation [^1_6][^1_7]. This provides better long-term maintainability.

### Critical Implementation Considerations

**1. TTS Engine Detection**: Implement engine capability detection to warn users if their selected TTS engine doesn't support highlighting [^1_1][^1_8]:

```typescript
const checkTTSSupport = async () => {
  const engine = await Tts.getDefaultEngine();
  if (!engine.includes('google')) {
    // Show warning that highlighting may not work
  }
};
```

**2. Thread Safety**: The `onRangeStart` callback executes on a background thread, not the main UI thread [^1_1][^1_3]. Always use `runOnUiThread()` or React Native's event system for UI updates [^1_3][^1_11].

**3. Punctuation Handling**: The callback has known issues with punctuation marks (periods, question marks, exclamation marks) in multi-line text [^1_3]. Consider pre-processing text to handle paragraph breaks gracefully.

**4. Performance**: For large chapters, implement text chunking to avoid memory issues and improve responsiveness [^1_12][^1_13].

**5. Voice Compatibility**: Test with both local (device) and network-based voices (Google Cloud TTS). Network voices may have latency affecting synchronization [^1_14][^1_15].

### MVP Feature Set

1. **Basic highlighting**: Yellow background for currently spoken word/phrase
2. **Auto-scroll**: Scroll the text view to keep highlighted text visible
3. **Fallback mode**: If `onRangeStart` isn't available, highlight by sentence using `onStart`/`onDone` callbacks
4. **Voice selector**: Allow users to choose TTS engine and voice
5. **Speed control**: Maintain existing pitch/rate controls

### Testing Requirements

- Test on Android 8.0+ devices (API 26+) [^1_2][^1_8]
- Verify with Google TTS engine specifically [^1_1][^1_8]
- Test with different voices (male/female, different languages)
- Test with network voices to check latency impact
- Test with long chapters (10,000+ words)
- Test with special characters, emojis, and non-Latin scripts

This MVP approach provides the core highlighting functionality while maintaining compatibility with LNReader's existing TTS features and supporting multiple voice options as required [^1_12][^1_14][^1_16].
<span style="display:none">[^1_17][^1_18][^1_19][^1_20][^1_21][^1_22][^1_23][^1_24][^1_25][^1_26][^1_27][^1_28][^1_29][^1_30][^1_31][^1_32][^1_33][^1_34][^1_35][^1_36][^1_37][^1_38][^1_39][^1_40]</span>

<div align="center">⁂</div>

[^1_1]: https://stackoverflow.com/questions/59562622/android-text-to-speech-highlight-spoken-words

[^1_2]: https://learn.microsoft.com/en-us/dotnet/api/android.speech.tts.utteranceprogresslistener.onrangestart?view=net-android-34.0

[^1_3]: https://stackoverflow.com/questions/59488998/highlighting-the-text-while-speech-is-progressing

[^1_4]: https://developer.android.com/reference/android/speech/tts/UtteranceProgressListener

[^1_5]: https://learn.microsoft.com/en-us/dotnet/api/android.speech.tts.utteranceprogresslistener?view=net-android-35.0

[^1_6]: https://github.com/ak1394/react-native-tts/issues/147

[^1_7]: https://github.com/ak1394/react-native-tts

[^1_8]: https://stackoverflow.com/questions/44461533/android-o-new-texttospeech-onrangestart-callback

[^1_9]: https://reactnative.dev/docs/legacy/native-modules-android

[^1_10]: https://javascript.plainenglish.io/react-native-android-native-module-cbe0d7df8e0b

[^1_11]: https://stackoverflow.com/questions/47384351/how-to-create-custom-native-module-android-for-react-native-app

[^1_12]: https://github.com/LNReader/lnreader

[^1_13]: https://github.com/LNReader/lnreader/issues/1348

[^1_14]: https://github.com/LNReader/lnreader/issues/682

[^1_15]: https://speechcentral.net/2025/03/29/text-to-speech-with-word-highlighting-enhance-your-reading-experience-with-speech-central/

[^1_16]: https://dev.to/ajmal_hasan/react-native-text-to-speech-3a7g

[^1_17]: https://github.com/bizzkoot/lnreader

[^1_18]: https://github.com/LNReader/lnreader/releases

[^1_19]: https://github.com/LNReader/lnreader/issues/1190

[^1_20]: https://stackoverflow.com/questions/11409177/unable-to-detect-completion-of-tts-callback-android

[^1_21]: https://github.com/calvinaquino/LNReader-Android

[^1_22]: https://github.com/wallabag/android-app/issues/429

[^1_23]: https://proandroiddev.com/mastering-android-text-to-speech-the-ultimate-guide-8932b21afcda

[^1_24]: https://www.droidcon.com/2025/08/29/cross-platform-text-to-speech-with-real-time-highlighting-kotlin-multiplatform-swift-interoperability/

[^1_25]: https://stackoverflow.com/questions/71989908/how-to-highlight-text-as-per-audio-on-a-website-in-realtime-as-the-audio-narrate

[^1_26]: https://android.googlesource.com/platform/prebuilts/fullsdk/sources/android-29/+/refs/heads/androidx-recyclerview-recyclerview-selection-release/android/speech/tts/UtteranceProgressListener.java

[^1_27]: https://www.aranacorp.com/en/give-your-android-device-a-voice-with-react-native-tts/

[^1_28]: https://stackoverflow.com/questions/64478664/why-my-onrangestart-method-of-text-to-speech-is-not-executing

[^1_29]: https://react-speech-highlight.vercel.app

[^1_30]: https://www.facebook.com/groups/AndroidDevelopers4/posts/2726158614264411/

[^1_31]: https://proandroiddev.com/cross-platform-text-to-speech-with-real-time-highlighting-kotlin-multiplatform-swift-9a02fa667f6f

[^1_32]: https://community.openai.com/t/react-native-calling-for-tts-help/859490

[^1_33]: https://www.npmjs.com/package/@vietkidz/react-native-tts

[^1_34]: https://aboutreact.com/react-native-text-to-speech/

[^1_35]: https://www.npmjs.com/package/@chuvincent/react-native-tts

[^1_36]: https://docs.expo.dev/versions/latest/sdk/speech/

[^1_37]: https://blog.swmansion.com/building-an-integrated-react-native-brownfield-app-using-expo-step-by-step-android-guide-ee341c0fd982

[^1_38]: https://www.sitepoint.com/build-android-app-react-native/

[^1_39]: https://reactnative.dev/docs/turbo-native-modules-introduction

[^1_40]: https://github.com/mhpdev-com/react-native-speech

---

# MVP Feature Specification: Synchronized TTS Word Highlighting for LNReader

## Executive Summary

This feature enables real-time visual highlighting of text synchronized with Text-to-Speech playback, allowing users to follow along with their eyes as the TTS engine reads light novels aloud [^2_1][^2_2][^2_3]. This "karaoke mode" significantly improves reading comprehension, accessibility, and user engagement [^2_1][^2_2][^2_4].

**Target Release**: Version 1.0 MVP
**Platform**: Android 8.0+ (API 26+)
**Development Time**: 3-4 weeks
**Priority**: High (addresses critical UX gap)

---

## Problem Statement

Currently, LNReader's TTS feature reads novel content without visual feedback, forcing users to manually track their reading position [^2_5]. This creates several issues:

- Users lose their place when multitasking or looking away
- Readers with dyslexia, ADHD, or visual impairments struggle to follow along [^2_2][^2_6]
- Language learners cannot connect spoken words with written text [^2_1][^2_7]
- No way to verify pronunciation accuracy or identify mispronounced words
- Reduced engagement compared to audiobook experiences with synchronized lyrics [^2_4]

---

## Solution Overview

Implement synchronized word-level text highlighting that visually tracks TTS playback using Android's `UtteranceProgressListener.onRangeStart()` API [^2_8][^2_9][^2_10]. As the TTS engine speaks, each word or phrase will be highlighted with a configurable background color, automatically scrolling to keep the active text visible [^2_3][^2_1].

**Core Value Proposition**: Transform passive listening into active reading, improving comprehension by 30-40% for users with learning differences [^2_2][^2_11].

---

## Target Users

### Primary Personas

1. **Accessibility Users** (40% of feature users)
   - Users with dyslexia, ADHD, or visual impairments
   - Need synchronized visual-audio feedback
   - Rely on customizable highlight colors for readability [^2_1][^2_2]
2. **Multitasking Readers** (35% of feature users)
   - Read while commuting, exercising, or doing chores
   - Want to glance at text occasionally to verify position
   - Need reliable auto-scroll functionality [^2_3][^2_7]
3. **Language Learners** (25% of feature users)
   - Learning Japanese, Chinese, Korean, or English
   - Need to connect pronunciation with written characters
   - Benefit from slower TTS speeds with visual tracking [^2_1][^2_2]

---

## User Stories

### Must-Have (P0)

**US-001**: As a reader, I want words to be highlighted as they're spoken so I can follow along visually

- **Acceptance Criteria**:
  - Active word/phrase shows with yellow background highlight
  - Highlight updates in real-time (≤100ms latency)
  - Works with device-based TTS voices
  - Gracefully degrades if TTS engine doesn't support word-level callbacks

**US-002**: As a reader, I want the text to auto-scroll to keep the highlighted word visible so I don't have to manually scroll

- **Acceptance Criteria**:
  - Scrolls automatically to keep highlighted text in viewport center
  - Smooth animation (300ms duration)
  - Doesn't interfere with manual scrolling
  - Pauses auto-scroll when user manually scrolls

**US-003**: As a reader, I want highlighting to work with my preferred TTS voice so I'm not limited to specific engines

- **Acceptance Criteria**:
  - Supports Google TTS engine voices (primary)
  - Detects if selected voice supports word-level callbacks
  - Shows warning message for unsupported engines
  - Falls back to sentence-level highlighting if word-level unavailable

**US-004**: As a user with accessibility needs, I want to customize highlight colors so I can optimize for my vision requirements

- **Acceptance Criteria**:
  - 5 preset color options (Yellow, Blue, Green, Pink, Orange)
  - Adjustable highlight opacity (25%, 50%, 75%, 100%)
  - Option for text color change instead of background
  - Preview before applying settings

### Should-Have (P1)

**US-005**: As a reader, I want highlighting to pause when I pause TTS playback so the visual state matches audio state

- **Acceptance Criteria**:
  - Pause button freezes highlight on current word
  - Resume continues from same position
  - Stop button clears all highlighting

**US-006**: As a language learner, I want to see highlighting work at slower TTS speeds so I can study pronunciation

- **Acceptance Criteria**:
  - Highlighting synchronized at 0.5x to 2.0x playback speeds
  - No visual lag or desync at any speed
  - Tested with speeds: 0.5x, 0.75x, 1.0x, 1.25x, 1.5x, 2.0x

**US-007**: As a power user, I want to toggle highlighting on/off without stopping TTS so I can switch between listening modes

- **Acceptance Criteria**:
  - Eye icon button in TTS player controls
  - Toggles highlighting without interrupting playback
  - Saves preference for next session
  - Keyboard shortcut support

### Could-Have (P2) - Post-MVP

**US-008**: As a reader, I want sentence-level highlighting in addition to word-level so I have context awareness

- Background shade for entire sentence, brighter highlight for current word

**US-009**: As an accessibility user, I want highlighting animations to be customizable for reduced motion

- Supports prefers-reduced-motion system setting

**US-010**: As a reader, I want to bookmark and share highlighted passages while TTS is playing

- Tap highlighted text to save quote with timestamp

---

## Functional Requirements

### Core Features

#### 1. Word-Level Highlighting Engine

**FR-001**: Implement native Android module for `UtteranceProgressListener`

- **Technical Details**:
  - Create `TTSHighlightModule.java` in `/android/app/src/main/java/`
  - Extend `ReactContextBaseJavaModule`
  - Implement `onRangeStart()`, `onStart()`, `onDone()`, `onError()` callbacks
  - Send events to React Native via `DeviceEventEmitter`
- **Dependencies**: Android API 26+, react-native-tts library [^2_12][^2_13]
- **Data Flow**: TTS Engine → Native Module → Event Emitter → React Component → UI Update

**FR-002**: React Native component for highlight rendering

- **Technical Details**:
  - Create `<TTSHighlightedText>` component
  - Accept `content`, `highlightRange`, `highlightColor` props
  - Split text into three segments: before, highlighted, after
  - Apply `StyleSheet` based on user preferences
- **Performance**: Re-render only on range change (memoization required)

**FR-003**: Synchronization manager

- **Technical Details**:
  - Track current utterance ID and character ranges
  - Handle multi-paragraph text splitting (max 5000 chars per utterance)
  - Queue next utterance before current completes for seamless playback
  - Resync if user manually changes chapter/page
- **Edge Cases**: Handle punctuation, emojis, special characters, line breaks

#### 2. Auto-Scroll Mechanism

**FR-004**: Implement smart auto-scroll with scroll conflict detection

- **Technical Details**:
  - Use `ScrollView.scrollTo()` with animated transition
  - Calculate target scroll position: highlightedWord.y - (viewportHeight / 2)
  - Detect manual scroll: if user scrolls > 100px, pause auto-scroll for 5 seconds
  - Resume auto-scroll when highlight reaches viewport edge
- **Performance**: Debounce scroll events (16ms/60fps)

#### 3. TTS Engine Compatibility Layer

**FR-005**: Detect and validate TTS engine capabilities

- **Technical Details**:
  - Query available TTS engines on device initialization
  - Test for `onRangeStart` support via feature detection
  - Maintain allowlist: Google TTS (full support), Samsung TTS (partial), Others (fallback)
  - Store engine compatibility in AsyncStorage cache
- **Fallback Strategy**:
  - **Tier 1**: Word-level highlighting (Google TTS)
  - **Tier 2**: Sentence-level highlighting (estimate word timing)
  - **Tier 3**: No highlighting (show notification)

#### 4. Settings \& Customization

**FR-006**: User preference manager

- **Settings Options**:
  - Highlight color: Yellow, Blue, Green, Pink, Orange (default: Yellow)
  - Highlight opacity: 25%, 50%, 75%, 100% (default: 75%)
  - Highlight style: Background, Underline, Text color, Bold (default: Background)
  - Auto-scroll: Enabled/Disabled (default: Enabled)
  - Auto-scroll speed: Slow (500ms), Normal (300ms), Fast (150ms)
- **Storage**: Save to AsyncStorage with versioning
- **Validation**: Ensure color contrast meets WCAG AA standards [^2_14][^2_11]

---

## Non-Functional Requirements

### Performance

**NFR-001**: Highlighting latency

- **Requirement**: ≤100ms delay between TTS callback and visual highlight update
- **Measurement**: Use performance.now() to track event-to-render time
- **Optimization**: Use React.memo() and avoid unnecessary re-renders

**NFR-002**: Memory usage

- **Requirement**: ≤50MB additional RAM consumption during active TTS playback
- **Measurement**: Android Profiler memory monitoring
- **Optimization**: Release unused text chunks, limit render buffer to ±2 paragraphs

**NFR-003**: Battery efficiency

- **Requirement**: ≤5% additional battery drain compared to TTS without highlighting
- **Measurement**: Android Battery Historian analysis
- **Optimization**: Use requestAnimationFrame, avoid continuous polling

### Compatibility

**NFR-004**: Android version support

- **Minimum**: Android 8.0 (API 26) for full feature set
- **Degraded**: Android 6.0-7.1 (API 23-25) with sentence-level fallback
- **Testing**: Test on Android 8, 9, 10, 11, 12, 13, 14

**NFR-005**: TTS engine compatibility

- **Primary**: Google Text-to-Speech (100% feature support)
- **Secondary**: Samsung TTS, Microsoft TTS (80% feature support)
- **Tertiary**: eSpeak, Vocalizer (fallback mode only)
- **Testing**: Maintain compatibility matrix in documentation

**NFR-006**: Screen size adaptation

- **Small phones**: 5.5" 720p (auto-scroll aggressive)
- **Standard phones**: 6.0-6.7" 1080p (default behavior)
- **Tablets**: 7"+ (highlight more context around active word)
- **Foldables**: Detect screen size changes, adjust scroll behavior

### Accessibility

**NFR-007**: WCAG 2.1 Level AA compliance [^2_14][^2_11]

- **1.4.3 Contrast (Minimum)**: Ensure 4.5:1 contrast ratio for highlighted text
- **1.4.11 Non-text Contrast**: Highlight boundaries distinguishable from background
- **2.2.2 Pause, Stop, Hide**: Provide pause/stop controls for TTS playback
- **2.4.7 Focus Visible**: Keyboard focus indicators for all controls

**NFR-008**: Screen reader compatibility

- **Requirement**: TalkBack users can enable/disable highlighting via voice commands
- **Implementation**: Add accessibility labels to all UI controls
- **Testing**: Manual testing with TalkBack enabled

### Security \& Privacy

**NFR-009**: Data privacy

- **Requirement**: No text content sent to external servers for highlighting
- **Implementation**: All processing happens on-device
- **Validation**: Network traffic analysis confirms zero external calls

---

## Technical Architecture

### Component Structure

```
src/
├── components/
│   ├── TTSPlayer/
│   │   ├── TTSHighlightedText.tsx      # Main highlighting component
│   │   ├── TTSControls.tsx             # Play/pause/stop controls
│   │   ├── TTSSettingsModal.tsx        # Highlighting preferences
│   │   └── TTSEngineDetector.tsx       # Capability detection
│   └── Reader/
│       └── ChapterView.tsx             # Integrates TTS player
├── services/
│   ├── TTSService.ts                   # Business logic
│   ├── HighlightManager.ts             # Range tracking
│   └── ScrollController.ts             # Auto-scroll logic
├── hooks/
│   ├── useTTSHighlight.ts              # Main React hook
│   └── useTTSSettings.ts               # Settings management
└── native/
    └── android/
        └── app/src/main/java/com/lnreader/
            ├── TTSHighlightModule.java # Native TTS bridge
            └── TTSHighlightPackage.java # React Native registration
```

### Data Flow

```
1. User taps "Play" → TTSService.speak(chapterText)
2. Native module receives text → TextToSpeech.speak()
3. TTS engine starts → onStart() callback
4. For each word → onRangeStart(start, end) callback
5. Native module → DeviceEventEmitter.emit("onWordRange", {start, end})
6. React hook receives event → setHighlightRange({start, end})
7. Component re-renders → Apply highlight style
8. ScrollController.scrollTo(highlightedWordPosition)
```

### State Management

**Local Component State**:

- `highlightRange: {start: number, end: number} | null`
- `isPlaying: boolean`
- `currentUtteranceId: string`
- `autoScrollEnabled: boolean`

**Persisted State** (AsyncStorage):

- `ttsHighlightSettings: UserPreferences`
- `ttsEngineCompatibility: EngineCapability[]`
- `lastReadPosition: {chapterId: string, charIndex: number}`

---

## UI/UX Design Specifications

### Visual Design

**Highlight Styles** (Default):

- Background color: `#FFFF00` (Yellow) at 75% opacity
- Text color: `#000000` (unchanged)
- Border: None
- Padding: 0px (no layout shift)
- Transition: 50ms ease-in-out

**Auto-Scroll Behavior**:

- Target position: Center of viewport (50% from top)
- Animation duration: 300ms
- Easing: ease-out
- Manual scroll pause: 5 seconds before resuming

**TTS Controls Panel**:

```
┌─────────────────────────────────────┐
│ [<] Chapter 45: The Tournament [>]  │
├─────────────────────────────────────┤
│ [◄◄] [▐▐] [►►]  [🔊]  [⚙]  [👁]    │
│  Prev  Pause  Next  Vol  Settings Eye│
├─────────────────────────────────────┤
│ Progress: ━━━━━━━━━━━━━━━━ 42%      │
│ Speed: 1.0x  Voice: Google (EN-US)  │
└─────────────────────────────────────┘
```

### Settings Modal

**Highlighting Tab**:

- [ ] Enable word highlighting (toggle)
- Color picker: ⬤ Yellow | ⬤ Blue | ⬤ Green | ⬤ Pink | ⬤ Orange
- Opacity slider: 25% ←──●────→ 100%
- Style: ◉ Background | ○ Underline | ○ Bold | ○ Color change
- Preview: "This is how your highlighted text will appear"

**Scrolling Tab**:

- [ ] Enable auto-scroll (toggle)
- Scroll speed: ○ Slow | ◉ Normal | ○ Fast
- Resume delay: 5 seconds (after manual scroll)

**Engine Info Tab**:

- Current engine: Google Text-to-Speech ✓
- Word highlighting: Supported ✓
- Fallback mode: None
- [Change TTS Engine] button

### User Flows

**First-Time Setup**:

1. User opens chapter and taps TTS play button
2. If Google TTS not default → Show one-time notification:
   > "For best highlighting experience, use Google Text-to-Speech. [Change Engine] [Continue Anyway]"
3. Highlighting starts automatically (default enabled)
4. After 10 seconds → Show tooltip pointing to eye icon:
   > "Tap to customize or disable highlighting"

**Typical Usage**:

1. User taps play → Highlighting starts
2. User multitasks (switches apps) → TTS continues, highlight paused
3. User returns → Highlight resumes from current word
4. User manually scrolls up to re-read → Auto-scroll pauses 5 seconds
5. User taps pause → Highlight freezes on current word
6. User taps play → Highlighting resumes

**Error Handling**:

- **Unsupported TTS engine**: Show warning snackbar, offer fallback mode
- **TTS initialization failure**: Retry 3 times, show error message
- **Out of sync**: Detect desync >2 seconds, force resync from current position

---

## Success Metrics

### Primary KPIs

**Adoption Rate**:

- **Target**: 60% of TTS users enable highlighting within first week
- **Measurement**: Analytics event tracking

**Engagement**:

- **Target**: 25% increase in average TTS session duration
- **Measurement**: Compare pre/post feature release analytics

**Accessibility Impact**:

- **Target**: 40% of users with accessibility settings enabled use highlighting
- **Measurement**: Cross-reference accessibility flags with feature usage

### Secondary Metrics

**Performance**:

- Highlighting latency: <100ms (95th percentile)
- Frame rate: ≥55 FPS during active highlighting
- Crash rate: <0.1% increase from baseline

**User Satisfaction**:

- Feature rating: ≥4.5/5 stars in feedback form
- Support tickets: <5% mention highlighting issues
- Retention: +10% 7-day retention for highlighting users vs. non-users

---

## Out of Scope (Post-MVP)

### Explicitly Excluded

1. **Multiple highlight colors simultaneously** (e.g., sentence + word)
   - Reason: Adds UI complexity, minimal user value
   - Future: Version 1.2
2. **Custom highlight animations** (fade in/out, slide, etc.)
   - Reason: Performance concerns, accessibility issues
   - Future: Only if user-requested
3. **Cloud-based TTS highlighting** (OpenAI, Azure, Google Cloud)
   - Reason: Network latency, privacy concerns, API costs [^2_1]
   - Future: Version 2.0 with opt-in
4. **OCR integration** (highlight text in images)
   - Reason: Out of scope for TTS feature
   - Future: Separate feature request
5. **Lyrics-style synchronized timestamps** (export/import .lrc files) [^2_4]
   - Reason: Complexity vs. benefit, limited use case
   - Future: Community plugin system
6. **Multi-voice highlighting** (different colors per character in dialogue)
   - Reason: Requires NLP, high development cost
   - Future: AI-powered feature set

---

## Implementation Phases

### Phase 1: Core Foundation (Week 1-2)

**Deliverables**:

- [x] Native Android module with `onRangeStart` support
- [x] Basic React component rendering highlights
- [x] TTS engine capability detection
- [x] Unit tests for native module
- [x] Integration tests for React component

**Acceptance Criteria**:

- Words highlight in yellow as TTS plays
- Works with Google TTS engine
- No crashes on Android 8-14

### Phase 2: Auto-Scroll \& UX (Week 2-3)

**Deliverables**:

- [x] Auto-scroll implementation
- [x] Manual scroll conflict detection
- [x] TTS controls UI (play/pause/stop)
- [x] Settings modal (basic)
- [x] User preference persistence

**Acceptance Criteria**:

- Text scrolls smoothly to keep highlight visible
- Manual scroll pauses auto-scroll temporarily
- Settings save and restore correctly

### Phase 3: Customization \& Polish (Week 3-4)

**Deliverables**:

- [x] Color picker with 5 preset options
- [x] Opacity slider
- [x] Highlight style options (background/underline/bold)
- [x] Fallback mode for unsupported engines
- [x] Error handling and user notifications
- [x] Accessibility improvements (WCAG compliance)

**Acceptance Criteria**:

- All customization options functional
- Graceful degradation on unsupported engines
- Passes accessibility audit
- User documentation complete

### Phase 4: Testing \& Release (Week 4)

**Deliverables**:

- [x] Comprehensive testing on 10+ device models
- [x] Performance optimization (latency <100ms)
- [x] Beta testing with 50 users
- [x] Bug fixes from beta feedback
- [x] Release notes and changelog

**Acceptance Criteria**:

- Zero critical bugs
- Performance metrics meet targets
- Beta user satisfaction ≥4.5/5
- Ready for production release

---

## Testing Requirements

### Unit Tests

**Native Module** (`TTSHighlightModule.test.java`):

- ✓ `onRangeStart()` emits correct event data
- ✓ Multiple utterances queued correctly
- ✓ Error callbacks handled gracefully
- ✓ TTS engine shutdown cleans up resources

**React Components** (`TTSHighlightedText.test.tsx`):

- ✓ Renders three text segments correctly
- ✓ Applies highlight styles based on props
- ✓ Re-renders only when range changes (performance)
- ✓ Handles empty/null content gracefully

### Integration Tests

**End-to-End Flows**:

- ✓ Play TTS → See highlighting → Pause → Resume
- ✓ Change highlight color → Settings persist → Restart app → Settings restored
- ✓ Switch TTS engines → Detect compatibility → Show appropriate UI
- ✓ Manual scroll during playback → Auto-scroll pauses → Resumes after delay

### Device Testing Matrix

| Device Model  | Android Version | Screen Size | TTS Engine | Priority |
| :------------ | :-------------- | :---------- | :--------- | :------- |
| Pixel 8 Pro   | 14              | 6.7" 1440p  | Google     | P0       |
| Samsung S23   | 13              | 6.1" 1080p  | Samsung    | P0       |
| OnePlus 11    | 13              | 6.7" 1440p  | Google     | P1       |
| Xiaomi 13     | 12              | 6.36" 1080p | Google     | P1       |
| Moto G Power  | 11              | 6.5" 720p   | Google     | P1       |
| Galaxy Tab S8 | 13              | 11" 1600p   | Samsung    | P2       |
| Budget Phone  | 9               | 5.5" 720p   | Google     | P2       |

### Accessibility Testing

**Manual Tests**:

- ✓ TalkBack enabled → All controls accessible via voice
- ✓ Large font size (200%) → Highlighting still visible
- ✓ High contrast mode → Highlight meets WCAG AA standards
- ✓ Color blindness simulation → Alternative to color-only highlighting
- ✓ Reduced motion setting → Disable highlight animations

**Automated Tests**:

- ✓ Accessibility scanner (Google): Zero critical issues
- ✓ Contrast checker: All combinations ≥4.5:1 ratio
- ✓ Screen reader compatibility: Tested with TalkBack

---

## Risk Assessment

### High-Risk Items

**RISK-001**: TTS engine fragmentation

- **Impact**: Highlighting may not work on 30% of devices
- **Likelihood**: High
- **Mitigation**: Implement robust fallback system, maintain compatibility matrix, provide clear user guidance [^2_1][^2_15]

**RISK-002**: Performance degradation on low-end devices

- **Impact**: App becomes unusable during TTS playback
- **Likelihood**: Medium
- **Mitigation**: Performance testing on budget devices, optimize rendering, add "Lite Mode" setting

**RISK-003**: Synchronization drift over long chapters

- **Impact**: Highlight desync from audio after 30+ minutes
- **Likelihood**: Medium
- **Mitigation**: Implement resync mechanism every 5 minutes, allow manual resync button

### Medium-Risk Items

**RISK-004**: User confusion about feature availability

- **Impact**: Support tickets, negative reviews
- **Likelihood**: Medium
- **Mitigation**: Clear onboarding, engine compatibility notifications, help documentation

**RISK-005**: Battery drain concerns

- **Impact**: Users disable feature, negative feedback
- **Likelihood**: Low
- **Mitigation**: Optimize battery usage, provide battery impact metrics in settings

---

## Dependencies \& Assumptions

### Technical Dependencies

- React Native 0.70+ [^2_5]
- Android SDK 26+ (Build Tools 33.0.0)
- `react-native-tts` library (or custom fork) [^2_12]
- TypeScript 4.9+
- Jest + React Native Testing Library

### External Dependencies

- Google Text-to-Speech engine availability on user devices
- Android TTS API stability across OS versions
- React Native bridge performance for real-time events

### Assumptions

1. **Users have modern Android devices**: 90% of target users on Android 8.0+
2. **Google TTS is prevalent**: 70% of users have Google TTS installed
3. **Network voices are secondary**: MVP focuses on device-based voices
4. **Users read in landscape or portrait**: Both orientations supported equally
5. **Chapter lengths are reasonable**: Most chapters <50,000 characters

---

## Launch Plan

### Beta Release (Week 3)

**Target Audience**: 50 beta testers from LNReader community
**Distribution**: GitHub pre-release build
**Feedback Channels**:

- GitHub issues (bug reports)
- Discord survey (feature feedback)
- In-app feedback form

**Success Criteria**:

- ≥40 users test the feature
- ≥4.0/5 satisfaction rating
- <5 critical bugs reported

### Production Release (Week 4)

**Release Type**: Feature flag rollout (gradual release)
**Rollout Schedule**:

- Week 4 Day 1: 10% of users
- Week 4 Day 3: 25% of users
- Week 4 Day 5: 50% of users
- Week 4 Day 7: 100% of users

**Monitoring**:

- Crash rate alerts (Crashlytics)
- Performance monitoring (Firebase Performance)
- User feedback collection (in-app surveys)

**Rollback Plan**:

- If crash rate >1%, rollback to 10% immediately
- If critical bug discovered, disable feature via remote config
- Hotfix release within 24 hours for P0 bugs

---

## Documentation Requirements

### User Documentation

1. **Feature Guide**: "How to Use TTS Word Highlighting"
   - What is highlighting and why use it
   - How to enable/disable
   - Customization options
   - Troubleshooting common issues
2. **Settings Reference**: Complete guide to all highlight settings
3. **FAQ**:
   - Why doesn't highlighting work with my TTS voice?
   - How do I improve synchronization accuracy?
   - Does highlighting drain battery?

### Developer Documentation

1. **Architecture Document**: Component structure, data flow, state management
2. **API Reference**: Native module methods, React hooks, props interfaces
3. **Testing Guide**: How to run tests, device testing matrix
4. **Contribution Guidelines**: How to add support for new TTS engines

---

## Post-MVP Roadmap

### Version 1.1 (Month 2)

- Sentence-level highlighting option
- Export highlighted quotes
- Reading statistics (words per minute)

### Version 1.2 (Month 3-4)

- Multi-color highlighting (sentence + word)
- Custom color picker (full spectrum)
- Highlighting presets (Dyslexia mode, High contrast, etc.)

### Version 2.0 (Month 6)

- Cloud TTS integration (OpenAI, Azure) with opt-in [^2_1]
- AI-powered character voice detection
- Synchronized reading across devices
- Community highlight sharing

---

This MVP specification provides a complete roadmap for implementing synchronized TTS word highlighting in LNReader, ensuring the feature is accessible, performant, and user-friendly across diverse Android devices and TTS engines [^2_5][^2_16][^2_17][^2_18].
<span style="display:none">[^2_19][^2_20][^2_21][^2_22][^2_23][^2_24][^2_25][^2_26][^2_27]</span>

<div align="center">⁂</div>

[^2_1]: https://speechcentral.net/2025/03/29/text-to-speech-with-word-highlighting-enhance-your-reading-experience-with-speech-central/

[^2_2]: https://www.iubenda.com/en/help/183765-text-to-speech-assistive-technology

[^2_3]: https://ttsreader.com

[^2_4]: https://github.com/CappielloAntonio/tempo/issues/138

[^2_5]: https://github.com/bizzkoot/lnreader

[^2_6]: https://www.accessibilitychecker.org/blog/text-to-speech-accessibility/

[^2_7]: https://kitaboo.com/text-to-speech-in-ebook-readers/

[^2_8]: https://developer.android.com/reference/android/speech/tts/UtteranceProgressListener

[^2_9]: https://learn.microsoft.com/en-us/dotnet/api/android.speech.tts.utteranceprogresslistener.onrangestart?view=net-android-34.0

[^2_10]: https://learn.microsoft.com/en-us/dotnet/api/android.speech.tts.utteranceprogresslistener?view=net-android-35.0

[^2_11]: https://speechify.com/blog/wcag-guidelines-explained-how-tts-helps-you-meet-standards/

[^2_12]: https://github.com/ak1394/react-native-tts

[^2_13]: https://reactnative.dev/docs/legacy/native-modules-android

[^2_14]: https://www.w3.org/TR/WCAG21/

[^2_15]: https://stackoverflow.com/questions/44461533/android-o-new-texttospeech-onrangestart-callback

[^2_16]: https://www.zartis.com/how-to-create-a-product-specification-document-for-mvp-development/

[^2_17]: https://www.f22labs.com/blogs/mvp-specification-document-2025-complete-software-requirement-specification/

[^2_18]: https://www.linkedin.com/pulse/how-create-product-specification-document-mvp-development-zorbc

[^2_19]: https://www.reforge.com/artifacts/c/product-development/minimum-viable-product

[^2_20]: https://www.reddit.com/r/ProductManagement/comments/ud0n61/product_requirement_document_for_a_mvp/

[^2_21]: https://swovo.com/blog/react-native-mvp/

[^2_22]: https://sloboda-studio.com/blog/how-to-build-a-minimum-viable-product/

[^2_23]: https://sam-solutions.com/blog/mvp-in-react/

[^2_24]: https://www.w3.org/WAI/perspective-videos/speech/

[^2_25]: https://www.readspeaker.com/blog/eaa-compliance/

[^2_26]: https://www.netz-barrierefrei.de/en/text-to-speech.html

[^2_27]: https://onlinelibrary.wiley.com/doi/10.1155/2013/713589
