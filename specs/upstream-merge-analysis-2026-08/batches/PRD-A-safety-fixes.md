# PRD — Batch A: Safety Fixes

**Status**: 📋 PLANNED (analysis complete; no code changes yet)
**Date**: 2026-08-03
**Source**: `specs/upstream-merge-analysis-2026-08/analysis.md` · Manifest batch: A1, A2, A3
**Estimated effort**: half-day (Phase 1) + 1 day (Phase 2)

---

## 1. Objective

Port **29 verified upstream bug fixes** into the fork. These fixes target code the fork often carries **byte-identical to the upstream pre-fix state**, meaning the fork has the same live bugs. Phase 1 is low-risk ports (8 verified clean-apply); Phase 2 is localized manual ports with verified identical pre-fix code.

**Verified live fork bugs this batch fixes:**
- Deleting read chapters deletes the **wrong folder** (`deleteReadChaptersFromDb` passes `chapter.novelId` as chapter id)
- "Delete downloads" wipes `isDownloaded = 0` for **every chapter** in the DB (UPDATE without WHERE)
- Default category breaks after category reorder (`WHERE sort = 1`)
- TTS reads leading/trailing quotes aloud (`normalizeText`)
- Deleting a downloaded chapter whose files were removed externally **crashes the whole app** (NativeFile unlink `throw`)
- ServiceManager notification throttle computes **negative delays** (never throttles)
- Multi-page novels: chapters ordered by TEXT `page` comparison; wrong next/prev chapter
- Unawaited `db.runAsync` inside `withTransactionAsync` (NovelQueries.ts:180/321, helpers.tsx:133-137) → SQLITE_BUSY/concurrency risk
- Genre strings crash EditInfoModal/NovelInfoComponents on malformed data

---

## 2. Phase 1 — Tier-1 verified fixes (16 commits: 8 DIRECT clean-apply + 8 MANUAL)

| Commit | Subject | Port strategy |
|---|---|---|
| `34be7a1234` | fix(native-file): prevent fatal crash when unlinking missing files (#1832) | NativeFile.kt: `if (!file.exists()) throw` → `return` (1 line). **Top crash fix.** |
| `54fedc2f53` | fix(tts): remove leading/trailing quotes from normalized text (#1869) | `core.js` `normalizeText` (~line 2203): strip `"`/`'` at string ends. Manual apply (core.js diverged elsewhere). Run TTS tests after. |
| `45c4ea8ca0` | fix: handle IOException in NativeFile to prevent EPUB import crash loop (#1315) | Wrap `writeFile`/`readFile`/`copyFileContent` IOExceptions. Direct (NativeFile.kt). **ALSO includes the try/catch around `NativeFile.copyFile` in `src/services/epub/import.ts:129` (fork pre-fix) — the commit's named EPUB-import crash-loop fix lives partly there; port BOTH files.** |
| `4088d5966b` | fix: close OkHttp response and streams in NativeFile.downloadFile (#1740) | `response.body!!.byteStream()` → wrap in `use {}`. Direct. |
| `57b9d41b5c` | fix(service): correct notification throttle logic in ServiceManager.setMeta (#1873) | Fix inverted condition + `delay = 1000 - (now - lastNotifUpdate)`. Direct (fork `ServiceManager.ts:152-153`). |
| `9e38ad114d` | fix: sanitize EPUB filename (#1480) | `ExportNovelAsEpubButton.tsx`: sanitize `novel.name` for filesystem-unsafe chars. 1 line. Direct. |
| `93bc5e5e4b` | fix: handle missing MAL list entries and null progress (#1875) | `SetTrackChaptersDialog.tsx` null-safe `progress.toString()` + default-entry creation in `myAnimeList.ts`. **Manual** — fork `myAnimeList.ts` diverged (@env client id, WebBrowser, pkceChallenger); only the SetTrackChaptersDialog hunk ports cleanly. |
| `788f6cede7` | fix: prevent table overflow and clean up CSS (#1876) | `index.css`: `div:has(> table):not(#LNReader-chapter){overflow:auto}` + next-button cleanup. Direct. |
| `76106317b6` | fix: restore Midnight Dusk chip contrast (#1939) | `SelectableChip.tsx`: remove `selectedColor={theme.primary}` (1 line). Direct. |
| `31cb4b994a` | fix: align bottom navigation with Material 3 specs | `BottomTabBar/index.tsx`: `paddingBottom: 16 + insets`. **Manual** — fork BottomTabBar rewritten (`getStyles` + scaled `padding.xs`); upstream hunk fails `git apply --check`, apply the M3 intent with fork's scaled values. |
| `0ed7d878b4` | fix: prevent white reader drawer seam | `ReaderScreen.tsx`: `drawerStyle={{backgroundColor:'transparent'}}`. Tiny hunk in fork-critical file — manual apply. |
| `a062beee87` | fix: add max height to Set Categories modal (#1738) | `SetCategoriesModal.tsx`: FlatList `maxHeight: 40% window`. **Manual** — fork modal rewritten (scaleDimension/AppText); hunk fails apply, apply maxHeight intent manually. |
| `f1fdafd37f` | fix: prevent tab bar height jump and shadow flash on Browse screen | `BrowseScreen.tsx`: add `initialLayout` to TabView + border instead of shadow. **Manual** — fork has eslint-disable header + no Color import; hunk fails apply, apply intent manually. |
| `65e8610030` | refactor: replace bottom navigation shift with fade | `BottomNavigator.tsx:68`: `animation: 'shift'` → `'fade'`. Direct. |
| `2a919ec0f9` | chore: gitignore tsconfig.tsbuildinfo build cache (#1829) | 1-line `.gitignore`. **Manual-trivial** — fork .gitignore context differs (expo-cli block); append `tsconfig.tsbuildinfo` manually. |
| `9783c4d5e3` | fix: normalize repository back navigation (#1905) | `SettingsRepositoryScreen.tsx`: remove `useBackHandler` + unconditional `popTo` on back. Manual-trivial — fork carries identical pre-fix code; reclassified from SKIP by review 2026-08-04. |

## 3. Phase 2a — SQL bug fixes (6 commits, MANUAL — copy corrected SQL)

| Commit | Subject | Fork location |
|---|---|---|
| `d15cf98742` | fix: order chapter pages numerically (#1742) | `ChapterQueries.ts`: `CAST(page AS INTEGER)` in `getCustomPages`, `getPrevChapter`, `getNextChapter` |
| `f0693204e1` | fix: improve next chapter selection logic (#1744) | `ChapterQueries.ts:441` `getNextChapter`: correct position-0/page handling + `LIMIT 1`. Port together with `d15cf98` |
| `52d5c99c46` | fix: order EPUB chapters across paginated pages (#1762) | `ChapterQueries.ts:478` `getNovelDownloadedChapters`: `ORDER BY page ASC, position ASC` + range→limit/offset rework |
| `a421177f0c` | fix: improve category badge layout and drag reordering | `CategoriesScreen.tsx:94`: fix index-based `keyExtractor` (breaks drag reorder). Optional: IconButton `onPressIn` drag handle |
| `ee3a4f20bc` | fix: preserve default category after reordering (#1922) | `NovelQueries.ts` (4 sites) + `CategoryQueries.ts:47`: replace `WHERE sort = 1` with `BUILT_IN_CATEGORY_IDS` (default=1, local=2); `updateCategoryOrderQuery` writes positional `sort = index+1`. Fork already hardcodes id 2 for Local. |
| `0cb9da9027` | refactor: replace `withTransactionAsync` with `withExclusiveTransactionAsync` (#1636) | `CategoryQueries.ts`/`NovelQueries.ts`/`StatsQueries.ts` + `helpers.tsx` + `migrateNovel.ts`: swap to `withExclusiveTransactionAsync` + `await` all `runAsync` inside transactions. Fork has the identical unawaited pattern (`NovelQueries.ts:180,321`, `helpers.tsx:133-137`). **Pre-Drizzle** expo-sqlite fix — reclassified from SKIP by review 2026-08-04. |

## 4. Phase 2b — Extended verified fixes (7 commits, MANUAL, localized)

| Commit | Subject | Port strategy |
|---|---|---|
| `c3260e8e01` | fix: resolve chapter download queue and removal issues (#1937) | **Highest priority in this batch.** Fix `deleteReadChaptersFromDb` (pass `chapter.id` not `novelId`), `deleteDownloads` (add `WHERE id IN (...)`), await `db.execAsync`. Skip upstream backgroundTasks/useDownloadReconciliation halves (fork uses ServiceManager + MMKV queue). |
| `eb12bdfd62` | fix: prevent novel genre rendering crashes | Add `parseGenres()` util (split on comma, handle null/empty); apply to `EditInfoModal` + `NovelInfoComponents`. |
| `8f53550d2c` | fix: restore tracker search requests | `TrackSearchDialog.tsx`: reschedule search on open + event-based `onSubmitEditing` handler + `returnKeyType="search"`. |
| `0c3542836c` | fix: synchronize library updates and optimize import refreshes | `NovelTable.ts` triggers (lines 35/48/60): `julianday()` comparison (INSERT trigger is recompute-style in fork, not byte-identical to upstream — julianday change applies to the `lastUpdatedAt` sub-expression of all three triggers); `LibraryQueries` `lastUpdatedAt` sort; ISO-8601 inserted-chapter timestamps. |
| `25c93afabe` | fix(reader): restore saved chapter progress from db (#1850) | `useChapter.ts:125`: `dbChapter = await getDbChapter(chapter.id)` fallback (3 lines). Complements TTS Math.max reconciliation for non-TTS reader open. |
| `7ddd934c2b` | fix: handle missing tracker client IDs | Guard clauses in `src/services/Trackers/aniList.ts` + `myAnimeList.ts` (skip `scripts/generate-env-file.cjs` hunk — fork uses `.env`). |
| `e75f4fba5d` | feat: add more novel statuses and icons (#1931) | `NovelStatus` enum + `getStatusIcon` in `NovelInfoHeader.tsx` (skip `.husky/pre-push` hunk). |

## 5. Implementation order

1. Phase 1 (16 commits) — can be done in ~4 focused edit sessions, grouped by file:
   - Native layer: `34be7a12`, `45c4ea8`, `4088d59` (NativeFile.kt)
   - Services: `57b9d41b` (ServiceManager.ts)
   - Reader/WebView: `54fedc2f` (core.js), `788f6ced` (index.css), `0ed7d878` (ReaderScreen)
   - UI: `76106317`, `31cb4b99`, `a062bee`, `f1fdafd`, `65e86100`
   - Export/MAL: `9e38ad1`, `93bc5e5e`
   - Housekeeping: `2a919ec0`
2. Phase 2a (SQL): `d15cf98`+`f069320` together, then `52d5c99c`, `a421177f`, `ee3a4f20`, `0cb9da90` (transaction concurrency).
3. Phase 2b: `c3260e8e0` first (correctness), then `eb12bdfd6`, `8f53550d`, `0c354283`, `25c93afa`, `7ddd934c`, `e75f4fba`.

Work on a branch: `merge/original-sync-batch-a`.

> ⚠️ **Precondition**: commit/push the current unpushed `dev` work (TTS text-cleanup, per AGENTS.md) BEFORE starting this batch.

## 6. Testing & validation

```bash
pnpm run type-check
pnpm run lint:fix
pnpm run format
pnpm run test                    # 1235+ tests, zero regressions
pnpm run test -- --testPathPattern="ChapterQueries|CategoryQueries|NativeFile|ServiceManager|StatsQueries"
pnpm run test:tts-wake-cycle     # core.js + TTS changes (54fedc2f)
pnpm run test:tts-refill
```

- After `54fedc2f` (core.js): run TTS wake-cycle + refill suites; verify highlighted text output unchanged (length-preserving).
- After `c3260e8e0`: manual test — download 2 novels, delete one novel's read chapters, confirm other novel's download flags + files intact. **Write fork-side unit tests for the two SQL fixes** (upstream's tests are Drizzle-era and not cherry-pickable).
- After `ee3a4f20`: reorder categories, add a novel, confirm it lands in the default category.
- After `0cb9da9027`: run DB query suites (NovelQueries/CategoryQueries/StatsQueries) — transaction semantics unchanged, no SQLITE_BUSY regressions.

## 7. Acceptance criteria

- [ ] All 29 commits ported; no TypeScript/ESLint regressions
- [ ] Download-flag wipe bug eliminated (UPDATE scoped by `id IN`)
- [ ] Read-chapter deletion removes correct folder
- [ ] TTS no longer reads quote characters
- [ ] Deleting a chapter with missing files doesn't crash the app
- [ ] Multi-page chapters navigate in correct numeric order
- [ ] Default category preserved after reorder
- [ ] Full test suite green (1235+ tests, zero regressions) + TTS suites green
- [ ] `pnpm run format` applied (Husky pre-commit)

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| `core.js` divergence (54fedc2f) | Manual 1-line apply at function level; TTS test gates |
| `c3260e8e0` touches DB + download flows | Scoped SQL, manual QA of multi-novel download state |
| `ee3a4f20` changes category resolution semantics | Built-in IDs already partially hardcoded in fork; run CategoryQueries tests |
| Cherry-pick conflicts on fork-modified files | All items in this batch were verified against fork source pre-analysis; apply manually where needed |

## 9. Out of scope

- Batch B features, Batch C theme work, Batch D rewrites
- Upstream's backgroundTasks/useDownloadReconciliation architecture
- Drizzle migration commits (SKIP-DRIZZLE, see manifest)
