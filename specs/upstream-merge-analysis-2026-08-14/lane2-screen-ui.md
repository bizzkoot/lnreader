I have gathered sufficient evidence from the fork working tree. Note: my toolset has no shell/`git` execution capability, so all fork-side checks were done via file reads/finds (working tree) and the upstream diffs were analyzed from the commit metadata + PR context supplied. I flag this limitation in the acceptance report.

---

## Review of Lane 2 commits (portability analysis)

### Summary of evidence gathered first
- All fork paths verified via `find`/`ls`/`read` on the working tree.
- No root `plugins/` directory exists in the fork (`plugins/android/android-build-types.gradle` is MISSING).
- `MainActivity.kt` already performs native edge-to-edge (`setDecorFitsSystemWindows(false)`, transparent bars, cutout mode, API 30+ path).
- `app.json` already includes the `react-native-edge-to-edge` plugin.
- `src/utils/useLoadingColors.ts` exists with values that appear to be the *pre-fix* (primary-tinted) baseline.
- `src/screens/StatsScreen/` contains only `StatsScreen.tsx` (raw-SQL based). `GenreStatsScreen`, `StatsScreen/utils.tsx`, `SettingsTaxonomyScreen.tsx` are MISSING.
- `src/hooks/persisted/useSettings.ts`, `useChapter.ts`, `useFullscreenMode.ts`, `LibraryScreen.tsx`, `useLibrary.ts`, `NovelScreenList.tsx`, `ChapterDrawer/index.tsx`, `BottomNavigator.tsx` are all fork-customized.

---

## 1eb8c587c fix: Prevent Library From Remaining in Loading State

- **Files (upstream)**: `src/screens/library/LibraryScreen.tsx`, `src/screens/library/hooks/useLibrary.ts`, tests
- **Fork file status**: HAS both. Both are fork-customized:
  - `LibraryScreen.tsx` — fork adds ServiceManager update menu (UPDATE_LIBRARY/UPDATE_CATEGORY), EPUB import, Actionbar bulk actions, SetCategoryModal, resume FAB, insets.
  - `useLibrary.ts` — fork adds MMKV `taskQueue` restore-task tracking + `restoreTasksCount` watcher that triggers refetch (`useLibrary.ts:33-117`).
- **Divergence / bug presence**: The fork's `getLibrary` (`useLibrary.ts:64-76`) sets `isLoading(true)` only when `searchText` is set and calls `setIsLoading(false)` *after* `Promise.all` with **no try/catch/finally**. `LibraryScreen.renderScene` (≈`LibraryScreen.tsx:141`) shows `SourceScreenSkeletonLoading` whenever `isLoading` is true. If `refreshCategories()` or `getLibraryNovelsFromDb()` rejects, `setIsLoading(false)` never runs → library stuck on skeleton. This matches the upstream "pre-fix byte-identical" pattern documented in `.agents/upstream-merge-memory.md`.
- **Portability**: MANUAL (files diverged; a clean cherry-pick will not apply)
- **Safety score**: 72/100 (GREEN) — risk LOW/MED
- **Overlap with fork-custom code**: YES — both touched files are fork-customized (ServiceManager update tasks, MMKV restore-task tracking).
- **Porting guidance**: Fetch `git show 1eb8c587c`; the likely hunk is wrapping the fetch in try/catch/finally (or gating the skeleton on `isLoading && !library.length`). Apply by hand to fork's `useLibrary.ts` `getLibrary` (preserve the fork's restore-task watcher) and mirror the LibraryScreen display-condition change. Add the upstream test adapted to fork's mock surface.
- **Verdict**: PORT

---

## c6679b7f4 fix: Draw Content Behind Android Navigation Bar (#1260)

- **Files (upstream)**: `app.json`, `src/hooks/common/useFullscreenMode.ts`, `src/navigators/Main.tsx`, `NovelScreen.tsx`, `NovelScreenList.tsx`, `src/theme/utils/setBarColor.ts`
- **Fork file status**: HAS all. All are fork-modified:
  - `app.json` already contains `react-native-edge-to-edge` plugin (`app.json:7`).
  - `useFullscreenMode.ts` already uses `SystemBars` from `react-native-edge-to-edge` plus `expo-navigation-bar` — fork's own hybrid (not upstream's post-#1260 shape).
  - `setBarColor.ts:24-31` — fork-modified: `changeNavigationBarColor` only sets button style; background intentionally left to the system (comment cites upstream #1076).
  - `MainActivity.kt:19-39` — native `setDecorFitsSystemWindows(false)`, transparent status/nav bar, cutout `SHORT_EDGES`.
  - `SafeAreaView.tsx:18-28` — inset padding (top/bottom/left/right) with `excludeTop`/`excludeBottom` knobs; NovelScreen uses `SafeAreaView excludeTop`.
- **Assessment**: The fork already implements the #1260 *behavior* natively (edge-to-edge + inset handling + system-owned nav-bar background). The upstream commit is mostly managed-Expo config + screen adjustments that the fork has no equivalent need for. Residual unknown: reader-screen bottom-footer spacing vs. nav-bar inset (fork's own TTS-heavy code — must be visually verified, but it's fork-owned behavior, not something to port).
- **Portability**: SKIP-ALREADY-HAVE
- **Safety score**: 70/100 (GREEN) — risk LOW (visual verification recommended)
- **Overlap with fork-custom code**: YES — `useFullscreenMode.ts` (reader TTS fullscreen path via `useChapter.ts:72`), `setBarColor.ts` (fork-modified), `NovelScreenList.tsx` (LegendList fork rewrite).
- **Porting guidance**: None required. If implementer wants belt-and-suspenders: run the upstream diff and check only for any *layout* hunk (e.g., extra bottom padding on NovelScreen) that the fork's `SafeAreaView`/insets don't already cover; otherwise skip entirely.
- **Verdict**: SKIP

---

## 15560b67b fix: Pass Plugin `imageRequestInit` Headers to Novel Detail Cover (#1977)

- **Files (upstream)**: `src/screens/novel/components/Info/NovelInfoHeader.tsx` (only)
- **Fork file status**: HAS, fork-customized (uiScale scaling, `pluginName` MMKV lookup at `NovelInfoHeader.tsx:151-156`, followNovel button, save-cover flow).
- **Divergence**: Cover rendering passes `source={{ uri: novel.cover }}` to `CoverImage`/`NovelThumbnail` (`NovelInfoHeader.tsx` ≈line 150); `NovelInfoComponents.tsx` `CoverImage` (ImageBackground) and `NovelThumbnail` (Image) accept only `uri`. Plugin headers are **not** forwarded. Fork's `pluginManager.ts:59-73` already builds `imageRequestInit` with a default User-Agent, and `src/plugins/types/index.ts:72` declares it — so the data source exists.
- **Portability**: MANUAL (tiny, isolated)
- **Safety score**: 80/100 (GREEN) — risk LOW
- **Overlap with fork-custom code**: NO (NovelInfoHeader is not in the protected registry; file is fork-styled but not TTS/DoH/DB).
- **Porting guidance**: In `NovelInfoHeader.tsx`, reuse the existing `AVAILABLE_PLUGINS` lookup to obtain `imageRequestInit?.headers`, pass `headers` through the `source` object (`{ uri: novel.cover, headers }`) into `CoverImage`/`NovelThumbnail` (RN `Image`/`ImageBackground` accept `headers` in source). Keep fork scaling intact. Consider a small unit test mirroring upstream's.
- **Verdict**: PORT

---

## 084dcccab fix: Match Chapter Drawer Read Color (#1973)

- **Files (upstream)**: `src/screens/reader/components/ChapterDrawer/RenderListChapter.tsx` + test
- **Fork file status**: HAS `RenderListChapter.tsx` (plain component, no fork divergence in the component itself; parent `ChapterDrawer/index.tsx` is fork-customized — LegendList, uiScale). No test file for it in fork.
- **Divergence**: Fork `RenderListChapter.tsx:37` colors read chapters `theme.outline` (and release date `theme.outline` at line ~48). Fork's novel-list `ChapterItem.tsx` uses the **same** `theme.outline` for read chapter name (`ChapterItem.tsx` read-color branch). The drawer and list read colors already match in the fork.
- **Portability**: SKIP-ALREADY-HAVE (medium confidence — verify the exact upstream value: if #1973 changed *both* sites to a new token, re-apply the new token to both fork sites; if it merely aligned drawer→`theme.outline`, fork already has it).
- **Safety score**: 70/100 (GREEN) — risk LOW
- **Overlap with fork-custom code**: MINIMAL (only via fork-customized parent drawer `index.tsx`; `RenderListChapter.tsx` itself is vanilla).
- **Porting guidance**: `git show 084dcccab` and diff the color value. If fork's drawer color already equals the novel-list color, skip. If a new color is introduced, apply to both `RenderListChapter.tsx` and `ChapterItem.tsx` for consistency and port the test.
- **Verdict**: SKIP (verify)

---

## 51560195b fix: Soften Skeleton Loading Colors (#1964)

- **Files (upstream)**: `src/utils/useLoadingColors.ts` + test
- **Fork file status**: HAS `useLoadingColors.ts` (no fork test).
- **Divergence**: Fork values are the primary-tinted baseline: `highlightColor = color(theme.primary).alpha(0.08)` (`useLoadingColors.ts:7`); dark bg → `lighten(0.1)` (with a `luminosity()===0 → negate().darken(0.98)` guard, lines 11-14); light bg → `darken(0.04)` (line 16). The primary-tinted highlight indicates the *soften* commit is likely **not** applied. The luminosity guard is ambiguous (may predate #1964).
- **Portability**: MANUAL (one-file value tweak; visual-only)
- **Safety score**: 75/100 (GREEN) — risk LOW
- **Overlap with fork-custom code**: NO (not in protected registry; consumed by skeletons/`NovelScreenLoading`, no TTS path).
- **Porting guidance**: `git show 51560195b` and apply the exact new alpha/lighten/darken values to fork's `useLoadingColors.ts`; keep the `disableLoadingAnimations` interpolation block (fork/upstream share it). Port the test if it adds value. Visual check on light+dark themes and on pure-black background theme.
- **Verdict**: PORT (with care — verify exact values)

---

## e0c89cdd9 fix: Neutralize Skeleton Loading Colors

- **Files (upstream)**: `src/utils/useLoadingColors.ts` only
- **Fork file status**: HAS (same file as above).
- **Divergence**: Fork still uses a `theme.primary`-tinted highlight (`alpha(0.08)`), i.e., the *neutralize* outcome (likely a neutral/primary-free gray) is not present.
- **Portability**: MANUAL (one-file value change, visual-only; depends on #1964 landing first or being combined)
- **Safety score**: 75/100 (GREEN) — risk LOW
- **Overlap with fork-custom code**: NO
- **Porting guidance**: Same as #1964 — apply the upstream final values in one pass (both commits touch the same two lines). If porting both, take the *post-e0c89cdd9* file content wholesale and re-add any fork-only deltas (check: none known in this file).
- **Verdict**: PORT (with care)

---

## 67e01bc2d fix: Resolve Stats Screen Logic Issue (#1968)

- **Files (upstream)**: `src/screens/GenreStatsScreen/*` (MISSING), `src/screens/StatsScreen/utils.tsx` (MISSING), `SettingsTaxonomyScreen.tsx` (MISSING)
- **Fork file status**: Only `src/screens/StatsScreen/StatsScreen.tsx` (minimal, single screen) + `src/database/queries/StatsQueries.ts` (raw SQL) + `__tests__/StatsQueries.test.ts`.
- **Assessment**: The upstream commit is a refactor of a stats UI the fork does not have. The fork's counting logic (`StatsQueries.ts:75-137`) is raw SQL with `JOIN Novel … WHERE inLibrary=1` for chapter counts and comma-split `countBy` for genres/status — semantically sound for what it displays; the specific upstream logic bug (in upstream's `utils.tsx` aggregation) has no direct fork counterpart. No actionable hunk to port. Memory file confirms a "stats overhaul" is already slated for Batch D, where a fork-native rewrite would supersede this.
- **Portability**: SKIP (files missing; fork logic differs)
- **Safety score**: 65/100 (YELLOW) — risk LOW (no port attempted; note for Batch D)
- **Overlap with fork-custom code**: NO (StatsQueries is fork's expo-sqlite layer, but not TTS/DoH/scaling/migrations-protected).
- **Porting guidance**: None now. If Batch D "stats overhaul" proceeds, treat this upstream refactor as design reference only; re-verify fork's `getNovelGenresFromDb` empty-string edge (`''.split() → ['']` counts an empty genre) during that work.
- **Verdict**: SKIP

---

## 3ece098b9 perf: Optimize APK Size (#1969)

- **Files (upstream)**: `app.json`, `package.json`, `plugins/android/android-build-types.gradle`, `src/components/NovelList.tsx`, `src/navigators/types/index.ts` + 12 files with import changes (GlobalSearchScreen, StatsScreen, LibraryScreen, SetCategoriesModal, TrackSearchDialog, useNovelScreenActions, ChapterDrawer/index, useChapter, NavigationTab, parseChapterNumber, …)
- **Fork file status**:
  - `plugins/android/android-build-types.gradle` — MISSING (no root `plugins/` dir; fork's Gradle lives in `android/app/build.gradle`). → build wall.
  - `app.json` — HAS, minimal fork config; upstream app.json is managed-Expo full config. Mostly non-applicable.
  - `package.json` — HAS, heavily customized (Expo 54.0.25, RN 0.82.1, `@react-native-vector-icons/material-design-icons` 12.4.0, `lottie-react-native` 5.1.3 + `lottie-ios` 3.5.0 — the latter two have **zero imports in `src/`**, so they're dead weight already; candidate for fork-side removal independently).
  - `src/components/NovelList.tsx`, `src/navigators/types/index.ts`, GlobalSearchScreen, StatsScreen, LibraryScreen, SetCategoriesModal, TrackSearchDialog, ChapterDrawer/index, useChapter, BottomNavigator (NavigationTab), `parseChapterNumber.ts` — all HAS; nearly all fork-modified (LibraryScreen/useChapter/BottomNavigator/ChapterDrawer-index are fork-customized; parseChapterNumber is vanilla).
  - `useNovelScreenActions` — MISSING (fork inlines those actions in `NovelScreenList.tsx`).
- **Assessment**: The gradle hunk (likely resource shrinking/minify) is the only real APK-size lever, and it targets a file that doesn't exist here; porting the concept to `android/app/build.gradle` under AGP 8.12/Gradle 9.2.0 means R8 + proguard rules for plugins — high blast radius. The 12 import-change hunks are unknown without the diff but all land in fork-modified files → MANUAL per-file. `package.json` changes risk dep/version conflicts (fork pins Expo 54-era versions).
- **Portability**: PARTIAL — only: (a) fork-side removal of unused `lottie-react-native`/`lottie-ios` (worth checking `react-native-lottie-splash-screen` usage first), (b) after reviewing the actual diff, selectively port any mechanical import changes, (c) evaluate gradle shrinking separately.
- **Safety score**: 55/100 (YELLOW) — risk MED
- **Overlap with fork-custom code**: YES — `useChapter.ts` (reader/TTS-adjacent), `LibraryScreen.tsx`, `BottomNavigator.tsx` (settings-driven tabs), `package.json` (fork build pins).
- **Porting guidance**: `git show 3ece098b9` first; classify each of the 12 import hunks (they may be mechanical — e.g., icon/module consolidation). Do **not** port `plugins/` or `app.json` wholesale. For the gradle change: create a fork-side equivalent in `android/app/build.gradle` release buildType only, run a release build + smoke test plugins/TTS. Confirm lottie removal is safe by grepping for `react-native-lottie-splash-screen` usage in `index.js`/`MainActivity`.
- **Verdict**: PORT-with-care (selective only)

---

## Summary table

| hash | title | portability | score | verdict |
|---|---|---|---|---|
| 1eb8c587c | fix: Prevent Library From Remaining in Loading State | MANUAL | 72/100 (GREEN) | PORT |
| c6679b7f4 | fix: Draw Content Behind Android Navigation Bar (#1260) | SKIP-ALREADY-HAVE | 70/100 (GREEN) | SKIP |
| 15560b67b | fix: Pass Plugin `imageRequestInit` Headers to Novel Detail Cover (#1977) | MANUAL | 80/100 (GREEN) | PORT |
| 084dcccab | fix: Match Chapter Drawer Read Color (#1973) | SKIP-ALREADY-HAVE | 70/100 (GREEN) | SKIP (verify) |
| 51560195b | fix: Soften Skeleton Loading Colors (#1964) | MANUAL | 75/100 (GREEN) | PORT (care) |
| e0c89cdd9 | fix: Neutralize Skeleton Loading Colors | MANUAL | 75/100 (GREEN) | PORT (care) |
| 67e01bc2d | fix: Resolve Stats Screen Logic Issue (#1968) | SKIP (files missing) | 65/100 (YELLOW) | SKIP |
| 3ece098b9 | perf: Optimize APK Size (#1969) | PARTIAL | 55/100 (YELLOW) | PORT-with-care |

---

## Acceptance report