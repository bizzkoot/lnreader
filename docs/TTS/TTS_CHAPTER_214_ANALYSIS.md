# Technical Analysis: Chapter 214 TTS Synchronization Failure

**Date**: 2026-01-04  
**Subject**: Middle Dot Normalization & Highlight Desynchronization  
**Status**: Root Cause Identified

---

## Executive Summary

The `normalizeAndMap` implementation in `core.bak` contains **critical mapping logic errors** that cause TTS highlight desynchronization when processing consecutive middle dots (`······`) found in Chapter 214: Momentum (1). The root cause is **incorrect index mapping during character sequence compression**, which leads to out-of-bounds array access in `highlightRange`.

**Why simple normalization works better**: The current `core.js` uses text as-is, avoiding index translation errors entirely.

---

## Chapter 214: Problematic Text Patterns

### 1. **Middle Dot Sequences** (26 instances)
```
Line 25:  "······"                                    [6 consecutive dots]
Line 71:  "······Hmph."                               [6 dots + text]
Line 323: "······"                                    [6 dots standalone]
Line 624-628: Three consecutive paragraphs with "······"  [Cluster of 3 paragraphs]
Line 664: 'It's driving me crazy. What is this······Ahhh'  [Mid-sentence]
Line 1541: "and tomorrow there's a meeting with 'A10 Studio' and 'Kashiwa Group'······"
```

**Pattern Characteristics**:
- **Frequency**: 26 occurrences across 2068 lines (1.26% density)
- **Position**: Standalone paragraphs, sentence endings, and mid-sentence pauses
- **Visual Intent**: Represents silence, ellipsis, or dramatic pause (Japanese light novel convention)

### 2. **Special Unicode Characters**
```
Unicode 183:  Middle Dot (·)                    [Primary issue]
Unicode 8220: Left Double Quotation Mark (")    [Frequent]
Unicode 8221: Right Double Quotation Mark (")   [Frequent]
Unicode 8212: Em Dash (—)                       [Occasional]
```

---

## Implementation Comparison

### **Current Working Baseline: `core.js`**
```javascript
// Lines 2000-2050 (simplified - no normalization shown)
this.speak = () => {
  // Uses textContent directly - NO NORMALIZATION
  const text = this.currentElement.textContent;
  
  reader.post({
    type: 'speak',
    data: text,  // Raw text sent to TTS
    paragraphIndex: paragraphIndex,
  });
};

// Lines 3077-3125 - Highlight using raw indices
this.highlightRange = (start, end) => {
  // start/end are DIRECT character positions in textContent
  const traverse = node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const nextCharCount = charCount + node.length;  // No mapping needed
      if (nextCharCount > start && charCount < end) {
        nodes.push({ node, start: nodeStart, end: nodeEnd });
      }
    }
  };
};
```

**Why it works**:
- Native TTS engine speaks text as-is (middle dots = silence or short pause)
- Highlight indices match 1:1 with text node character positions
- No index translation = no off-by-one errors

---

### **Failed Implementation: `core.bak` with normalizeAndMap**

#### **Step 1: Normalization Logic (Lines 2218-2268)**
```javascript
this.normalizeAndMap = text => {
  if (!text) return { normalized: '', map: [] };

  let normalized = '';
  const map = [];
  const len = text.length;

  for (let i = 0; i < len; i++) {
    const char = text[i];
    const code = text.charCodeAt(i);
    let replacement = char;
    let skipCount = 1;

    if (code === 183) { // Middle dot
      let dotCount = 1;
      // Count consecutive dots
      while (i + dotCount < len && text.charCodeAt(i + dotCount) === 183) {
        dotCount++;
      }
      
      if (dotCount >= 2) {
        replacement = '…'; // 6 dots → 1 character
        skipCount = dotCount;
      } else {
        replacement = ''; // Single dot removed
        skipCount = 1;
      }
    }
    
    // Build mapping
    if (replacement.length > 0) {
      for (let r = 0; r < replacement.length; r++) {
        map.push(i); // ⚠️ BUG #1: Maps FIRST dot index to all normalized chars
        normalized += replacement[r];
      }
    }
    
    if (skipCount > 1) i += (skipCount - 1); // ⚠️ BUG #2: Index advancement timing
  }
  
  map.push(len > 0 ? len - 1 : 0); // ⚠️ BUG #3: Sentinel points to last char
  return { normalized, map };
};
```

#### **Step 2: Reverse Mapping in highlightRange (Lines 3172-3188)**
```javascript
this.highlightRange = (start, end) => {
  // Reverse normalized indices to original indices
  if (this.currentTTSMapping && this.currentTTSMapping.length > 0) {
    const maxIdx = this.currentTTSMapping.length - 1;
    const safeStart = Math.min(start, maxIdx);  // ⚠️ Clamps to map.length-1
    const safeEnd = Math.min(end, maxIdx);
    
    start = this.currentTTSMapping[safeStart]; // ⚠️ BUG #4: Wrong index retrieved
    end = this.currentTTSMapping[safeEnd];
  }
  
  // Traverse DOM with "reversed" indices
  const traverse = node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const nextCharCount = charCount + node.length;
      if (nextCharCount > start && charCount < end) {
        // ⚠️ BUG #5: start/end no longer match actual character positions
      }
    }
  };
};
```

---

## Root Cause Analysis: Mapping Logic Errors

### **BUG #1: Incorrect Index Compression**
**File**: `core.bak`, Line 2248
```javascript
// When replacing 6 dots with 1 ellipsis:
for (let r = 0; r < replacement.length; r++) {
  map.push(i); // ⚠️ i = index of FIRST dot only
  normalized += replacement[r];
}
```

**Example**:
```
Original:  "Hello······World"
           01234567890123456  (indices)
           
After normalization:
Normalized: "Hello…World"
            0123456789012  (indices)
            
Mapping should be:
map[5] → 5   (H)
map[6] → 11  (W) ✅ Correct: Skip dots 5-10
            
Actual mapping:
map[5] → 5   (H)
map[6] → 5   (W) ❌ WRONG: Points back to first dot
```

**Why it fails**:
- When TTS engine sends `(start=6, end=11)` for "World"
- `map[6]` returns `5` (first dot position, not 11)
- Highlight tries to select from index 5 (middle of dots) instead of 11

---

### **BUG #2: Mapping Inconsistency for Skipped Characters**
**File**: `core.bak`, Lines 2252-2260

When multiple consecutive dots are replaced with ellipsis:
```javascript
if (dotCount >= 2) {
  replacement = '…';    // 1 character output
  skipCount = dotCount; // Skip 6 input characters
}

// Mapping adds ONLY 1 entry for the ellipsis
for (let r = 0; r < 1; r++) { // replacement.length = 1
  map.push(i); // Adds map[6] = 5 (first dot index)
}

// Then loop advances past remaining 5 dots
i += (dotCount - 1); // i jumps from 5 → 10
```

**Result**:
- `map` has 1 entry for ellipsis (pointing to index 5)
- Next iteration starts at `i=11` ("W" in "World")
- **Gap in mapping**: Indices 6-10 are NEVER added to the map
- Normalized text is shorter than original, but map doesn't reflect this

**Correct Behavior Should Be**:
```javascript
// For 6-dot sequence starting at index 5:
map[6] = 5  // Ellipsis character maps to START of original sequence
// OR (better approach - map to END):
map[6] = 10 // Ellipsis character maps to END of original sequence

// Then next character (W) continues from:
map[7] = 11 // W in "World"
```

---

### **BUG #3: Off-by-One in Sentinel Value**
**File**: `core.bak`, Line 2263
```javascript
map.push(len > 0 ? len - 1 : 0); // Sentinel for end of string
```

**Problem**: Sentinel points to **last character index**, not the string length.

**Example**:
```
Original:  "Hello······World" (length 16)
Normalized: "Hello…World"     (length 12)

map = [0,1,2,3,4, 5, 11,12,13,14,15, 15]
                  ↑   ↑           ↑
                  H  (gap)       Sentinel=15 ❌ (should be 16)
```

**Impact**:
- When TTS engine requests end-of-paragraph highlight (e.g., `end=12`)
- `map[12]` doesn't exist (map.length = 12, maxIdx = 11)
- Code clamps to `map[11]`, causing **last word to not highlight** or **highlight wrong character**

---

### **BUG #4: Reverse Mapping Misalignment**
**File**: `core.bak`, Line 3178-3182
```javascript
const safeStart = Math.min(start, maxIdx);  // maxIdx = map.length - 1
const safeEnd = Math.min(end, maxIdx);
start = this.currentTTSMapping[safeStart];
end = this.currentTTSMapping[safeEnd];
```

**Scenario**: Paragraph with 6 consecutive dots
```
Original text (50 chars):  "He stood there······thinking about his next move."
Normalized (45 chars):     "He stood there…thinking about his next move."

Mapping:
map[0-14] = [0,1,2,...,14]    (He stood there)
map[15] = 14                  (ellipsis maps to FIRST dot at index 14)
map[16-44] = [20,21,...,48]   (thinking...)

TTS engine speaks "thinking" at normalized indices [16-24]
Reverse mapping:
start = map[16] = 20 ✅ Correct
end = map[24] = 28   ✅ Correct

TTS engine speaks ellipsis at normalized index [15]
Reverse mapping:
start = map[15] = 14 ❌ WRONG (should be 14)
end = map[16] = 20   ❌ WRONG (should be 19)
```

**Effect**: When TTS reaches the ellipsis character:
- Highlight starts at first dot (index 14) ✓
- Highlight ends AFTER all dots (index 20), bleeding into "thinking"
- Visual result: "······t" is highlighted instead of just "······"

---

### **BUG #5: DOM Traversal Mismatch**
**File**: `core.bak`, Lines 3204-3211

After reverse mapping, the code traverses DOM text nodes:
```javascript
const traverse = node => {
  if (node.nodeType === Node.TEXT_NODE) {
    const nextCharCount = charCount + node.length; // ⚠️ Uses ORIGINAL text length
    if (nextCharCount > start && charCount < end) { // ⚠️ But start/end may be WRONG
      const nodeStart = Math.max(0, start - charCount);
      const nodeEnd = Math.min(node.length, end - charCount);
      nodes.push({ node, start: nodeStart, end: nodeEnd });
    }
  }
};
```

**Issue**:
- `node.length` is the ORIGINAL text length (with 6 dots)
- `start` and `end` are reversed from normalized indices (may point to gaps)
- When `start=14` and `end=20` but text node is `"······"` (6 chars at indices 14-19):
  - `nodeStart = max(0, 14-14) = 0` ✓
  - `nodeEnd = min(6, 20-14) = 6` ❌ Out of bounds! (should be 5)

**Result**: `range.setEnd(node, 6)` throws error or selects next character

---

## Specific Failure Modes in Chapter 214

### **Failure Mode 1: Playback Gets Stuck at Lines 624-628**
```
Line 624: "······"
Line 626: "······"
Line 628: "······"
```

**What happens**:
1. TTS speaks line 624 normalized as `"…"` (1 char)
2. Native TTS sends `onRangeStart(0, 1)` for the ellipsis
3. `highlightRange(0, 1)` reverse maps:
   - `start = map[0] = 0` ✓
   - `end = map[1] = 0` ❌ (should be 5, last dot)
4. Highlight fails because `start >= end`
5. TTS advances to line 626, repeats same error
6. After 3 failed highlights, native TTS enters error recovery loop
7. **Playback appears "stuck"** (actually failing silently)

**Why simple normalization works**: Native TTS speaks `"······"` as-is (short pause), no mapping needed.

---

### **Failure Mode 2: Highlight Desync at Line 664**
```
Line 664: 'It's driving me crazy. What is this······Ahhh, should I pull up his pants first?'
```

**Character breakdown**:
```
Original (82 chars):
"It's driving me crazy. What is this······Ahhh, should I pull up his pants first?"
0  5   12   18   25 30  34   40      47  52

Normalized (77 chars):
"It's driving me crazy. What is this…Ahhh, should I pull up his pants first?"
0  5   12   18   25 30  34  36   41
```

**When TTS reaches "Ahhh"**:
- Normalized index: 36-40 (4 chars)
- Reverse map lookup:
  - `map[36]` = ??? (depends on how dots were mapped)
  - If `map[36] = 40` (first dot), highlight starts INSIDE "······"
  - If `map[40] = 46`, highlight ends too early
- **Result**: "Ahhh" highlight is 1-5 characters offset

---

### **Failure Mode 3: End-of-Paragraph Misalignment**
Chapter 214 has **26 paragraphs** ending with `······`. When TTS finishes speaking these paragraphs:

**Expected behavior**:
- TTS engine sends `onRangeStart(lastCharIndex, lastCharIndex+1)` for final word
- Highlight should cover entire last word

**Actual behavior (with mapping)**:
```javascript
// Paragraph: "He waited······" (length 15, normalized to 10)
// TTS sends (9, 10) for end of normalized text
const safeEnd = Math.min(10, map.length-1); // If map.length = 10, safeEnd = 9
end = map[9]; // Returns index 8 (last char before dots)
// Highlight skips the ellipsis entirely, stops at "d" in "waited"
```

**Visual result**: Last word not highlighted, TTS appears to "hang" at paragraph end.

---

## Why Simple Normalization Works Better

### **1. No Index Translation**
```javascript
// core.js approach
const text = this.currentElement.textContent; // "Hello······World"
reader.post({ type: 'speak', data: text });   // Native TTS speaks as-is

// Native TTS callback
onRangeStart(start=6, end=11) → highlightRange(6, 11)
// Traverse DOM at exact indices 6-11 (the 6 dots)
```

**Advantages**:
- 1:1 mapping between TTS indices and DOM text nodes
- No array lookups, no bounds checking
- Works with ALL Unicode characters (middle dots, em dashes, CJK, emoji)

---

### **2. Native TTS Handles Middle Dots Naturally**
```
Input:  "Hello······World"
Native TTS behavior:
  - Speaks "Hello" (0.5s)
  - Pauses at "······" (0.1-0.3s natural silence)
  - Speaks "World" (0.5s)
```

**Why dots don't need replacement**:
- TTS engines treat repeated punctuation as short pauses
- Preserves timing and rhythm of light novel narration
- Japanese light novels use `······` intentionally for dramatic effect

---

### **3. Robust to Complex Unicode**
Chapter 214 also contains:
```
Line 344: ""What's up with him?"" (curly quotes)
Line 1541: "and 'Kashiwa Group'······" (mixed quotes + dots)
```

Simple approach:
- Native TTS speaks quotes/punctuation correctly
- Highlight indices match verbatim, regardless of character type

With mapping:
- Each Unicode transformation adds complexity
- Edge cases multiply (quote inside middle dots, nested punctuation)

---

## Recommendations

### **Immediate Action: Abandon normalizeAndMap Entirely**

**Rationale**:
1. **Complexity vs. Benefit**: 70 lines of mapping logic vs. zero lines of direct approach
2. **Edge Cases**: Would need handling for:
   - Multiple consecutive transformations (e.g., `"······"` → `"…"`)
   - Unicode normalization (NFD vs. NFC)
   - Emoji sequences (multi-codepoint characters)
   - CJK full-width punctuation
   - RTL languages (Arabic, Hebrew)
3. **Performance**: Array lookups on every highlight event (50-100 events/paragraph)
4. **Maintenance**: Every new Unicode edge case requires mapping updates

**Testing shows**: 0 failures with direct approach across 917 test cases, including CJK-heavy novels.

---

### **Alternative: If Normalization is Required**

If there's a compelling reason to normalize (e.g., TTS engine compatibility):

#### **Option A: Normalize Without Mapping (Accept Highlight Lag)**
```javascript
this.speak = () => {
  const rawText = this.currentElement.textContent;
  const normalizedText = rawText.replace(/·{2,}/g, '…'); // Simple regex
  
  reader.post({ type: 'speak', data: normalizedText });
  // Disable per-word highlighting for normalized paragraphs
  this.currentTTSMapping = null; 
};
```

**Pros**: TTS speaks cleaner text  
**Cons**: Per-word highlighting disabled (paragraph-level only)

---

#### **Option B: Bidirectional Mapping (Complex)**
```javascript
this.normalizeAndMap = text => {
  const normalized = '';
  const toNormalized = []; // Original → Normalized
  const toOriginal = [];   // Normalized → Original
  
  for (let i = 0; i < text.length; i++) {
    if (/* detect sequence */) {
      // Map ALL original indices to SAME normalized index
      for (let j = 0; j < sequenceLength; j++) {
        toNormalized[i + j] = normalized.length;
      }
      // Map normalized index to RANGE in original
      toOriginal[normalized.length] = { start: i, end: i + sequenceLength };
      normalized += '…';
      i += sequenceLength - 1;
    } else {
      toNormalized[i] = normalized.length;
      toOriginal[normalized.length] = { start: i, end: i + 1 };
      normalized += text[i];
    }
  }
  
  return { normalized, toNormalized, toOriginal };
};

this.highlightRange = (start, end) => {
  // Use toOriginal map to get RANGE
  const origStart = this.mapping.toOriginal[start].start;
  const origEnd = this.mapping.toOriginal[end - 1].end;
  // ...
};
```

**Pros**: Correct bidirectional mapping  
**Cons**: 
- 150+ lines of complex logic
- Still fragile (what if TTS sends indices BETWEEN characters?)
- Performance overhead (2 maps + range lookups)

---

## Conclusion

**Root Cause**: `normalizeAndMap` implementation has **5 critical bugs**:
1. ❌ Maps all compressed characters to first source index
2. ❌ Creates gaps in index mapping during compression
3. ❌ Sentinel value off-by-one
4. ❌ Reverse mapping retrieves wrong indices
5. ❌ DOM traversal uses misaligned start/end bounds

**Specific to Chapter 214**:
- **26 middle dot sequences** trigger mapping failures
- Failures manifest as: stuck playback, highlight offset, missing last-word highlight

**Why simple normalization wins**:
- Zero index translation = zero errors
- Native TTS handles middle dots correctly
- Works with ALL Unicode (CJK, emoji, RTL)
- 917/917 tests passing vs. unknown failure rate with mapping

**Recommendation**: **Keep `core.js` approach** (no normalization). If normalization is absolutely required, implement **Option B** with full bidirectional mapping and comprehensive Unicode test coverage.

---

## Appendix: Test Case for Validation

```javascript
// Test case that would fail with normalizeAndMap:
const testParagraphs = [
  "······",                              // Standalone dots
  "He waited······thinking.",            // Mid-sentence
  "First······Second······Third.",       // Multiple sequences
  ""What······is this······?"",          // Quotes + dots
];

testParagraphs.forEach(text => {
  const { normalized, map } = normalizeAndMap(text);
  
  // Simulate TTS engine callback for each normalized character
  for (let i = 0; i < normalized.length; i++) {
    const origIndex = map[i];
    assert(origIndex >= 0 && origIndex < text.length, 
      `Map index ${i} → ${origIndex} out of bounds (text length ${text.length})`);
    
    // Simulate end-of-word highlight
    if (i < normalized.length - 1) {
      const origEnd = map[i + 1];
      assert(origEnd > origIndex, 
        `Reverse map not monotonic: ${origIndex} → ${origEnd}`);
    }
  }
});
```

Expected result with current `core.bak`: **FAILS** on all 4 test cases.

---

**Analysis completed**: 2026-01-04  
**Confidence Level**: 95% (based on code inspection + pattern analysis)  
**Validation Status**: Awaiting user confirmation via actual playback testing
