# PRD — Batch B: High-Value Features

**Status**: 📋 PLANNED (analysis complete; no code changes yet)
**Date**: 2026-08-03
**Source**: `specs/upstream-merge-analysis-2026-08/analysis.md` · Manifest batch: B (7) + B-stretch (15)
**Estimated effort**: 2–3 days (core B) · stretch items optional, ~1 day each

---

## 1. Objective

Port **7 high-value user-facing features** that the fork genuinely lacks, adapting each to the fork's architecture (raw-SQL DB, custom TTS, MMKV settings, `strings/languages/` i18n). All are MANUAL ports — none cherry-pick cleanly, but each is bounded and self-contained.

## 2. Scope — core batch (7 commits)

| # | Commit | Feature | Port notes |
|---|---|---|---|
| 1 | `c40edd5b2c` | **Kitsu tracker** (#416) | New service file `kitsu.ts` (~490 lines: auth, list sync, scoring) + score selectors + tracker cards + settings screen + login dialog. Fork's tracker infra exists (`src/services/Trackers/`, TrackerCards, ScoreSelectors, SetTrackScoreDialog, SettingsTrackerScreen). Best value/effort in batch. |
| 2 | `c0877a9b06` | **Ignorable app update notifications** | Long-requested (upstream #600/#1632): "ignore this version" persistence (MMKV) so update prompt never returns. Fork's `useGithubUpdateChecker.ts` is a near-clone of upstream's deleted hook — port `AppUpdateChecker` + ignore-version field; keep fork's repo URL (`bizzkoot/lnreader`) + `githubReleaseUtils.pickApkAsset`. |
| 3 | `345d084eba` | **Chapter numbers in EPUB titles** (#1405) | New `epubIncludeChapterNumber` setting (useSettings, additive) + numbered-title composition in export flow. Adapt to fork's `@cd-z/react-native-epub-creator` (JS) — NOT upstream's nitro-epub. Files: `ExportEpubModal`, `ExportNovelAsEpubButton`. |
| 4 | `799845426c` | **Parallel library updates across sources** | Fork's `services/updates/index.ts` is a sequential `for` + `sleep(1000)` loop. Port group-by-pluginId + `Promise.all` concurrency-3 pattern. No schema/native changes. Skip upstream `TaskNotificationFactory.kt` (fork shows progress via ServiceManager metadata). |
| 5 | `8f237909d5` | **First unread chapter in ReadButton/FAB** | "Start reading" jumps to first unread chapter instead of `chapters[0]`. New `getFirstUnreadChapter` SQL + exposure via `useNovel` + `ReadButton.tsx`/`NovelScreenList.tsx` wiring. Fork has no first-unread logic today. |
| 6 | `4ad0639796` | **Jump-to-chapter / drawer can't reach unloaded chapters** | New raw-SQL queries `getNovelChaptersByNumber` (`position = ?`) + `getNovelChaptersByName` (`name LIKE ?`) — map 1:1 onto fork expo-sqlite; `loadUpToBatch` in useNovel; wire `JumpToChapterModal.tsx` + `ChapterDrawer/index.tsx`. Skip commit's pnpm-lock churn. |
| 7 | `5d996f1388` | **Configurable chapter download cooldown** (#1834) | `chapterDownloadCooldownMs` AppSettings + modal + replace hardcoded `await sleep(1000)` in `downloadChapter.ts:93`. Helps users hitting 429 rate limits. |

## 3. Scope — stretch batch (15 commits, optional)

| Commit | Feature | Effort |
|---|---|---|
| `c30441b949` | Smart library update filters (skip read/completed/unstarted) | SQL filter trivial (fork schema has `status`/`lastReadAt`); `SmartUpdateDialog` UI in SettingsLibraryScreen |
| `8ac628b3de` | Per-novel history removal + confirm dialog | New `deleteNovelHistory` SQL + `useHistory`/`HistoryScreen`/`HistoryCard` UI |
| `732628c40b` | Date format + relative timestamp settings | New `utils/dateFormat.ts` + Appearance setting + `DateFormatModal`; touches ~8 screens (History, Downloads, ChapterItem, Updates, GoogleDriveModal…) |
| `d02291c22c` | Remember last used library category | Small setting + rehydration in `LibraryScreen` (bottom-tab index state) |
| `97be48dfe1` | Migration review options (cover/metadata source, redownload policy + review dialog) | Adapts to fork's raw-SQL `migrateNovel.ts` + `MigrationNovelList.tsx`; closes upstream #937/#1037 |
| `3e1e211098` | WebView address bar | ~11 lines in `WebviewScreen` Appbar (URL display + address bar) |
| `eac6ad584e` | Novel app bar + EPUB export UX polish | Re-port against fork's `NovelAppbar`, `ExportEpubModal`, `JumpToChapterModal`, `NovelScreenList` (different layouts/uiScale) |
| `b53ec3352f` | Plugin setting types: dropdown + checkboxes | Extend `src/plugins/types/index.ts` + `SourceSettings.tsx` (fork currently pre-fix) |
| `ae99b077d4` | `@noble/ciphers` for plugins (#1709) | Add dep + expose `crypto` surface in `pluginManager.ts` |
| `01596c045a` | Apply active filters to chapter count display (#1793) | Extend raw-SQL `getChapterCount` with filter arg; update `useNovel` call sites (105/270/291) |
| `d2b95ae316` | NativeFile for custom CSS/JS import (#1661) | Replace `StorageAccessFramework.readAsStringAsync` in `AdvancedTab.tsx:206` with NativeFile copy/read |
| `caed965b6b` | EPUB import DocumentPicker cache-cleanup crash (#1725) | `copyToCacheDirectory: false` in `LibraryScreen.tsx:167` |
| `9922d43940` | EPUB export missing-image cleanup (#1696) | Remove `<figure>`/`<img>` refs to deleted files during export |
| `138fdff2e5` | Prevent duplicate WebView bottom insets | Remove `paddingBottom: bottom` in `WebviewScreen.tsx` container (fork likely has same double-inset bug) |
| `4dc933ee5a` | Remove white flash during screen transitions (#1926) | ThemedRootView paints root bg + reader stack background; replace upstream config-plugin hunk with native `res/values` windowBackground |

## 4. Feature-specific risks

| Feature | Risk |
|---|---|
| Kitsu tracker | New OAuth/API surface — needs network mocking in tests; tracker login dialog rework touches shared components |
| Ignorable update notifications | Persistence key must not clash with existing MMKV `AppSettings` fields; keep fork repo URL |
| Parallel library updates | Concurrency changes update-ordering semantics — regression-test global update with >3 sources |
| Jump-to-chapter fix | `loadUpToBatch` touches fork-modified `useNovel` — isolate + run novel-screen tests |
| Download cooldown | AppSettings interface change ripples to any screen reading settings |

## 5. Implementation order (core)

1. `79984542` (parallel updates) — smallest, highest certainty
2. `c40edd5` (Kitsu) — new file + wiring, no conflicts
3. `8f23790` + `4ad0639` — reader/navigation cluster (share `useNovel`/ChapterQueries touchpoints)
4. `345d084e` + `c0877a9b` — settings + persistence cluster
5. `5d996f13` — downloader

Work on a branch: `merge/original-sync-batch-b`.

## 6. Testing & validation

```bash
pnpm run type-check && pnpm run lint:fix && pnpm run format
pnpm run test
pnpm run test -- --testPathPattern="Tracker|NovelQueries|ChapterQueries|Settings"
pnpm run test:tts-wake-cycle   # safety gate if ReaderScreen/useNovel touched
```

Manual QA:
- Kitsu: login → list sync → score sync → search
- Parallel updates: 3+ sources with many novels; observe parallel progress
- Jump-to-chapter: open chapter beyond preloaded batch from both modal and drawer
- Update ignore: tap "ignore version" → relaunch → no prompt

## 7. Acceptance criteria

- [ ] All 7 core features live with settings persisted in MMKV
- [ ] No regressions in existing tracker flows (MAL/AniList/MangaUpdates)
- [ ] Library updates complete faster (parallel) without duplicate/overlapping downloads
- [ ] 1235+ tests green; TTS suites green
- [ ] Stretch items each landed as separate small PRs with own tests

## 8. Out of scope

- Anything touching the TTS engine internals (WebViewReader TTS sections, TTSAudioManager, .kt TTS modules)
- Drizzle-based upstream implementations (rewrite to raw SQL)
- Batch C theme train and Batch D project-scale work
