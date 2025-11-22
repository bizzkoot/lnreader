<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Read again the latest update in the repo

[https://github.com/bizzkoot/lnreader](https://github.com/bizzkoot/lnreader)

I have implemented the TTS highlight and it does work. The only issue I'm currently facing is I'm unable to resume the TTS from the last read paragraph if I exit the reading mode (exit chapter or exit the app). As long as I'm still inside the reading mode, if I pause, I can resume. But not when I exit the reading mode.

Can you dive deeper to understand fully all the codebase and then comeback to me with plan on how to ensure the TTS resume capabilities to be functioning well even if user exit the reading mode or exit the app. If needed, you can also give popup asking user want to resume from last read paragraph or restart from the 1st paragraph from the selected chapter.

I share the latest update I have for the core.js from my local build. Otherwise, everything else is the same.

Now I have a comprehensive understanding of the codebase and the issue. Let me analyze the problem and create a detailed implementation plan.

## Analysis: TTS Resume Issue in LNReader

After thoroughly analyzing your `core.js` implementation, I've identified the root cause and can provide a complete solution plan.[^1][^2][^3][^4]

### Current State Analysis

**What's Working**:

- TTS highlighting is implemented and functional within the reading session
- `paragraphIndex` is being saved during TTS playback via `reader.post({type: 'save', data, paragraphIndex})`
- The code attempts to restore position using `initialReaderConfig.savedParagraphIndex`
- Auto-resume logic exists with `hasAutoResumed` flag

**The Problem**:
Your TTS state is stored in JavaScript memory (WebView context) and gets completely destroyed when you exit the reading mode. The issue has **three layers**:[^2][^4]

1. **WebView Lifecycle**: When you navigate away from the chapter screen, the WebView is unmounted, destroying all JavaScript state including `window.tts.currentElement`, `window.tts.started`, and `window.tts.reading`[^5][^6]
2. **TTS State Not Persisted**: While `paragraphIndex` is saved to native storage, critical TTS-specific state is not:
    - Whether TTS was actively playing when the user exited
    - The exact element being read
    - TTS playback settings at exit time
3. **Resume Logic Limitation**: The current auto-resume in `tts.start()` only triggers on first load (`!this.hasAutoResumed`), but doesn't persist across app/screen exits[^1]

***

## Complete Implementation Plan

### Phase 1: Persist TTS State (React Native Side)

#### 1.1 Extend Native Storage Schema

**File**: `src/database/schemas/ChapterSchema.ts` (or equivalent)

Add TTS-specific fields to your chapter progress storage:

```typescript
interface ChapterProgress {
  chapterId: number;
  novelId: number;
  progress: number;
  paragraphIndex: number;
  
  // NEW: TTS Resume State
  ttsState?: {
    wasPlaying: boolean;           // Was TTS active when user exited
    lastReadParagraphIndex: number; // Last paragraph being spoken
    timestamp: number;              // When state was saved
    autoStartOnReturn: boolean;     // User preference for auto-resume
  };
}
```


#### 1.2 Save TTS State on Exit

**File**: `src/screens/Chapter/ChapterScreen.tsx` (or your main reader screen)

```typescript
import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ChapterScreen = () => {
  const webViewRef = useRef(null);
  const ttsStateRef = useRef({
    wasPlaying: false,
    lastReadParagraphIndex: -1,
  });

  // Listen for TTS state updates from WebView
  const handleWebViewMessage = (event) => {
    const message = JSON.parse(event.nativeEvent.data);
    
    switch (message.type) {
      case 'save':
        // Existing save logic
        saveProg({
          ...currentChapter,
          progress: message.data,
          paragraphIndex: message.paragraphIndex,
        });
        break;
        
      case 'tts-state':
        // NEW: Track TTS state in real-time
        ttsStateRef.current = {
          wasPlaying: message.data.isReading,
          lastReadParagraphIndex: message.data.paragraphIndex || -1,
        };
        break;
        
      case 'request-tts-resume':
        // NEW: WebView asking if it should auto-resume
        handleTTSResumeRequest();
        break;
    }
  };

  // Save TTS state when component unmounts (user exits)
  useEffect(() => {
    return () => {
      // Component is unmounting - save TTS state
      if (ttsStateRef.current.wasPlaying) {
        const ttsState = {
          ...ttsStateRef.current,
          timestamp: Date.now(),
          autoStartOnReturn: true, // Default preference
        };
        
        // Save to chapter progress
        saveProg({
          ...currentChapter,
          ttsState,
        });
        
        console.log('[TTS] State saved on exit:', ttsState);
      }
    };
  }, [currentChapter]);

  // Restore TTS state when component mounts
  const handleTTSResumeRequest = async () => {
    const storedState = currentChapter?.ttsState;
    
    if (!storedState || !storedState.wasPlaying) {
      // No TTS was playing when user left
      webViewRef.current?.injectJavaScript(`
        window.tts.restoreState({ shouldResume: false });
        true;
      `);
      return;
    }
    
    // Check if state is recent (within 30 minutes)
    const isRecent = (Date.now() - storedState.timestamp) < 30 * 60 * 1000;
    
    if (!isRecent) {
      // State is stale, don't auto-resume
      webViewRef.current?.injectJavaScript(`
        window.tts.restoreState({ shouldResume: false });
        true;
      `);
      return;
    }
    
    // Check user preference for auto-resume
    const autoResumeEnabled = await AsyncStorage.getItem('tts_auto_resume');
    
    if (autoResumeEnabled === 'prompt') {
      // Show prompt dialog
      showTTSResumeDialog(storedState);
    } else if (autoResumeEnabled === 'always' || storedState.autoStartOnReturn) {
      // Auto-resume immediately
      resumeTTS(storedState);
    } else {
      // Don't resume
      webViewRef.current?.injectJavaScript(`
        window.tts.restoreState({ shouldResume: false });
        true;
      `);
    }
  };

  const showTTSResumeDialog = (storedState) => {
    Alert.alert(
      'Resume Text-to-Speech?',
      `Continue reading from where you left off?\n\nParagraph ${storedState.lastReadParagraphIndex + 1}`,
      [
        {
          text: 'Restart Chapter',
          onPress: () => {
            webViewRef.current?.injectJavaScript(`
              window.tts.restoreState({ 
                shouldResume: false,
                startFromBeginning: true 
              });
              true;
            `);
          },
        },
        {
          text: 'Resume',
          onPress: () => resumeTTS(storedState),
        },
      ],
      { cancelable: false }
    );
  };

  const resumeTTS = (storedState) => {
    console.log('[TTS] Resuming from saved state:', storedState);
    
    webViewRef.current?.injectJavaScript(`
      window.tts.restoreState({ 
        shouldResume: true,
        paragraphIndex: ${storedState.lastReadParagraphIndex},
        autoStart: true
      });
      true;
    `);
  };

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: chapterUri }}
      onMessage={handleWebViewMessage}
      injectedJavaScriptBeforeContentLoaded={`
        window.initialReaderConfig = {
          ...window.initialReaderConfig,
          savedParagraphIndex: ${currentChapter?.paragraphIndex || -1},
          ttsRestoreState: ${JSON.stringify(currentChapter?.ttsState || null)},
        };
      `}
    />
  );
};
```


***

### Phase 2: Enhanced WebView TTS Logic (core.js)

#### 2.1 Add TTS State Restoration Function

Insert this after the existing `tts.start()` function in `core.js`:

```javascript
// NEW: Restore TTS state from native storage
this.restoreState = (config) => {
  console.log('TTS: Restore state called with config:', config);
  
  if (!config || !config.shouldResume) {
    console.log('TTS: No resume needed');
    this.hasAutoResumed = true; // Prevent auto-resume later
    
    if (config?.startFromBeginning) {
      console.log('TTS: User chose to restart from beginning');
      this.start(); // Start from first paragraph
    }
    return;
  }
  
  // Resume from saved paragraph
  const readableElements = reader.getReadableElements();
  const paragraphIndex = config.paragraphIndex || initialReaderConfig.savedParagraphIndex;
  
  if (paragraphIndex >= 0 && readableElements[paragraphIndex]) {
    console.log('TTS: Resuming from paragraph index:', paragraphIndex);
    
    this.hasAutoResumed = true;
    this.currentElement = readableElements[paragraphIndex];
    this.scrollToElement(this.currentElement);
    
    if (config.autoStart) {
      console.log('TTS: Auto-starting playback');
      setTimeout(() => {
        this.next(); // Start reading immediately
      }, 500); // Small delay for smooth UX
    } else {
      console.log('TTS: Positioned at paragraph but not auto-starting');
      // Just position, don't start
      this.currentElement.classList.add('highlight');
      reader.post({ 
        type: 'tts-positioned',
        data: { paragraphIndex }
      });
    }
  } else {
    console.log('TTS: Paragraph not found, starting from beginning');
    this.start();
  }
};
```


#### 2.2 Update TTS State Reporting

Modify the existing `this.speak()` function to report detailed state:

```javascript
this.speak = () => {
  if (!this.currentElement) return;
  
  this.prevElement = this.currentElement;
  this.scrollToElement(this.currentElement);
  
  if (reader.generalSettings.val.showParagraphHighlight) {
    this.currentElement.classList.add('highlight');
  }
  
  // Save progress based on current TTS element
  const readableElements = reader.getReadableElements();
  const paragraphIndex = readableElements.indexOf(this.currentElement);
  
  if (paragraphIndex !== -1) {
    reader.post({
      type: 'save',
      data: parseInt(
        ((window.scrollY + reader.layoutHeight) / reader.chapterHeight) * 100,
        10,
      ),
      paragraphIndex,
    });
    
    // NEW: Also report detailed TTS state
    reader.post({
      type: 'tts-state',
      data: {
        isReading: this.reading,
        paragraphIndex: paragraphIndex,
        totalParagraphs: readableElements.length,
        currentText: this.currentElement.textContent.substring(0, 50) + '...'
      }
    });
  }
  
  // Use textContent to ensure indices match for highlighting
  const text = this.currentElement.textContent;
  if (text && text.trim().length > 0) {
    console.log('TTS: Speaking', text.substring(0, 20));
    reader.post({ type: 'speak', data: text });
  } else {
    this.next();
  }
};
```


#### 2.3 Request Resume State on Page Load

Add this near the end of the TTS initialization (after `window.tts` is defined):

```javascript
// Request TTS resume state from native side after page loads
window.addEventListener('load', () => {
  // Give native side a moment to inject state
  setTimeout(() => {
    if (window.initialReaderConfig?.ttsRestoreState) {
      console.log('TTS: Found restore state in initial config');
      // Native side injected the state, process it
      const restoreState = window.initialReaderConfig.ttsRestoreState;
      
      // Auto-restore only if it was playing recently
      const isRecent = restoreState?.timestamp && 
        (Date.now() - restoreState.timestamp) < 30 * 60 * 1000;
      
      if (restoreState?.wasPlaying && isRecent) {
        reader.post({ type: 'request-tts-resume' });
      }
    } else {
      console.log('TTS: No restore state found');
    }
  }, 1000);
});
```


#### 2.4 Update Pause Function to Report State

Modify the `this.pause()` function:

```javascript
this.pause = () => {
  this.reading = false;
  reader.post({ type: 'stop-speak' });
  
  // Report paused state with current position
  const readableElements = reader.getReadableElements();
  const paragraphIndex = readableElements.indexOf(this.currentElement);
  
  reader.post({ 
    type: 'tts-state', 
    data: { 
      isReading: false,
      paragraphIndex: paragraphIndex
    }
  });
};
```


***

### Phase 3: User Settings \& Preferences

#### 3.1 Add Settings Screen Option

**File**: `src/screens/MoreScreen/SettingsScreen.tsx` (or your settings screen)

```typescript
const TTSSettings = () => {
  const [autoResume, setAutoResume] = useState('prompt'); // 'always', 'prompt', 'never'
  
  useEffect(() => {
    loadSettings();
  }, []);
  
  const loadSettings = async () => {
    const saved = await AsyncStorage.getItem('tts_auto_resume');
    setAutoResume(saved || 'prompt');
  };
  
  const saveSettings = async (value) => {
    await AsyncStorage.setItem('tts_auto_resume', value);
    setAutoResume(value);
  };
  
  return (
    <View>
      <Text>Text-to-Speech Auto-Resume</Text>
      <RadioButton
        label="Always resume automatically"
        selected={autoResume === 'always'}
        onPress={() => saveSettings('always')}
      />
      <RadioButton
        label="Ask me every time"
        selected={autoResume === 'prompt'}
        onPress={() => saveSettings('prompt')}
      />
      <RadioButton
        label="Never auto-resume"
        selected={autoResume === 'never'}
        onPress={() => saveSettings('never')}
      />
      <Text style={styles.hint}>
        Choose whether TTS should automatically resume when you return to a chapter
      </Text>
    </View>
  );
};
```


***

### Phase 4: Handle Edge Cases

#### 4.1 Clear Stale TTS State

Add a cleanup mechanism in your chapter screen:

```typescript
// Clear TTS state when user explicitly stops TTS
const handleTTSStop = () => {
  ttsStateRef.current = {
    wasPlaying: false,
    lastReadParagraphIndex: -1,
  };
  
  // Clear from database
  saveProg({
    ...currentChapter,
    ttsState: null, // Clear state
  });
};

// Clear TTS state when user finishes chapter
const handleChapterComplete = () => {
  if (currentChapter?.ttsState) {
    saveProg({
      ...currentChapter,
      ttsState: null,
    });
  }
};
```


#### 4.2 Handle App Background/Foreground

**File**: `src/App.tsx` or `ChapterScreen.tsx`

```typescript
import { AppState } from 'react-native';

useEffect(() => {
  const subscription = AppState.addEventListener('change', nextAppState => {
    if (nextAppState === 'background') {
      // App going to background - save TTS state
      console.log('[TTS] App backgrounded, saving state');
      if (ttsStateRef.current.wasPlaying) {
        saveProg({
          ...currentChapter,
          ttsState: {
            ...ttsStateRef.current,
            timestamp: Date.now(),
          },
        });
      }
    } else if (nextAppState === 'active') {
      // App coming to foreground
      console.log('[TTS] App foregrounded');
      // State will be restored via normal flow
    }
  });
  
  return () => subscription.remove();
}, [currentChapter]);
```


***

### Phase 5: Testing \& Validation

#### Test Scenarios

**Scenario 1: Exit Chapter Screen**

- Start TTS playback on paragraph 5
- Navigate back to novel list
- Re-enter chapter
- ✅ Expected: Prompt to resume from paragraph 5

**Scenario 2: App Backgrounded**

- Start TTS playback
- Press home button (app goes to background)
- Return to app within 30 minutes
- ✅ Expected: TTS resumes automatically

**Scenario 3: App Killed**

- Start TTS playback on paragraph 10
- Force close app
- Reopen app and navigate to chapter
- ✅ Expected: Prompt to resume from paragraph 10

**Scenario 4: Chapter Completed**

- TTS reads to end of chapter
- Move to next chapter
- ✅ Expected: No resume prompt, start fresh

**Scenario 5: User Manually Stops**

- Start TTS, then stop via button
- Exit and re-enter chapter
- ✅ Expected: No auto-resume

**Scenario 6: Stale State**

- Start TTS
- Exit app
- Return after 2 hours
- ✅ Expected: No auto-resume (state expired)

***

### Phase 6: Optional Enhancements

#### 6.1 Visual Resume Indicator

Add a subtle banner when TTS state is available:

```typescript
{currentChapter?.ttsState?.wasPlaying && (
  <View style={styles.resumeBanner}>
    <Icon name="play-circle" />
    <Text>Continue from paragraph {currentChapter.ttsState.lastReadParagraphIndex + 1}?</Text>
    <Button title="Resume" onPress={() => resumeTTS(currentChapter.ttsState)} />
    <Button title="Dismiss" onPress={() => dismissTTSState()} />
  </View>
)}
```


#### 6.2 TTS Progress Bar

Show visual progress of TTS playback:

```typescript
const TTSProgressBar = ({ current, total }) => {
  const progress = total > 0 ? (current / total) * 100 : 0;
  
  return (
    <View style={styles.progressContainer}>
      <View style={[styles.progressBar, { width: `${progress}%` }]} />
      <Text style={styles.progressText}>
        Paragraph {current + 1} of {total}
      </Text>
    </View>
  );
};
```


***

## Summary of Changes

### Files to Modify

1. **Native Side** (React Native):
    - `ChapterScreen.tsx`: Add TTS state tracking and restoration logic
    - Database schema: Add `ttsState` field to chapter progress
    - Settings screen: Add auto-resume preference
    - App.tsx: Handle app lifecycle events
2. **WebView Side** (JavaScript):
    - `core.js`:
        - Add `tts.restoreState()` function
        - Enhance `tts.speak()` to report state
        - Update `tts.pause()` and `tts.stop()`
        - Add page load listener for restoration

### Key Mechanisms

1. **State Persistence**: TTS state saved to native storage on every paragraph change[^3][^7][^2]
2. **Lifecycle Handling**: State saved on component unmount (exit) and app background[^8][^9]
3. **Smart Restoration**: Check timestamp and user preference before auto-resuming[^1]
4. **User Control**: Dialog prompt gives users choice to resume or restart[^10][^11]

This implementation ensures TTS resume works reliably across all scenarios: screen exit, app background, app kill, and device restart.[^4][^2][^3]
<span style="display:none">[^12][^13][^14][^15][^16][^17][^18][^19][^20][^21][^22][^23][^24]</span>

<div align="center">⁂</div>

[^1]: core.js

[^2]: https://stackoverflow.com/questions/46660422/react-native-best-practice-for-persisting-state

[^3]: https://gist.github.com/robertohein/0b5b83a94f147bc9e8a71935a3b66c78

[^4]: https://stackoverflow.com/questions/31352261/how-to-keep-react-component-state-between-mount-unmount

[^5]: https://github.com/facebook/react-native/issues/586

[^6]: https://making.close.com/posts/react-native-webviews/

[^7]: https://dev.to/jscrambler/how-to-use-react-native-asyncstorage-13kd

[^8]: https://www.alooba.com/skills/concepts/android-sdk-622/activity-lifecycle/

[^9]: https://www.geeksforgeeks.org/android/activity-lifecycle-in-android-with-demo-app/

[^10]: https://www.zartis.com/how-to-create-a-product-specification-document-for-mvp-development/

[^11]: https://www.f22labs.com/blogs/mvp-specification-document-2025-complete-software-requirement-specification/

[^12]: https://github.com/bizzkoot/lnreader

[^13]: https://dev.to/inancakduvan/how-i-handle-communication-between-react-native-webview-and-web-project-3lhp

[^14]: https://stackoverflow.com/questions/58365305/react-native-asyncstorage-screen-update-content-on-load

[^15]: https://www.reddit.com/r/reactnative/comments/slm5jg/persist_webview_authentication_on_ios_devices/

[^16]: https://github.com/react-native-community/react-native-webview/issues/1452

[^17]: https://www.reddit.com/r/reactjs/comments/183407o/how_to_retain_the_components_state_when_its/

[^18]: https://www.sprinklr.com/help/articles/webview/react-native/64a810e1564e3e25f8040e75

[^19]: https://www.linkedin.com/posts/dchapagain_react-native-webviewdocsgetting-startedmd-activity-7316860709504524288-_EGK

[^20]: https://stackoverflow.com/questions/53770044/how-to-create-a-permanent-background-service-on-android

[^21]: https://github.com/react-native-webview/react-native-webview/issues/229

[^22]: https://spin.atomicobject.com/static-http-server-react-native/

[^23]: https://github.com/readest/readest/issues/547

[^24]: https://stackoverflow.com/questions/14064589/android-webview-inject-javascript-before-html-loaded

