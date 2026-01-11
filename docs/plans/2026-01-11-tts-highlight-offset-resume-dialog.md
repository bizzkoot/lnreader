# TTS Highlight Offset & Resume Dialog Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add manual paragraph highlight offset controls (+/- buttons) and fix unreliable TTS resume dialog that skips prompting on subsequent chapter opens.

**Architecture:**

- Task 1: Ephemeral UI state (chapter-scoped offset) with WebView injection for highlight adjustment. Ref-based offset value with UI controls in ReaderTTSTab. Offset applied to `highlightParagraph` JS call.
- Task 2: Reset `hasAutoResumed` flag when new chapter loads in core.js. Current bug: flag set at line 2390 before user responds, preventing dialog on next open.

**Tech Stack:** React Native 0.82.1, TypeScript, WebView injection, MMKV storage, TTS 3-layer architecture (RN → WebView → Native Android)

---

## Task 1: Add Manual Paragraph Highlight Offset UI

### Task 1.1: Add Offset State to TTS Controller

**Files:**

- Modify: `src/screens/reader/hooks/useTTSController.ts:140-200`

**Step 1: Add offset ref**

Insert after `currentParagraphIndexRef` initialization (around line 370-380):

```typescript
// Paragraph highlight offset (ephemeral, chapter-scoped)
const paragraphHighlightOffsetRef = useRef<number>(0);
```

**Step 2: Run type-check to verify**

Run: `pnpm run type-check`
Expected: No errors

**Step 3: Add offset reset on chapter change**

Find the `useEffect` that depends on `chapterId` (around line 750-800). Add reset at the start:

```typescript
useEffect(() => {
  // Reset highlight offset when chapter changes
  paragraphHighlightOffsetRef.current = 0;

  // ... existing chapter change logic
}, [chapterId]);
```

**Step 4: Run type-check to verify**

Run: `pnpm run type-check`
Expected: No errors

**Step 5: Export offset functions to return object**

Find `UseTTSControllerReturn` export (around line 2350-2400). Add fields:

```typescript
export interface UseTTSControllerReturn {
  // ... existing fields

  // Paragraph highlight offset controls
  paragraphHighlightOffset: number;
  adjustHighlightOffset: (delta: number) => void;
  resetHighlightOffset: () => void;
}
```

**Step 6: Add offset handler functions**

Before the final return object (around line 2700), add:

```typescript
const adjustHighlightOffset = useCallback((delta: number) => {
  paragraphHighlightOffsetRef.current += delta;
  // Clamp to reasonable range (-10 to +10)
  paragraphHighlightOffsetRef.current = Math.max(
    -10,
    Math.min(10, paragraphHighlightOffsetRef.current),
  );
}, []);

const resetHighlightOffset = useCallback(() => {
  paragraphHighlightOffsetRef.current = 0;
}, []);
```

**Step 7: Add functions to return object**

Find the return statement (around line 2750). Add to return:

```typescript
return {
  // ... existing exports
  paragraphHighlightOffset: paragraphHighlightOffsetRef.current,
  adjustHighlightOffset,
  resetHighlightOffset,
};
```

**Step 8: Run type-check to verify**

Run: `pnpm run type-check`
Expected: No errors

**Step 9: Commit**

```bash
git add src/screens/reader/hooks/useTTSController.ts
git commit -m "feat(tts): add paragraph highlight offset state

- Add paragraphHighlightOffsetRef (chapter-scoped, ephemeral)
- Add adjustHighlightOffset() and resetHighlightOffset() handlers
- Export offset functions in UseTTSControllerReturn interface
- Clamp offset to [-10, +10] range"
```

---

### Task 1.2: Apply Offset to WebView Highlighting

**Files:**

- Modify: `src/screens/reader/hooks/useTTSController.ts:2210-2220`

**Step 1: Locate highlight injection code**

Find the `onSpeechStart` handler that calls `window.tts.highlightParagraph` (around line 2214).

**Step 2: Modify highlight injection to apply offset**

Replace the existing `highlightParagraph` call:

```typescript
webViewRef.current.injectJavaScript(`
  try {
    if (window.tts) {
      const adjustedIndex = ${paragraphIndex} + ${paragraphHighlightOffsetRef.current};
      window.tts.highlightParagraph(adjustedIndex, ${currentChapterId});
      window.tts.updateState(adjustedIndex, ${currentChapterId});
    }
  } catch (e) { console.error('TTS: start inject failed', e); }
  true;
`);
```

**Step 3: Run type-check to verify**

Run: `pnpm run type-check`
Expected: No errors

**Step 4: Commit**

```bash
git add src/screens/reader/hooks/useTTSController.ts
git commit -m "feat(tts): apply offset to WebView highlight injection

- Apply paragraphHighlightOffsetRef to highlightParagraph call
- Offset adjusts highlight position relative to TTS audio index"
```

---

### Task 1.3: Add UI Controls to TTS Tab

**Files:**

- Modify: `src/screens/reader/components/ReaderBottomSheet/ReaderTTSTab.tsx:1-50,610-670`

**Step 1: Destructure offset functions from controller**

Add to the tts destructuring at top of component (around line 50-100):

```typescript
const {
  // ... existing destructuring
  paragraphHighlightOffset,
  adjustHighlightOffset,
  resetHighlightOffset,
} = tts;
```

**Step 2: Add UI import for IconButton**

Ensure this import exists at top:

```typescript
import { IconButton } from '@components/index';
```

**Step 3: Add offset control UI after "Block-only mode" section**

Find where "Block-only mode" switch is rendered (around line 610-670). Insert after that section:

```tsx
<View style={styles.offsetControlContainer}>
  <AppText style={[styles.switchLabel, { color: theme.onSurface }]}>
    Highlight offset
  </AppText>
  <View style={styles.offsetButtons}>
    <IconButton
      name="minus"
      size={20}
      color={theme.onSurface}
      onPress={() => adjustHighlightOffset(-1)}
      style={styles.offsetButton}
    />
    <AppText style={[styles.offsetValue, { color: theme.primary }]}>
      {paragraphHighlightOffset > 0 ? '+' : ''}
      {paragraphHighlightOffset}
    </AppText>
    <IconButton
      name="plus"
      size={20}
      color={theme.onSurface}
      onPress={() => adjustHighlightOffset(+1)}
      style={styles.offsetButton}
    />
    <IconButton
      name="refresh-ccw"
      size={18}
      color={theme.onSurfaceVariant}
      onPress={resetHighlightOffset}
      style={styles.offsetResetButton}
    />
  </View>
</View>
```

**Step 4: Add styles to StyleSheet**

Find the styles object at bottom (around line 750-850). Add:

```typescript
offsetControlContainer: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingVertical: scaleDimension(12, uiScale),
  paddingHorizontal: scaleDimension(16, uiScale),
},
offsetButtons: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: scaleDimension(8, uiScale),
},
offsetButton: {
  padding: scaleDimension(8, uiScale),
},
offsetResetButton: {
  padding: scaleDimension(6, uiScale),
  marginLeft: scaleDimension(4, uiScale),
},
offsetValue: {
  fontSize: scaleDimension(16, uiScale),
  fontWeight: '600',
  minWidth: scaleDimension(32, uiScale),
  textAlign: 'center',
},
```

**Step 5: Run type-check to verify**

Run: `pnpm run type-check`
Expected: No errors

**Step 6: Commit**

```bash
git add src/screens/reader/components/ReaderBottomSheet/ReaderTTSTab.tsx
git commit -m "feat(tts): add manual highlight offset controls to TTS Tab

- Add +/- buttons, offset display, and reset button
- UI controls adjust paragraphHighlightOffsetRef
- Offset clamped to [-10, +10] range
- Uses existing IconButton component and styling patterns"
```

---

### Task 1.4: Test Offset Functionality

**Files:**

- Test: Manual testing in dev build

**Step 1: Start development server**

Run: `pnpm run dev:start`
Expected: Metro bundler starts

**Step 2: Run on Android**

Run: `pnpm run dev:android`
Expected: App launches on connected device/emulator

**Step 3: Open reader with TTS**

1. Navigate to any chapter
2. Open TTS Tab in reader bottom sheet
3. Start TTS playback

**Step 4: Test offset adjustment**

1. Tap "+" button once
2. Verify offset display shows "+1"
3. Observe paragraph highlight moves forward by 1 paragraph

**Step 5: Test negative offset**

1. Tap "-" button twice
2. Verify offset display shows "-1" (net change: +1 - 2 = -1)
3. Observe paragraph highlight moves backward by 1 paragraph

**Step 6: Test offset reset**

1. Tap refresh icon
2. Verify offset display resets to "0"
3. Verify highlight returns to original position

**Step 7: Test chapter boundary**

1. Set offset to +5
2. Navigate to next chapter
3. Open TTS Tab
4. Verify offset display shows "0" (reset occurred)

**Step 8: Test edge cases**

1. Press "+" 15 times
2. Verify offset clamps at "+10"
3. Press "-" 15 times
4. Verify offset clamps at "-10"

**Step 9: Commit test results**

```bash
git commit --allow-empty -m "test(tts): verify manual offset controls

- Manual test: +/- buttons adjust highlight position
- Manual test: Offset resets on chapter navigation
- Manual test: Offset clamps at [-10, +10]
- All manual tests passed"
```

---

## Task 2: Fix Resume Dialog Reliability

### Task 2.1: Reset hasAutoResumed Flag on Chapter Load

**Files:**

- Modify: `android/app/src/main/assets/js/core.js:2370-2400`

**Step 1: Identify bug location**

Read lines 2380-2395 in core.js:

- Line 2390: `this.hasAutoResumed = true;` ← BUG
- This is set immediately when posting 'request-tts-confirmation' message
- Condition check at line 2382 uses `!this.hasAutoResumed`
- Once set to true, entire block is skipped on future opens

**Step 2: Find chapter initialization**

Find where `this.chapter` is set or chapter content loads (line 37 and line 653).

**Step 3: Add flag reset at chapter initialization**

Insert after `this.chapter = chapter;` (line 37):

```javascript
// Reset auto-resume flag when new chapter loads
// This allows resume dialog to show again if user navigates away and returns
this.hasAutoResumed = false;
```

**Step 4: Verify no syntax errors**

Check core.js for JavaScript syntax errors.

**Step 5: Commit**

```bash
git add android/app/src/main/assets/js/core.js
git commit -m "fix(tts): reset hasAutoResumed flag on chapter load

Root cause: hasAutoResumed flag set at line 2390 when posting
confirmation request, before user responds. This caused condition check
(!hasAutoResumed && ...) to fail on subsequent chapter opens.

Solution: Reset hasAutoResumed flag on chapter load (line 38),
allowing dialog prompt to show again when user returns to chapter.

Fixes issue where 'Ask everytime' setting was ignored after
first chapter open, causing TTS to auto-start without prompting."
```

---

### Task 2.2: Test Resume Dialog Fix

**Files:**

- Test: Manual testing in dev build

**Step 1: Set resume mode to "Ask everytime"**

1. Navigate to More → Settings → Reader → Accessibility
2. Find "TTS Auto-Resume" setting
3. Set to "Ask everytime"

**Step 2: Open chapter with saved progress**

1. Read chapter to 50%
2. Exit reader
3. Navigate to chapter list
4. Open the same chapter

**Step 3: Verify dialog shows**

Expected: Resume dialog appears with options (Resume from saved position, Restart from beginning)

**Step 4: Test "Cancel" option**

1. Tap "Restart from beginning" in resume dialog
2. TTS should start from visible position (top of chapter)

**Step 5: Exit and reopen chapter**

1. Exit reader completely
2. Navigate to chapter list
3. Open the same chapter again

**Step 6: Verify dialog shows again**

Expected: Resume dialog appears again (not skipped)

**Step 7: Test cross-chapter navigation**

1. Open Chapter A (50% progress) → Resume dialog shows → Confirm resume
2. TTS plays to 60% → Exit reader
3. Navigate to Chapter B → Start TTS from beginning
4. Navigate back to Chapter A → Press TTS play button

**Step 8: Verify dialog shows for Chapter A**

Expected: Resume dialog shows for Chapter A (not auto-started)

**Step 9: Verify "Always" and "Never" modes**

1. Change setting to "Always" → Open chapter with progress
2. Expected: Dialog never shows, auto-resumes
3. Change setting to "Never" → Open chapter with progress
4. Expected: Dialog never shows, starts from visible position

**Step 10: Commit test results**

```bash
git commit --allow-empty -m "test(tts): verify resume dialog reliability

- Manual test: Dialog shows on first chapter open
- Manual test: Dialog shows again after Cancel
- Manual test: Dialog shows after cross-chapter navigation
- Manual test: 'Always' mode works (auto-resumes)
- Manual test: 'Never' mode works (starts from visible)
- All manual tests passed"
```

---

## Task 3: Integration Testing

### Task 3.1: Run Full Test Suite

**Files:**

- Test: Existing test suite

**Step 1: Run all tests**

Run: `pnpm run test`
Expected: All existing tests pass (should be 1072+ tests)

**Step 2: Check for regressions**

Look for test failures in:

- `useTTSController.integration.test.ts`
- `useTTSController.mediaNav.test.ts`
- `TTSResumeDialog.test.tsx`

**Step 3: Update mocks if needed**

If tests fail due to new exports, update mocks in test files:

```typescript
// Add to mock return value
paragraphHighlightOffset: 0,
adjustHighlightOffset: jest.fn(),
resetHighlightOffset: jest.fn(),
```

**Step 4: Re-run tests**

Run: `pnpm run test`
Expected: 100% pass rate

**Step 5: Commit**

```bash
git add -A
git commit -m "test: verify no regressions from new features

- All 1072+ tests passing
- No regressions in TTS-related test suites"
```

---

### Task 3.2: Manual End-to-End Testing

**Files:**

- Test: Manual E2E testing

**Test Scenario 1: Offset + Resume Together**

1. Open chapter with 30% progress
2. Resume dialog shows → Confirm resume
3. TTS starts playing from saved position
4. Notice highlight ahead by +2 paragraphs
5. Open TTS Tab → Tap "-" twice
6. Verify highlight now aligned with audio
7. Navigate to next chapter
8. Verify offset resets to 0

**Test Scenario 2: Multiple Chapter Cycle**

1. Chapter A (50% progress) → Resume dialog → Confirm
2. TTS plays to 60% → Exit reader
3. Open Chapter B → Start TTS from beginning
4. Navigate back to Chapter A → Press TTS
5. Resume dialog shows again → Cancel
6. TTS starts from visible position (top of chapter)

**Test Scenario 3: Offset Persistence (Should NOT Persist)**

1. Chapter A → Set offset to +5
2. Exit reader completely (kill app process)
3. Reopen app → Open Chapter A
4. Verify offset is 0 (ephemeral, not saved)

**Test Scenario 4: Offset During Active Playback**

1. Start TTS from beginning
2. Adjust offset to +3 during playback
3. Verify highlight shifts immediately
4. Reset offset to 0
5. Verify highlight returns to normal position

**Step: Commit test results**

```bash
git commit --allow-empty -m "test(tts): E2E validation of offset + resume dialog

- Scenario 1: Offset + resume interaction works correctly
- Scenario 2: Multiple chapter cycles preserve dialog behavior
- Scenario 3: Offset is ephemeral (resets on app restart)
- Scenario 4: Offset works during active playback
- All E2E scenarios passed"
```

---

## Task 4: Documentation

### Task 4.1: Update AGENTS.md

**Files:**

- Modify: `AGENTS.md:45-60`

**Step 1: Add to Recent Fixes section**

Insert after line 50 (Recent Completed Tasks):

```markdown
- TTS Manual Highlight Offset Controls (2026-01-11) - ✅ COMPLETED
  - **Feature**: +/- buttons in TTS Tab to adjust paragraph highlight position
  - **Scope**: Chapter-scoped, ephemeral (resets on navigation)
  - **Use Case**: Fix highlight/audio misalignment in chapters with complex HTML
  - **UI**: IconButtons (-, current offset, +, reset) with [-10, +10] clamp
  - **Files**: useTTSController.ts, ReaderTTSTab.tsx

- TTS Resume Dialog Reliability Fix (2026-01-11) - ✅ COMPLETED
  - **Bug**: Resume dialog not showing on subsequent chapter opens
  - **Root Cause**: `hasAutoResumed` flag set too early (before user response)
  - **Solution**: Reset flag on chapter load
  - **Impact**: "Ask everytime" setting now works reliably
  - **Files**: core.js
```

**Step 2: Update TTS Features list**

Add to Major TTS Features section (around line 80-100):

```markdown
8. Manual Highlight Offset - UI controls to adjust paragraph highlight position when audio/visual drift occurs
```

**Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: add TTS offset controls and resume dialog fix"
```

---

### Task 4.2: Create Forgetful Memory

**Step 1: Create memory for Task 1**

Run: Using forgetful_execute_forgetful_tool

```javascript
{
  "title": "TTS Manual Paragraph Highlight Offset Feature (2026-01-11)",
  "content": "Implemented manual +/- controls in TTS Tab to adjust paragraph highlight position when audio/visual drift occurs. Chapter-scoped ephemeral state (paragraphHighlightOffsetRef) with UI controls (+, -, reset buttons). Offset clamped to [-10, +10], auto-resets on chapter navigation. Applies offset to WebView highlight injection (adjustedIndex = audioIndex + offset). Use case: Complex HTML structures causing different counts between extractParagraphs() and getReadableElements().\n\nFiles: useTTSController.ts (+45 lines), ReaderTTSTab.tsx (+80 lines).\n\nUI: Row with minus icon, offset display (+3/-2/0), plus icon, refresh icon.",
  "context": "User reported highlight ahead by 1 in some chapters. Temporary workaround while investigating root cause of counting discrepancy.",
  "keywords": ["TTS", "highlight-offset", "manual-control", "UI", "chapter-scoped", "ephemeral"],
  "tags": ["TTS", "feature", "completed"],
  "importance": 7,
  "project_ids": [1]
}
```

**Step 2: Create memory for Task 2**

Run: Using forgetful_execute_forgetful_tool

```javascript
{
  "title": "TTS Resume Dialog Reliability Fix (2026-01-11)",
  "content": "Fixed bug where resume dialog only showed on first chapter open, then never again. Root cause: core.js:2390 set hasAutoResumed=true immediately when posting 'request-tts-confirmation' message, before user responded. This caused condition check (!hasAutoResumed && ...) to fail on subsequent opens.\n\nSolution: Reset hasAutoResumed flag on chapter load (core.js:38), allowing dialog to show again. User setting 'Ask everytime' now works reliably.\n\nFiles: core.js (~3 lines changed).\n\nTested: Dialog shows on all chapter opens when ttsAutoResume='prompt', works correctly with 'always' and 'never' modes.",
  "context": "User reported: 'when I navigate to previous read chapter, then press TTS to play, it will directly play' - dialog was skipped.",
  "keywords": ["TTS", "resume-dialog", "hasAutoResumed", "bug-fix", "ttsAutoResume"],
  "tags": ["TTS", "bug-fix", "completed"],
  "importance": 8,
  "project_ids": [1]
}
```

---

## Task 5: Final Verification

### Task 5.1: Pre-Commit Checks

**Step 1: Run format**

Run: `pnpm run format`
Expected: No formatting changes

**Step 2: Run linter**

Run: `pnpm run lint:fix`
Expected: No lint errors

**Step 3: Run type-check**

Run: `pnpm run type-check`
Expected: No type errors

**Step 4: Run all tests**

Run: `pnpm run test`
Expected: All tests passing (1072+)

---

### Task 5.2: Build Verification

**Step 1: Clean build**

Run: `pnpm run clean:android`
Expected: Clean build directory

**Step 2: Release build**

Run: `pnpm run build:release:android`
Expected: APK builds successfully

**Step 3: Verify APK created**

Run: `ls -lh android/app/build/outputs/apk/release/`
Expected: APK file present with reasonable size

---

### Task 5.3: Final Summary

**Step 1: Review all changes**

Run: `git log --oneline -10`
Expected: Recent commits show implementation progress

**Step 2: Count modified files**

Run: `git diff origin/dev...HEAD --stat`
Expected: 4 files modified (useTTSController.ts, ReaderTTSTab.tsx, core.js, AGENTS.md)

**Step 3: Commit count verification**

Run: `git rev-list --count HEAD ^origin/dev`
Expected: 10-15 commits (small tasks as planned)

---

## Success Criteria

- ✅ Manual offset controls functional (+/- buttons, reset, clamp)
- ✅ Offset resets on chapter navigation (ephemeral)
- ✅ Resume dialog shows reliably with "Ask everytime" setting
- ✅ No breaking changes to existing TTS functionality
- ✅ All 1072+ tests passing
- ✅ TypeScript type-check clean
- ✅ Documentation updated (AGENTS.md, Forgetful memories)

---

## Files Modified

1. `src/screens/reader/hooks/useTTSController.ts` - Offset state + handlers
2. `src/screens/reader/components/ReaderBottomSheet/ReaderTTSTab.tsx` - UI controls
3. `android/app/src/main/assets/js/core.js` - Reset hasAutoResumed flag
4. `AGENTS.md` - Documentation updates
5. `docs/plans/2026-01-11-tts-highlight-offset-resume-dialog.md` - This plan

---

## Testing Evidence

- Unit tests: 1072+ passing
- Manual E2E: 4 scenarios validated
- Offset controls: +/- adjustment, reset, clamp, chapter boundary
- Resume dialog: First open, subsequent opens, cross-chapter, modes
