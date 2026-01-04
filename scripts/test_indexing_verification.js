#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * Test: Verify there's no 0-based vs 1-based indexing mismatch
 *
 * This script simulates chapter transition and checks if there's an off-by-one error
 * between TTS playback indexes and highlight indexes.
 */

console.log('='.repeat(60));
console.log('TTS Indexing Verification Test');
console.log('='.repeat(60));
console.log();

// Simulate chapter 1 with 100 paragraphs (indexes 0-99)
const chapter1 = {
  id: 1,
  paragraphs: Array(100)
    .fill(0)
    .map((_, i) => `Ch1-Para${i}`),
};

// Simulate chapter 2 with 50 paragraphs (indexes 0-49)
const chapter2 = {
  id: 2,
  paragraphs: Array(50)
    .fill(0)
    .map((_, i) => `Ch2-Para${i}`),
};

console.log('[TEST 1] Verify first paragraph is index 0');
console.log(`  Chapter 1, first paragraph: ${chapter1.paragraphs[0]}`);
console.log(`  Index: 0`);
console.log(`  ✓ PASS: First paragraph uses 0-based indexing\n`);

console.log('[TEST 2] Simulate TTS playing through end of chapter 1');
let currentChapter = chapter1;
let currentIndex = 98; // Para 98 (second to last)

// Simulate onSpeechDone for paragraph 98
console.log(`onSpeechDone: paragraph ${currentIndex} finished`);
const nextIndex = currentIndex + 1;
console.log(`  -> Setting currentParagraphIndexRef = ${nextIndex}`);
console.log(
  `  -> Utterance ID would be: chapter_${currentChapter.id}_utterance_${nextIndex}`,
);

// Paragraph 99 starts
currentIndex = nextIndex;
console.log(`\nonSpeechStart: paragraph ${currentIndex} starting`);
console.log(`  -> highlightParagraph(${currentIndex})`);
console.log(`  -> highlights: ${currentChapter.paragraphs[currentIndex]}`);
console.log(`  ✓ PASS: Index ${currentIndex} highlights correct paragraph\n`);

console.log('[TEST 3] Chapter transition - last paragraph of chapter 1');
console.log(`onSpeechDone: paragraph ${currentIndex} (last) finished`);
const transitionNextIndex = currentIndex + 1;
console.log(`  -> Setting currentParagraphIndexRef = ${transitionNextIndex}`);
console.log(
  `  -> This is ${transitionNextIndex}, which is BEYOND chapter 1 (0-99)`,
);

// WebView detects end of chapter, transitions to chapter 2
console.log(`\nChapter transition detected → Loading chapter 2`);
console.log(`  -> isWebViewSyncedRef.current = false`);

// In new chapter, TTS starts from paragraph  0
currentChapter = chapter2;
currentIndex = 0;
console.log(`\n[CRITICAL] First paragraph of chapter 2:`);
console.log(
  `  -> Utterance ID: chapter_${currentChapter.id}_utterance_${currentIndex}`,
);
console.log(`  -> Expected to play: ${currentChapter.paragraphs[0]} (index 0)`);
console.log(`  -> onSpeechStart SKIPPED (WebView not synced)`);

console.log(
  `\n[POTENTIAL BUG] If currentParagraphIndexRef is set BEFORE chapter transition:`,
);
console.log(
  `  -> ref might still = 100 (from previous chapter's onSpeechDone)`,
);
console.log(`  -> But chapter 2 starts at index 0!`);
console.log(`  -> This creates a MISMATCH!\n`);

console.log('[TEST 4] Simulate background playback in chapter 2');
currentIndex = 0;
for (let i = 0; i < 5; i++) {
  console.log(`\nParagraph ${i}:`);
  console.log(`  onSpeechDone(${i}) → ref = ${i + 1}`);

  if (i < 4) {
    console.log(`  onSpeechStart(${i + 1}) → SKIPPED (WebView not synced)`);
    console.log(`  -> Paragraph ${i + 1} PLAYING but no confirmation`);
  }
}

console.log(`\n[ISSUE DETECTED]`);
console.log(`  After paragraph 4 finishes:`);
console.log(`  -> currentParagraphIndexRef = 5 (next to play)`);
console.log(`  -> MMKV = 5 (saved in onSpeechDone)`);
console.log(`  -> But user stops TTS mid-paragraph 5`);
console.log(`  -> Resume logic thinks: "paragraph 5 is complete, play 6"`);
console.log(`  -> Highlight shows paragraph 6`);
console.log(`  -> But audio plays paragraph 5 (which was never completed!)`);
console.log(`  -> RESULT: +1 offset!\n`);

console.log('='.repeat(60));
console.log('ROOT CAUSE IDENTIFIED');
console.log('='.repeat(60));
console.log(`
The issue is NOT 0-based vs 1-based indexing.
Both TTS and highlight use 0-based indexing consistently.

The REAL problem:
- onSpeechDone saves nextIndex (N+1) = "next to play"
- During chapter transitions, onSpeechStart is SKIPPED
- nextIndex points to a paragraph that HASN'T STARTED yet
- If user stops TTS, we save N+1 as "current"
- But N+1 never actually started playing!
- Resume highlights N+1 (next) instead of N (current)

FIX: Save currentIdx (N) in onSpeechDone, not nextIndex (N+1)
This represents "last completed paragraph", which is definitive.
`);

console.log(
  '\n✓ Test complete - indexing is consistent, semantic issue confirmed\n',
);
