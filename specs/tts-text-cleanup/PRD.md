# Product Requirements Document: TTS Text Cleanup Pipeline

**Status**: ✅ COMPLETED
**Feature Branch**: `dev`
**Date**: 2026-08-02
**Session Utilization**: 100%

---

## 1. What We Want to Do Now

**Immediate Next Steps:**

1. **Ship the declarative text cleanup pipeline** (completed ✅) - TTS currently reads watermarks, corrupted/scrambled text (e.g. `u2014`), and mispronounced light-novel names/honorifics (issue #17)
   - Literal find/replace + regex strip rules (user-configurable, ordered)
   - Phonetic pronunciation dictionary (whole-word or substring mode)
   - Optional Unicode normalization (NFD + strip combining marks)
   - Per-novel overrides on top of global settings

2. **Harden regex safety** (completed ✅)
   - Length cap + catastrophic-backtracking shape detection + compile-time try/catch
   - Literal replacement semantics (`$&` stays literal, no `eval`/`Function` in the RN layer)

3. **Documentation** (completed ✅)
   - Update AGENTS.md with feature documentation (this session)
   - PRD at `specs/tts-text-cleanup/PRD.md` (this file)

---

## 2. Research Findings

### Problem Statement

- **Watermarks**: Many sources embed author/translator watermarks in chapter HTML (e.g. "Read on N o v e l i g h t", "Do not rehost this novel"). These are read aloud by TTS.
- **Corrupted text**: Character corruption / lookalike replacement characters (e.g. literal `u2014`, mathematical-bold letters) break pronunciation.
- **Mispronunciation**: LN-specific names and honorifics (e.g. "Xianxia", "Qing", CJK names) are read phonetically wrong by system TTS engines.
- **Manual workaround existed but was fragile**: hardcoded site-specific regexes scattered in the WebView layer — not configurable, not maintainable, and did not cover all playback paths.

### Constraints (from code comments in `src/utils/htmlParagraphExtractor.ts`)

- **No arbitrary user JS evaluation** in the RN/Hermes layer (no `eval`/`Function`).
- **Length-preserving**: cleanup never drops or merges array entries, so the RN ↔ WebView paragraph index contract stays intact (paragraph count drives indexing).
- **No hardcoded site-specific regexes** — everything is user-configurable.

---

## 3. Implementation Plan

### Phase 1: Core pipeline (Completed ✅ - commit `2d35beff0`)

| Task                                    | Status | Commit     |
| --------------------------------------- | ------ | ---------- |
| 1.1 Declarative cleanup pipeline in utils | ✅     | 2d35beff0 |

**Implementation Details:**

**Files Modified:**

- `src/utils/htmlParagraphExtractor.ts`
  - Added cleanup API alongside the existing paragraph extractor:
    - `TtsCleanupRule` (id, enabled, pattern, isRegex, flags, replacement)
    - `TtsPhoneticPair` (id, enabled, word, pronunciation, matchMode)
    - `TtsTextCleanupSettings` (enabled, normalizeUnicode, rules, phoneticPairs)
    - `DEFAULT_TTS_CLEANUP_SETTINGS`
    - `TTS_CLEANUP_MAX_REGEX_LENGTH` (200)
    - `isPotentiallyCatastrophic()`, `normalizeRegExpFlags()`, `normalizeUnicodeText()`
    - `createTtsCleanupRule()`, `createTtsPhoneticPair()`
    - `cleanTtsText()` (single string) and `applyTtsTextCleanup()` (paragraph array, length-preserving)
  - Pipeline order: **Unicode normalization → ordered rules → phonetic dictionary**
  - Whole-word phonetic matching uses Unicode-aware boundaries `(^|[^\p{L}\p{N}_])word(?![...])` with a bounded regex cache (500 entries)

### Phase 2: Regex safety hardening (Completed ✅ - commit `1a1ffb00d`)

| Task                                    | Status | Commit     |
| --------------------------------------- | ------ | ---------- |
| 2.1 Regex safety + replacement semantics | ✅     | 1a1ffb00d |

- **Length cap**: patterns > 200 chars are skipped.
- **Catastrophic-backtracking detection**: narrow structural heuristics reject shapes like `(a+)+`, `(?:a*)*`, `(?:a+){2,}`, `(a|a)+`. False positives are avoided (a rejected rule silently stops cleaning), false negatives acceptable (defense-in-depth on top of length cap + try/catch).
- **Compile-time try/catch**: invalid regex source leaves text untouched rather than crashing TTS.
- **Literal replacement**: regex replacements use the callback form so `$&`, `$'`, `` $` ``, `$$`, `$n` stay literal.
- **Flag normalization**: only valid flags kept, deduped, `g` always added, sticky `y` dropped (sticky without global scan silently no-ops on mid-string matches).

### Phase 3: Per-novel overrides (Completed ✅ - commit `aeec7abb6`)

| Task                              | Status | Commit     |
| --------------------------------- | ------ | ---------- |
| 3.1 Per-novel cleanup overrides   | ✅     | aeec7abb6 |

- `src/services/tts/novelTtsSettings.ts`: `NovelTtsSettings` gains optional `ttsTextCleanup`; new `resolveEffectiveTtsCleanup(globalCleanup, novelId)` resolves per-novel override when per-novel mode is enabled AND a cleanup override was saved, else falls back to global. MMKV read failures degrade to global.
- `src/screens/reader/components/WebViewReader.tsx`: `novelIdRef` mirrors `novel.id` so mount-once MMKV listeners can resolve per-novel cleanup; `syncEffectiveTtsCleanup()` re-resolves the effective cleanup into `chapterGeneralSettingsRef` after every wholesale ref assignment (prop effect, MMKV listener, per-novel effect).

### Phase 4: Substring mode + rule reordering (Completed ✅ - commit `b0b56f333`)

| Task                                    | Status | Commit     |
| --------------------------------------- | ------ | ---------- |
| 4.1 Substring match mode + reorder UI   | ✅     | b0b56f333 |

- `TtsPhoneticPair.matchMode` (`'whole-word'` default | `'substring'`): whole-word boundaries never fire between adjacent CJK characters (both sides are `\p{L}`), so substring mode replaces every occurrence via split/join. Legacy persisted pairs without the field default to whole-word.
- Rule reorder UI: move up/down arrows for both find/replace rules and phonetic pairs (disabled at boundaries).

### Phase 5: Controller wiring tests (Completed ✅ - commit `b47f527c0`)

| Task                              | Status | Commit     |
| --------------------------------- | ------ | ---------- |
| 5.1 Assert cleanup wiring in tests | ✅     | b47f527c0 |

- `useTTSController.integration.test.ts`: asserts `applyTtsTextCleanup` is called with queue texts + effective settings before `addToBatch`; new test asserts `cleanTtsText` is called on the `'speak'` fallback path.
- `mediaNav`/`progressSync` suites do not dispatch speak/tts-queue messages (documented as covered elsewhere).

### Phase 6: Dependency hygiene (Completed ✅ - commit `e4a78d623`)

| Task                                   | Status | Commit     |
| -------------------------------------- | ------ | ---------- |
| 6.1 Stable sync callback in listener deps | ✅   | e4a78d623 |

- `WebViewReader.tsx`: `syncEffectiveTtsCleanup` is a stable `useCallback` ([] deps), listed explicitly in the mount-once MMKV listener dependency array (suppresses an exhaustive-deps warning; safe because it never changes).

---

## 4. Architecture

### Layers

1. **RN utilities layer**: `src/utils/htmlParagraphExtractor.ts` — declarative, pure, length-preserving cleanup pipeline (`cleanTtsText` / `applyTtsTextCleanup`). No side effects, no runtime user code execution.
2. **Controller wiring layer**: `useTTSController.ts`, `useTTSUtilities.ts`, `WebViewReader.tsx` — applies cleanup to every paragraph reaching the native TTS engine across ALL playback paths:
   - Initial queue (all modes): RN `extractParagraphs()` output
   - Foreground refill (Path B): WebView DOM `tts-queue` payloads
   - Fallback single-speak: WebView `'speak'` payloads
3. **Settings layer**: global `ttsTextCleanup` on `ChapterGeneralSettings` (MMKV) + optional per-novel override in `NovelTtsSettings`.
4. **UI layer**: `TtsTextCleanupModal.tsx` with master switch, Unicode normalization toggle, ordered find/replace rules editor, and phonetic dictionary editor — reachable from both the Accessibility Tab (global) and Reader TTS Tab (global or per-novel).

### Effective settings resolution

```
global ttsTextCleanup (ChapterGeneralSettings, MMKV)
        │
        ▼
resolveEffectiveTtsCleanup(global, novelId)
        │  per-novel TTS enabled AND per-novel cleanup saved?
        ├─ yes → per-novel ttsTextCleanup (replaces global)
        └─ no  → global ttsTextCleanup
        │
        ▼
chapterGeneralSettingsRef.current.ttsTextCleanup
        │  (synced via syncEffectiveTtsCleanup on: chapterGeneralSettings change,
        │   per-novel settings change, MMKV CHAPTER_GENERAL_SETTINGS listener)
        ▼
cleanTtsText / applyTtsTextCleanup at every playback path
```

---

## 5. UI / UX

### TTS Text Cleanup Modal (`TtsTextCleanupModal.tsx`)

- **Master switch**: "Clean TTS text" — applied to every paragraph before it reaches the TTS engine.
- **Unicode normalization toggle**: NFD-normalize + strip combining marks (e.g. `cafe\u0301` → `cafe`).
- **Find & Replace Rules** (ordered): literal or regex (with flags input), empty replacement = strip. Per-rule validation blocks invalid regex, over-length patterns, and suspected catastrophic patterns at save time. Rules reorderable via arrow icons.
- **Phonetic Dictionary** (ordered): word → pronunciation swaps; whole-word (default) or substring match mode toggle (needed for unspaced CJK). Pairs reorderable via arrow icons.

### Entry Points

- **Global**: More → Settings → Reader → Accessibility Tab → "TTS Text Cleanup" section → "Cleanup rules & phonetic dictionary"
- **Quick Access**: Reader Bottom Sheet → TTS Tab → "Text Cleanup" section → "Cleanup rules & phonetic dictionary" (saves to global when per-novel mode is off, per-novel when per-novel mode is on)

---

## 6. Test Summary

- `src/utils/__tests__/ttsTextCleanup.test.ts` (344 lines, new): cleanTtsText behavior, pipeline order, regex safety hardening (length cap, catastrophic patterns, literal `$&`, sticky-`y`), Unicode normalization, whole-word vs substring phonetic matching, applyTtsTextCleanup length-preservation guarantees.
- `src/services/__tests__/NovelTtsSettings.test.ts` (+84 lines): `resolveEffectiveTtsCleanup` resolution matrix (no novelId, no per-novel settings, per-novel disabled, per-novel enabled + saved, enabled but no override, MMKV read failure).
- `src/screens/reader/hooks/__tests__/useTTSController.integration.test.ts` (+56 lines): cleanup applied on `tts-queue` and `speak` message paths.
- Full suite: **1235 tests passing**, `tsc --noEmit` clean.

---

## 7. File Map

| File | Role |
| ---- | ---- |
| `src/utils/htmlParagraphExtractor.ts` | Cleanup pipeline + types + defaults (+350 lines) |
| `src/utils/__tests__/ttsTextCleanup.test.ts` | Cleanup unit tests (new, 344 lines) |
| `src/hooks/persisted/useSettings.ts` | Global `ttsTextCleanup` on `ChapterGeneralSettings` |
| `src/services/tts/novelTtsSettings.ts` | Per-novel override + `resolveEffectiveTtsCleanup` |
| `src/screens/reader/hooks/useTTSController.ts` | Cleanup wiring across all playback paths |
| `src/screens/reader/hooks/useTTSUtilities.ts` | Cleanup in utilities/restart path |
| `src/screens/reader/components/WebViewReader.tsx` | `novelIdRef`, `syncEffectiveTtsCleanup`, MMKV listener |
| `src/screens/settings/SettingsReaderScreen/Modals/TtsTextCleanupModal.tsx` | Settings UI (new, 685 lines) |
| `src/screens/settings/SettingsReaderScreen/tabs/AccessibilityTab.tsx` | Global settings entry point |
| `src/screens/reader/components/ReaderBottomSheet/ReaderTTSTab.tsx` | Quick-access entry point (global/per-novel) |

## 8. Commits

- `2d35beff0` feat(tts): add declarative text cleanup pipeline for TTS audio
- `1a1ffb00d` fix(tts): harden text cleanup regex safety and replacement semantics
- `aeec7abb6` feat(tts): support per-novel text cleanup overrides
- `b0b56f333` feat(tts): add substring match mode and rule reordering to cleanup editor
- `b47f527c0` test(tts): assert cleanup wiring in controller integration tests
- `e4a78d623` chore(tts): include stable sync callback in MMKV listener deps

All on branch `dev` (not yet pushed at time of writing).

## 9. Known Gotchas

- **Unicode normalization + regex patterns**: when `normalizeUnicode` is enabled, text is NFD-normalized FIRST; regex patterns are matched verbatim against the already-normalized text. A regex containing precomposed characters (e.g. `é`) will NOT match the normalized form (`e` + combining accent). Literal (non-regex) patterns are NFD-normalized to match. This is by design — document it for users.
- **Partial-object robustness**: the runtime (`cleanTtsText`) guards `settings.rules ?? []` / `settings.phoneticPairs ?? []` so partial legacy objects degrade safely. Settings written by this feature always include both arrays.
- **Length preservation is contractual**: never drop or merge paragraphs in cleanup — the RN ↔ WebView paragraph index contract depends on it.

---

**Last Updated**: 2026-08-02
**Session Utilization**: 100%
**Completion**: 6/6 commits (100%)
