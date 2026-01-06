# LNReader TTS Highlight Sync Fix

## What This Is

Bug fix project for LNReader, an Android light novel reader with advanced Text-to-Speech capabilities. Focus: Fix TTS highlight offset bug where highlight shows one paragraph ahead of audio on some chapters.

## Core Value

Accurate TTS synchronization — users rely on highlight to follow along with audio playback. If highlight doesn't match audio, the reading experience breaks.

## Requirements

### Validated

<!-- Existing TTS functionality that works and must be preserved -->

- ✓ TTS playback with queue management (20 paragraph batches) — existing
- ✓ Highlight synchronization via WebView core.js — existing
- ✓ Progress persistence (Database + MMKV + native SharedPreferences) — existing
- ✓ Foreground TTS mode (per-paragraph, stops on screen off) — existing
- ✓ Background TTS mode (batch, continues in background) — existing
- ✓ TTS state machine (IDLE → STARTING → PLAYING → REFILLING → PLAYING) — existing
- ✓ Chapter transitions during TTS playback — existing
- ✓ WebView ↔ React Native bridge communication — existing
- ✓ 1,127 tests passing (55 new + 1,072 existing) — existing
- ✓ Race protection refs for wake-up transitions — existing

### Active

<!-- Current scope: fix the +1 offset bug -->

- [ ] Fix highlight +1 offset bug on affected chapters
- [ ] Fix Scenario 1: Background TTS continuation into new chapter shows wrong highlight
- [ ] Fix Scenario 2: Scroll past chapter header then press TTS → highlight offset by +1
- [ ] Maintain all 1,127 passing tests (zero regressions)
- [ ] Fix works in both foreground and background TTS modes

### Out of Scope

<!-- Explicit boundaries -->

- Other TTS issues (queue refill, audio gaps, state machine bugs) — different bugs, not part of +1 offset
- Refactoring large files (useTTSController.ts 3,090 lines, WebViewReader.tsx 1,299 lines, core.js 3,814 lines) — tech debt, not blocking this fix
- Performance optimizations — not related to sync accuracy
- New TTS features — bug fix only
- iOS support — Android-only app

## Context

**Reproduction Scenarios:**

1. **Background continuation:** TTS plays from background into new chapter → highlight shows +1 paragraph ahead of audio
2. **Scroll then play:** User scrolls past "Chapter XX" header, then presses TTS → highlight immediately offset by +1

**Pattern:** Sporadic — not all chapters affected, no visible distinction between problematic and working chapters.

**Architecture context:**
- 3-layer TTS system: React Native (controller) ↔ WebView (highlight/DOM) ↔ Native (audio engine)
- Progress tracked in 3 places: Database (ChapterQueries), MMKV, native SharedPreferences
- On load: reconciliation via `Math.max(dbIndex, mmkvIndex, nativeIndex)`
- Wake-up transitions: known fragile area with race protection refs

**Fragile areas:**
- `useTTSController.ts` (3,090 lines) — complex state machine, many race conditions
- WebView bridge (`core.js` + RN) — async communication, timing issues, highlight desync possible
- `currentParagraphIndexRef` vs `currentIndex` state — potential drift

**Codebase:** 496 source files, React Native 0.82.1, Android-only, comprehensive test coverage.

## Constraints

- **Quality**: All 1,127 tests must pass — zero regressions allowed
- **Modes**: Fix must work in both foreground and background TTS modes
- **Code quality**: No lint errors, no type-check errors, no test warnings
- **Testing**: Must run `pnpm run test`, `pnpm run type-check`, `pnpm run lint` successfully
- **Scope**: Fix only — no refactoring of large files (3,000+ line files stay as-is)

## Key Decisions

<!-- Decisions made during project lifecycle -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Scope limited to highlight bug only | User specifically requested bug fix, not refactoring | — Pending |

---
*Last updated: 2026-01-06 after initialization*
