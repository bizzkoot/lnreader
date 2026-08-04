# PRD — Batch D: Project-Scale Features (Separate PRs)

**Status**: 📋 PLANNED (analysis complete; no code changes yet)
**Date**: 2026-08-03
**Source**: `specs/upstream-merge-analysis-2026-08/analysis.md` · Manifest batch: D (5) + D-stretch (1) + D-optional (10)
**Estimated effort**: each core item is its own multi-day PR

---

## 1. Objective

The highest-value upstream features that **cannot be cherry-picked** — every one depends on upstream-only infrastructure (Drizzle, zustand store, Nitro, WorkManager) or rewrites fork-critical files. Each must be **reimplemented on the fork's architecture** (raw-SQL + custom TTS + expo-sqlite) as an independent PR with its own test plan.

## 2. Core projects (5)

### D1. Time Tracking & Statistics — `89c43c1eef` (+ toggle `4a4208e336`)
- **User value**: reading-time stats per chapter/novel, sessions, statistics screen. Fork's StatsScreen covers library counts only — no `timeSpent`/session anywhere.
- **Reimplementation**: 1 new table via fork's `MigrationRunner` (raw SQL), extended raw-SQL `StatsQueries`, standalone `useTimeTracking` hook (~59 lines, portable from upstream), wiring into `useChapter`/`WebViewReader` (fork-critical — careful).
- **Order**: after `89c43c1e` lands, add `4a4208e3` (toggle + inactivity timeout).
- **Risks**: WebViewReader wiring interacts with TTS paragraph events — run full TTS suites.

### D2. In-Chapter Search — `71da09ed44` (#1877)
- **User value**: best reader feature in the whole upstream set (word search inside current chapter).
- **Reimplementation**: upstream `search.js` (442 lines) + `ReaderSearchbar` (246) must be re-adapted against fork's diverged `core.js` (bionic reading, spacing rebuild, custom TTS speak/normalize) and its DOM rebuild lifecycle. ReaderScreen/ReaderAppbar/WebViewReader/useChapter wiring.
- **Risks**: HIGH — DOM index contract with TTS paragraph highlighting must stay intact; expect a day+ of work + TTS regression testing.

### D3. Stats Overhaul: Genre Taxonomy + Charts — `96fb52df17` (#1919)
- **User value**: StatsScreen tabs (Overview/Time/Plugins), SVG donut charts, genre taxonomy screen with per-genre carousels (+2939/−719, 31 files).
- **Reimplementation**: needs new dep `react-native-svg` (fork lacks it); upstream query half is Drizzle → rewrite `StatsQueries.ts` in raw SQL. UI components are new files (low conflict).
- **Prerequisite**: D1 time-tracking provides the Time tab data.

### D4. Reader Perf Sprint — `3d102a52a7` (#1899)
- **User value**: faster chapter open, no re-render stutter while reading, scroll restore ~100ms vs ~1.5s.
- **Strategy**: do NOT port code (touches every fork-critical reader file + upstream store/asset layout). Port **techniques** as a manual perf sprint on fork's `WebViewReader.tsx`/`useChapter.ts`/`core.js`:
  - Defer adjacent-chapter resolution
  - Cache sanitized HTML
  - Lazy-mount drawer + settings sheet
  - Memoized drawer rows
  - Single coalesced scroll listener
  - One mark-as-read per chapter
- **Risks**: HIGH conflict surface by nature; run TTS wake-cycle/refill after every sub-change.

### D5. Scheduled Library Updates — `164f5d2592` (D-stretch)
- **User value**: automatic library updates at 12/24/48/72/168h intervals (fork has only `updateLibraryOnLaunch`).
- **Reimplementation**: upstream uses Expo-module `native-background-tasks`/WorkManager — fork would add a native scheduler (AlarmManager/WorkManager) OR adapt fork's ServiceManager/headless task; plus `automaticLibraryUpdateIntervalHours` in `AppSettings` + `SettingsLibraryScreen` dialog.
- **Risks**: native scheduling + battery/Doze behavior; moderate-to-high effort.

## 3. Optional projects (10, lower priority)

| Commit | Project | Note |
|---|---|---|
| `198b7443ae` | RTL language support (#1717) | 44 files incl. WebViewReader (84-line diff) — dedicated effort for Arabic/Urdu/Hebrew users |
| `a16ec87631` | Novel covers/lists/chapter-group perf | expo-image `NovelCoverImage`, virtualized `NovelChapterGroup` lists — large manual port + perf regression testing |
| `9805da63cf` | Novel screen perf/architecture | Re-implement perf goals (skeletons, memoized rows, lazy modals) on fork's useNovel stack |
| `5e62c36a9b` | Library settings + category-based global updates | Completes fork's TODO-stubbed `DefaultCategoryDialog` (SettingsLibraryScreen:18); Drizzle→SQL rewrite |
| `bd527a02ef` | Backup selection / plugin restore overhaul | +2021/−249, 31 files; port only selection/options/plugin-restore slices |
| `98a2a1d725` | Scanlator filtering (#1864) | Needs schema migration + plugin-pipeline change to populate column — only useful for aggregator sources. Do last, if at all |
| `2f45db659b` | Async DB ops (SQLITE_BUSY) | Fork-side incremental effort across queries/useNovel/library/downloadChapter/migrateNovel |
| `29bd6612e9` | Library screen perf + category index bug | Re-implement on fork's LibraryScreen/useLibrary |
| `4c7684a3a7` | Novel screen perf + download-state tracking | Port selectively (updateChapter state bug, Set-based tracking) |
| `11ff69d4f5` | Pre-fetch adjacent page chapters | Port only the LibraryUpdateQueries preload half; reader half touches fork-critical useChapter |

## 4. Common risks

- **Every D project touches fork-critical files** (WebViewReader, useChapter, useSettings, database, core.js). Each must be its own branch + PR with dedicated regression gates.
- **Drizzle→SQL translation** is required for all query work — fork's `MigrationRunner` + raw-SQL layer is the target.
- **TTS regression** is the #1 hazard (D1, D2, D4) — the TTS wake-cycle/refill suites are mandatory gates.

## 5. Suggested sequencing

1. D4 (perf sprint) — improves baseline for everything else; sub-item sized
2. D1 (time tracking) → D3 (stats overhaul) — data → presentation
3. D2 (in-chapter search) — biggest user win, heaviest risk
4. D5 (scheduled updates) — native scheduling as its own project
5. Optional projects — only after core D lands and `dev` is stable

## 6. Testing & validation (per project)

```bash
pnpm run type-check && pnpm run lint:fix && pnpm run format
pnpm run test
pnpm run test:tts-wake-cycle && pnpm run test:tts-refill   # D1/D2/D4 mandatory
```

Manual QA per project (per acceptance criteria defined in each PR's own spec).

## 7. Acceptance criteria (per project)

- [ ] Feature fully functional on fork architecture (raw SQL, custom TTS, MMKV settings)
- [ ] Zero regressions in existing fork features (TTS, DoH, backup, per-novel settings)
- [ ] 1235+ tests green + TTS suites green
- [ ] Performance metrics measured before/after (for D3/D4)
- [ ] `pnpm run format` applied before commit

## 8. Out of scope

- Porting upstream's zustand store / Nitro / WorkManager architecture itself
- Batch A–C work (tracked in their PRDs)
- Any upstream commit marked SKIP in `commit-manifest.csv`
