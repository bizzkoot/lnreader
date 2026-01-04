# TTS Paragraph Index Desync Investigation

**Date**: 2026-01-04  
**Issue**: After reading middle dot paragraphs (`"······"`), TTS currentparagraph highlight becomes -1 offset from actual read position

---

## Problem Description

**User Report**:
> With current Chapter 214 contents, After the "······" or "······Hmph." paragraphs, 
> somehow afterwards the TTS current read will be -1 from the current paragraph highlight.

**Example**:
```
Paragraph 24: "Even for Woojin, who initially felt bewildered,"
Paragraph 25: "······"                                          ← TTS speaks this
Paragraph 26: "His equilibrium gradually stabilized..."         ← Highlight is here
                                                                 ← But TTS is actually reading paragraph 27
```

**Result**: Visual highlight lags 1 paragraph behind actual TTS playback.

---

## Root Cause Hypothesis

This is NOT a text normalization issue. This is likely a **paragraph index calculation error** in the batch TTS system.

### Possible Causes:

1. **Empty/whitespace-only paragraph skipping**
   - Middle dot paragraphs may have trimmed textContent
   - Batch TTS might skip them, but WebView includes them in index count
   - Result: Index mismatch between native TTS queue and WebView DOM

2. **UtteranceId parsing error**
   - Format: `chapter_${chapterId}_utterance_${paragraphIndex}`
   - If middle dot paragraph creates invalid utteranceId
   - Or native TTS skips it without calling `onSpeechDone`
   - Result: `currentParagraphIndexRef` not incremented

3. **OnSpeechDone race condition**
   - Middle dot paragraphs speak very quickly (500ms silence)
   - Multiple `onSpeechDone` events arrive in rapid succession
   - Event handler might miss an event or double-process
   - Result: Index counter off by ±1

4. **WebView vs Native paragraph counting mismatch**
   - WebView: `readableElements.length` includes middle dots
   - Native: TTS engine might skip punctuation-only text
   - Result: Different "total paragraphs" count

---

## Investigation Steps

### Step 1: Check if middle dot paragraphs are included in extractParagraphs

**File**: `src/utils/htmlParagraphExtractor.ts` (need to check)

**Question**: Does `extractParagraphs(html)` return empty strings for `"······"` paragraphs?

```typescript
// Expected behavior
const paragraphs = extractParagraphs(chapterHTML);
// Should include: ["paragraph 24", "······", "paragraph 26", ...]
//                                    ↑ Is this empty string ""?
```

**Test**:
```typescript
const testHTML = `
  <p>Even for Woojin, who initially felt bewildered,</p>
  <p>······</p>
  <p>His equilibrium gradually stabilized...</p>
`;
const result = extractParagraphs(testHTML);
console.log(result); // ["...", "······", "..."] or ["...", "", "..."]?
```

---

### Step 2: Check native TTS behavior with punctuation-only text

**File**: `android/app/src/main/java/com/rajarsheechatterjee/LNReader/TTSForegroundService.kt`

**Question**: Does Android TTS call `onDone()` callback for `"······"` text?

**Test scenario**:
```kotlin
// In TTSForegroundService
fun speakBatch(texts: List<String>, utteranceIds: List<String>, ...) {
    for (i in texts.indices) {
        val text = texts[i]
        println("TTSService: Queueing utteranceId=${utteranceIds[i]}, text='$text'")
        tts.speak(text, QUEUE_ADD, params, utteranceIds[i])
    }
}

// In UtteranceProgressListener
override fun onDone(utteranceId: String) {
    println("TTSService: onDone utteranceId=$utteranceId")
    ttsListener?.onSpeechDone(utteranceId)
}
```

**Expected outputs**:
```
TTSService: Queueing utteranceId=chapter_123_utterance_24, text='Even for Woojin...'
TTSService: Queueing utteranceId=chapter_123_utterance_25, text='······'
TTSService: Queueing utteranceId=chapter_123_utterance_26, text='His equilibrium...'

... (after speaking)

TTSService: onDone utteranceId=chapter_123_utterance_24
TTSService: onDone utteranceId=chapter_123_utterance_25  ← Does this fire?
TTSService: onDone utteranceId=chapter_123_utterance_26
```

**If `onDone` NOT called for utterance_25**:
- React Native never increments `currentParagraphIndexRef` from 24 → 25
- Next paragraph becomes 26, but ref is still 24
- Highlight shows paragraph 24, but TTS reads 26 (**-1 offset observed by user**)

---

### Step 3: Check utteranceId parsing in handleSpeechDone

**File**: `src/screens/reader/hooks/useTTSController.ts`

**Search for**: `handleSpeechDone` implementation

**Expected logic**:
```typescript
const handleSpeechDone = (event: { utteranceId: string }) => {
  // Parse utteranceId: "chapter_123_utterance_25"
  const parts = event.utteranceId.split('_');
  const paragraphIndex = parseInt(parts[parts.length - 1]);
  
  currentParagraphIndexRef.current = paragraphIndex;
  
  // Update highlight in WebView
  webViewRef.current?.injectJavaScript(`
    window.tts.highlightParagraph(${paragraphIndex});
  `);
};
```

**Potential bug**: If utteranceId parsing fails for middle dot paragraphs
- Middle dots might have special char encoding in utteranceId
- `parseInt("utterance_25_···")` → NaN
- Result: Index not updated, highlight stuck

---

### Step 4: Check WebView highlightParagraph implementation

**File**: `android/app/src/main/assets/js/core.js`

**Search for**: `highlightParagraph` function

**Expected logic**:
```javascript
window.tts.highlightParagraph = (paragraphIndex) => {
  const readableElements = reader.getReadableElements();
  if (readableElements[paragraphIndex]) {
    readableElements[paragraphIndex].classList.add('highlight');
  }
};
```

**Potential bug**: Off-by-one in array indexing
- If `readableElements` is 0-indexed but TTS uses 1-indexed
- Or vice versa
- Result: Highlight always 1 paragraph off

---

## Debugging Commands

### Test 1: Check extractParagraphs output
```bash
cd /Users/muhammadfaiz/Custom\ APP/LNreader
pnpm run test -- --testPathPattern="htmlParagraphExtractor"
```

### Test 2: Enable native TTS logging
```bash
adb logcat -s "TTSForegroundService:*" "TTSHighlightModule:*"
```

### Test 3: Enable WebView console logging
Add to `core.js`:
```javascript
window.tts.speak = function() {
  console.log(`TTS: Speaking paragraph ${paragraphIndex}, text="${text.substring(0, 20)}..."`);
  // ... existing code
};

window.tts.highlightParagraph = function(index) {
  console.log(`TTS: Highlighting paragraph ${index}`);
  // ... existing code
};
```

### Test 4: Add React Native debug logging
In `useTTSController.ts`:
```typescript
const handleSpeechDone = (event: { utteranceId: string }) => {
  console.log(`[TTS] onSpeechDone: ${event.utteranceId}`);
  const paragraphIndex = parseParagraphIndex(event.utteranceId);
  console.log(`[TTS] Parsed index: ${paragraphIndex}, current ref: ${currentParagraphIndexRef.current}`);
  // ... existing code
};
```

---

## Expected Test Results

### Scenario: Reading Chapter 214 with middle dots

**Input paragraphs** (indices 24-27):
```
24: "Even for Woojin, who initially felt bewildered,"
25: "······"
26: "His equilibrium gradually stabilized..."
27: "From the role's emotions to all his senses spread through his veins."
```

**Expected behavior**:
| Event | Paragraph Index | Highlight | TTS Speaking |
|-------|----------------|-----------|--------------|
| Start | 24 | ✅ 24 | 24: "Even for Woojin..." |
| onDone(24) | 25 | ✅ 25 | 25: "······" (500ms silence) |
| onDone(25) | 26 | ✅ 26 | 26: "His equilibrium..." |
| onDone(26) | 27 | ✅ 27 | 27: "From the role's..." |

**Actual behavior (reported by user)**:
| Event | Paragraph Index | Highlight | TTS Speaking |
|-------|----------------|-----------|--------------|
| Start | 24 | ✅ 24 | 24: "Even for Woojin..." |
| onDone(24) | 25 | ✅ 25 | 25: "······" |
| Missing onDone(25)? | 25 | ⚠️ 25 (stuck) | 26: "His equilibrium..." |
| onDone(26) | 26 | ⚠️ 26 | 27: "From the role's..." |

**Result**: Highlight is always -1 behind actual TTS playback after middle dots.

---

## Recommended Next Steps

1. ✅ **Add comprehensive logging** to all 3 layers (WebView, React Native, Native Android)
2. 🔬 **Test with Chapter 214** specifically, log every event
3. 📊 **Analyze log sequence** to identify missing/duplicate events
4. 🐛 **Identify root cause** (likely one of the 4 hypotheses above)
5. 🔧 **Implement fix** based on findings

---

## Preliminary Recommendation

Based on the symptom (-1 offset after middle dots), **most likely cause is #2**: 
Native TTS **does not fire `onSpeechDone`** for punctuation-only paragraphs like `"······"`.

**Potential fix** (if hypothesis confirmed):
```kotlin
// In TTSForegroundService.kt
override fun onStart(utteranceId: String) {
    // Detect if text is punctuation-only
    val text = getTextForUtteranceId(utteranceId)
    if (text.trim().matches(Regex("[·…—]+")) {
        // Pre-emptively fire onDone since TTS engine might skip it
        onDone(utteranceId)
    }
    ttsListener?.onSpeechStart(utteranceId)
}
```

Or in React Native layer:
```typescript
// In useTTSController.ts
const handleSpeechStart = (event: { utteranceId: string }) => {
  const paragraphIndex = parseParagraphIndex(event.utteranceId);
  const text = ttsQueueRef.current.texts[paragraphIndex];
  
  if (text.trim().match(/^[·…—]+$/)) {
    // Punctuation-only paragraph - force index update immediately
    currentParagraphIndexRef.current = paragraphIndex;
    webViewRef.current?.injectJavaScript(`
      window.tts.highlightParagraph(${paragraphIndex});
    `);
  }
};
```

---

**Status**: Awaiting log analysis to confirm hypothesis  
**Priority**: High (affects user experience in Japanese light novels with dramatic pauses)  
**Estimated Fix Time**: 2-4 hours (once root cause confirmed)
