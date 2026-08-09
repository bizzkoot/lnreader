# Fix Batch #1–#9 — Handoff Record (COMPLETED 2026-08-06)

**Date**: 2026-08-06 (all groups implemented + verified)
**Branch**: `merge/original-sync-batch-c` (HEAD `9d0751ecf`, 52 commits ahead of origin/master)
**Goal**: Implement the 9 audit findings, then advance `origin/dev` to this branch.

## ✅ ALL 9 ITEMS IMPLEMENTED + VERIFIED (2026-08-06)

Final gates: type-check ✅ · lint 0 errors (7 pre-existing warnings) ✅ · format ✅ · **full suite 86 suites / 1435 tests** (baseline 84/1349 → +2 suites / +86 tests) · TTS wake-cycle 7/7 ✅ · TTS refill ✅. Working tree: 20 modified + 3 new files, **UNCOMMITTED** (commit decision pending user).

- Group 1 (#1,#2,#4,#5): duplicate "Applies to" row removed; setVisibleCleanup re-inject (prop/per-novel/MMKV effects) + core.js restore-pristine on toggle-off; no-op write-back skipped; resolveTtsCleanupTarget strict gating.
- Group 2 (#3): Slider claims only horizontal-dominant gestures (`shouldClaimPanResponder`, 6px threshold), Pressable tap-to-jump kept, flicker fix intact, 9 new tests (16 total).
- Group 3 (#6): Menu fontSize/lineHeight uiScale-scaled (scaleDimension(16/20, uiScale) — pre-change value restored); setBarColor dead code removed + doc comment (upstream #1076 rationale); buildPaperTheme extracted, ErrorFallbackPaperProvider (no auto-backup hook, safe pre-DB).
- Group 4a (#7,#8): README deprecation overstatements corrected (2 spots); getNovelChaptersByNumber prefers chapterNumber with position fallback (+4 tests); JumpToChapterModal scrolls via findIndex (loadedChaptersRef) with clamped fallback; ReadButton/FAB fall back to chapters[0] when novel fully read.
- Group 4b (#9): useGithubUpdateChecker tests — first-launch check, 24h skip, ignoreVersion (6 new, 4 existing kept); transformThemeId exported + full 1-21→100-108 map pinned for light/dark in new useTheme.test.ts.

Remaining: user decision on commit grouping, then advance `origin/dev` (clean fast-forward — 0 commits on origin/dev missing from HEAD).

---

## Audit context

Full verification report in the chat session (2026-08-05). Source of the 9 findings:
- POV-1 (TTS unify commit `1f4833064`) → items #1, #2, #4, #5
- POV-3 (Batch C UI) → items #3, #6
- POV-4 (Features/docs) → items #7, #8, #9
- Gates baseline at start: type-check ✅ / lint 0 errors (7 pre-existing warnings) / format ✅ / **84 suites, 1349 tests** / TTS wake-cycle 7/7.

## ✅ DONE — Group 1 (TTS pipeline): items #1, #2, #4, #5

**Uncommitted working-tree changes (6 files, +220/−41)** — implemented by worker subagent, diff reviewed + verified by main agent, quick gates pass (type-check ✅, lint 0 errors ✅, format ✅). Worker reported **116 targeted tests passing** before it was interrupted; **full suite NOT re-run yet** (pending — run before commit).

| File | Change |
|---|---|
| `src/screens/settings/SettingsReaderScreen/Modals/TtsTextCleanupModal.tsx` | **#1** removed the duplicate "Applies to" Pressable row (the second, byte-identical block) — exactly one row remains |
| `android/app/src/main/assets/js/core.js` | **#2** `setVisibleCleanup(false)` now restores pristine text from `dataset.originalText` + deletes snapshots (toggle-off reverts DOM immediately). **#4** `applyVisibleCleanup` skips elements whose text is unchanged (never flattens `<span>/<em>/<ruby>` on no-op) |
| `src/screens/reader/components/WebViewReader.tsx` | **#2** added `webViewLoadedRef`, `lastVisibleCleanupInjectedRef`, `injectVisibleCleanupState()` callback; wired into prop effect (~L332), per-novel effect (~L427), MMKV listener (~L540). onLoadEnd (L1526-1533) sets `webViewLoadedRef = true` + seeds `lastVisibleCleanupInjectedRef` so no double-inject. **#4** `visible-cleanup` handler bails when `!shouldCleanVisibleText(settings)` or when cleaned === input (no change) |
| `src/utils/htmlParagraphExtractor.ts` | **#5** new `resolveTtsCleanupTarget(settings)` helper (valid: 'visible'/'both', anything else → 'tts'); used in `cleanTtsText`, `applyTtsTextCleanup`, `shouldCleanVisibleText` — all sites now agree on garbage values |
| `src/utils/__tests__/ttsTextCleanup.test.ts` (+44) | tests for resolveTtsCleanupTarget garbage-value matrix + 'both'/'visible' behavior |
| `src/screens/reader/components/__tests__/WebViewReader.integration.test.tsx` (+59) | tests for re-inject + no-op write-back skip |

**Verification status**: 116 targeted tests pass (worker). Full suite pending. TTS wake-cycle/refill pending.

## ✅ DONE — Group 2 (item #3): Slider vertical-scroll swallow

**Evidence**: `src/components/Slider/Slider.tsx:176-177` — `onStartShouldSetPanResponder: () => !disabled`, `onMoveShouldSetPanResponder: () => !disabled` claim ALL touches → vertical swipes starting on the slider are swallowed, blocking scroll-through in ReaderTTSTab bottom sheet, AccessibilityTab, SettingsAppearanceScreen, Onboarding.
**Required behavior**: vertical drag on slider must scroll the parent; horizontal drag adjusts value; tap still jumps the handle.
**Approach (verified standard pattern)**: `onStartShouldSetPanResponder: () => false`; `onMoveShouldSetPanResponder: (_, g) => !disabled && Math.abs(g.dx) > threshold && Math.abs(g.dx) > Math.abs(g.dy)` (horizontal-dominant only; parent vertical ScrollView wins vertical gestures since child never claims at start). Preserve tap-to-jump (wrap root in Pressable with onPress → updateFromPosition(locationX), or equivalent — keep `updateFromPosition` reuse). Keep flicker fix (dragValue until controlled value catches up) and add/extend `Slider.test.tsx` (e.g. responder decision helper extracted as pure function: vertical → false, horizontal → true, tap path still works).

## ✅ DONE — Group 3 (item #6): UI polish

- **Menu text not uiScale-scaled**: `src/components/Menu/index.tsx:253` `menuItemText fontSize: 14` hardcoded → make uiScale-scaled (pre-change value was `scaleDimension(16, uiScale)`; `uiScale` already available in the component, styles memo depends on it).
- **Nav-bar background no longer set**: `src/theme/utils/setBarColor.ts:19` `//NavigationBar.setBackgroundColorAsync(color);` commented out (function name misleading). Decide: restore the call (check git history `git log -p -- src/theme/utils/setBarColor.ts` for why it was removed — if M3/edge-to-edge intentional, instead remove the dead call + rename or document; prefer restoring behavior to match the name unless there is a hard reason).
- **dbError ErrorFallback button not app-themed**: `App.tsx:109-115` dbError path renders `<ThemeProvider><ErrorFallback/></ThemeProvider>` with no PaperProvider → PaperButton falls back to paper defaults. Wrap with the same `ThemedPaperProvider` used in the main tree (ThemeProvider is MMKV-only, ThemedPaperProvider is pure UI — safe during dbError; verify `ThemedPaperProvider` doesn't touch DB).

## ✅ DONE — Group 4a (items #7, #8a, #8b, #8c): docs + edge cases

**Uncommitted (alongside Groups 1–3). Full suite: 85 suites / 1365 tests passing.**
- **#7 README**: both overclaims corrected (`README.md:55`, `:379`) — API-35 targeting true, third-party patches via pnpm, remaining in-app Kotlin deprecation warnings tracked in plan.md.
- **#8a `getNovelChaptersByNumber`** (`ChapterQueries.ts:441-457`): now async — tries `WHERE chapterNumber = ? ORDER BY position ASC` for valid positive finite numbers, falls back to legacy `position = chapterNumber - 1` when no chapterNumber match. New test file `ChapterQueries.byNumber.test.ts` (4 tests).
- **#8b JumpToChapterModal**: added `loadedChaptersRef` mirror + re-resolve scroll target by chapter id after `loadUpToBatch` (was raw `chap.position`), clamped fallback when still absent; empty-list guard. ChapterDrawer already findIndex-based (no change needed).
- **#8c ReadButton + FAB**: `ReadButton` gets `chapters?: ChapterInfo[]` prop; `targetChapter = lastRead ?? firstUnreadChapter ?? chapters[0]` (`ReadButton.tsx:26`); `NovelScreenList` FAB `continueReadingChapter = lastRead ?? firstUnreadChapter ?? chapters[0]` (`:249`). `NovelInfoHeader` passes `chapters` through.
- Gates: type-check ✅, lint 0 errors (7 pre-existing warnings) ✅, format ✅, full suite ✅.

## ✅ DONE — Group 4b (items #9a, #9b): tests
- **#9a** `src/hooks/common/__tests__/useGithubUpdateChecker.test.ts` — add tests for `ignoreVersion`/IGNORED_UPDATE_VERSION + first-launch `shouldCheckForUpdate()` returning true when `!lastCheckTime`.
- **#9b** new/extended `useTheme` test pinning `transformThemeId` map (1-21 → 100-108, light/dark). `transformThemeId` currently NOT exported from `src/hooks/persisted/useTheme.ts:103` — may need a pure-helper export or test via ThemeProvider.

## Final steps (after Group 4b)

1. Sequential subagent per group (repo precedent: main agent reviews diff + runs gates between groups). One writer at a time.
2. Full gates: `pnpm run type-check`, `pnpm run lint` (0 errors), `pnpm run format:check`, `pnpm run test` (expect ≥ 84 suites / 1349 tests + new ones), TTS wake-cycle 7/7, `pnpm run test:tts-refill`.
3. `pnpm run format && git add .` then commit (repo workflow: format before commit). Ask user about commit grouping (one commit per group vs single batch) before committing.
4. Then advance `origin/dev` → this branch (currently `git rev-list --count HEAD..origin/dev` = 0, clean fast-forward) and push — confirm with user first.

## Notes

- Working tree currently has the Group 1-3 + 4a changes, UNCOMMITTED. Do NOT reset.
- `origin/dev` fully contained in HEAD (0 commits on origin/dev not on HEAD) — advancing is a clean fast-forward once fixes are committed.
