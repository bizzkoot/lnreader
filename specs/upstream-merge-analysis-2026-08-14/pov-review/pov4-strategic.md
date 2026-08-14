All strategic load-bearing claims are now verified against the working tree. Here is my POV-4 strategic alignment report.

---

# POV 4 — STRATEGIC ALIGNER: Sequencing + Roadmap Fit (sync c3260e8e0→990cd4f2e, 18 PORT + 1 RED)

**Method**: read all 5 lane reports + `.agents/upstream-merge-memory.md` + `PRD-D-project-scale-features.md`; spot-verified 10 strategic claims in the working tree (see Evidence). No git/shell execution; upstream hunk contents unverified — flagged where it matters.

## Inherited decisions (baseline contract)
- 3 permanent architecture walls (Drizzle/op-sqlite, Nitro/WorkManager, Expo-managed) → selective manual port, never full merge.
- Batch A/B/C ported (1294 tests baseline → 1332 after 004 PR); Batch D pending = D1 time-tracking, D2 in-chapter search, D3 stats overhaul, D4 reader perf sprint, D5 scheduled updates — each its own PR, all touching fork-critical files.
- Raw-SQL layer is a portability advantage; TTS/DoH/MMKV/scaling/migrations are protected surfaces.
- Migration registry = [002, 003, 004]; **005 is free**.
- 8 verified live fork bugs all map to candidate commits (all confirmed in lanes; 7 re-confirmed by my reads: NovelScreen.tsx:277-281 select-all, ChapterQueries.ts:267-268 clearUpdates, useLoadingColors primary-tinted, NovelInfoHeader.tsx:155/161 no headers, useLibrary getLibrary no try/finally, Epub.cpp:391-393 whitelist, Epub.cpp:397 cover no media-type guard, TTSForegroundService audio-focus-only).

## Diagnosis
This sync is overwhelmingly **bug-debt** (16 of 19 candidates fix verified live bugs or translations) — correct priority. Only 3 commits are divergence-reduction plays: **909504a72** (repo schema + pluginManager), **57eca11a9** (history query shape), **64707409b** (custom-code architecture). The fork is 202 commits behind; skipping 64707409b indefinitely lets the custom-code gap compound into its own wall (upstream is now on the v2 page; fork still has the old AdvancedTab).

## (a) Reduces divergence vs throwaway
- **Reduces**: 909504a72 (schema + loader), 57eca11a9 (query shape), 3ad6e372f/3bf025108/f69e5d6a7 (locale files stay near-upstream → less Crowdin diff churn), 64707409b (only if ported).
- **One-time value only (still worth it — verified bugs)**: 63349de1b, 8a12529ba, 1eb8c587c, 15560b67b, 13885320a, epub trio, 7883b28cd, skeleton pair.
- **Throwaway risk**: 3ece098b9 import hunks land in fork-customized files being reworked by Batch D (StatsScreen → D3); e4246dee5 concept-port does not reduce divergence (upstream mechanism = native-file module, permanently unportable).

## (b) Batch D conflict check
- **3ece098b9**: defer **StatsScreen import hunks → D3 stats overhaul** (StatsScreen.tsx gets rewritten; porting now = churn). **CORRECTION to lane2**: the "remove dead lottie deps" slice is **NOT trivially safe** — native splash uses lottie (`MainActivity.kt:53 SplashScreen.show(R.id.lottie)`, `launch_screen.xml` `LottieAnimationView`); lottie-ios/lottie-react-native may be load-bearing for the native build despite zero `src/` imports.
- **67e01bc2d**: correctly SKIP'd; keep as D3 design reference (no change).
- **8a12529ba**: fix should prefer chunked UPDATE in `withExclusiveTransactionAsync` over ServiceManager delegation, to stay clear of D5 scheduled-updates infra.
- **7883b28cd**: native TTSForegroundService.kt only; D1 time-tracking touches useChapter/WebViewReader (JS) — no conflict.
- **63349de1b**: orthogonal to D4 optional NovelScreen items; no conflict.

## (c) Dependency ordering (implementer must respect)
1. **Skeleton pair = ONE unit**: take post-e0c89cdd9 file wholesale (keep `disableLoadingAnimations` interpolation).
2. **Epub trio = ONE unit** (shared/Epub.cpp, one native rebuild): 91358ad3d's whitelist expansion subsumes 3ac611f63's svg-only line — implement as one whitelist change; 197d8670f is a separate guard but same function/file/rebuild. Add fixture EPUBs (svg-in-epub, cover.xhtml).
3. **Translation pass = ONE scripted pass, ordered**: 3bf025108 (full id_ID restore + fork-key re-merge) FIRST → then 3ad6e372f (value corrections) → then f69e5d6a7 (fork-referenced key subset only). Never overwrite whole locale files; protect fork keys (`readerScreen.bottomSheet.tts.*`, `skipVersion`, `chapterChapnum`, `exportEpubModal.*`); regenerate `strings/types`; absorb 909504a72's new repo keys in the same pass.
4. **8a12529ba before 909504a72** (both may touch ConfirmationDialog.tsx): port async-submit hunk first; 909504a72 extends props only if upstream's diff requires, backward-compatibly (TTS toggles use the same Switch/dialog).
5. **909504a72 = standalone last code commit**, claims migration 005; do not let its i18n keys collide with the translation pass.
6. **63349de1b**: verify upstream `useDownload.ts` hunk (chunked enqueue hypothesis); if present port onto `ServiceManager.manager.addTask`, else add a select-all→download batch guard (queue ballooning with thousands of chapters). Do NOT create `useNovel/store/*` or `useChapterSelection.ts`.
7. **13885320a**: keep Batch A tx-discipline (statements on `tx`/`runSync`).
8. **57eca11a9**: map onto HistoryQueries/HistoryCard/HistoryScreen/UpdateNovelCard; do NOT create NovelChapterGroup.tsx.
9. **7883b28cd**: RN layer unchanged (existing `onMediaAction` paths); default policy = `READ_PHONE_STATE` with `maxSdkVersion="31"` + SecurityException guard (avoids runtime-prompt UX on 31+).

## (d) Fork-advantage fit (all DO-NOW items leverage fork architecture)
Raw SQL: 63349de1b (`getNovelChapters` already unlimited), 13885320a, 8a12529ba, 57eca11a9, 909504a72 (2-line UPDATE query). Custom Kotlin: 7883b28cd. Fork-shared native C++: epub trio (shared/Epub.cpp). No candidate requires upstream infrastructure.

---

## DELIVERABLE

### 1) FINAL MERGE SET — DO-NOW (16 commits, 13 units, 3 waves)

**Wave 1 — verified live-bug fixes (7 units, highest value)**
| Commit(s) | Why |
|---|---|
| 63349de1b | Verified bug: select-all only selects loaded batch; `getNovelChapters` already unlimited (raw-SQL win) |
| 8a12529ba | Verified freeze: `clearUpdates` full-table UPDATE on JS thread (ChapterQueries.ts:268); chunked-tx fix, surgical around DoH block |
| 1eb8c587c | Verified bug: `getLibrary` no try/finally → skeleton stuck forever on rejection |
| 15560b67b | Verified bug: cover drops plugin headers; tiny isolated fix |
| 13885320a | Verified bug: categories without library entry → inconsistent state; NovelQueries tx discipline |
| 3ac611f63+91358ad3d+197d8670f (ONE unit) | 3 verified epub bugs; one native rebuild; whitelist + cover media-type guard |
| 7883b28cd | Verified gap: audio-focus-only TTS on calls; fork-Kotlin direct port, RN unchanged |

**Wave 2 — small UX/alignment (2 units)**
| Commit(s) | Why |
|---|---|
| 51560195b+e0c89cdd9 (ONE unit) | Verified primary-tinted skeleton; post-e0c89cdd9 file wholesale |
| 57eca11a9 | Real UX bug (history→novel shows wrong library state); raw-SQL SELECT extension; partial plumbing already exists (`route.params.isLocal`) |

**Wave 3 — feature + translations (4 units)**
| Commit(s) | Why |
|---|---|
| 909504a72 | Only real feature in the set; fully portable to raw SQL; no Batch D overlap; claims migration 005. **Trim-first item if scope needs cutting** |
| 3bf025108 + 3ad6e372f + f69e5d6a7 (ONE pass) | id_ID genuinely degraded (574 vs 638 lines); corrections low-risk; f69e5d6a7 subset by fork-referenced keys only |

### 2) DO-LATER (defer, with trigger)
| Commit | Trigger |
|---|---|
| e4246dee5 (atomic epub export) | Next sync AFTER the just-stabilized export flow (range/options) has baked; verify SAF `content://` rename support first. Hardening only, no divergence reduction |
| 3ece098b9 (apk-size) | Run `git show 3ece098b9` and classify the 12 import hunks; defer all StatsScreen hunks to D3; gradle shrink = separate evaluation (AGP 8.12/Gradle 9.2 + plugin R8 blast radius); lottie removal requires native-splash verification (correction: NOT trivially safe) |
| 64707409b (custom code v2, RED) | **Own PR within next 1–2 syncs** (architecture-gap compounding). Gate: textRemover.js DOM-paragraph-index audit vs fork TTS index contract. Sequence BEFORE D2 (in-chapter search) so both DOM-mutating features land in a known order. useSettings hunks additive-only; ToggleButton rename (collision with `@components/Common/ToggleButton`); WebViewReader wiring via ref, never in `memoizedHTML` deps. Never a cherry-pick |

### 3) DEFER/SKIP (with reason)
- **67e01bc2d** — already SKIP'd; keep as D3 design reference (per task note, unchanged).
- **Lane-SKIPs outside candidate list (confirm no action)**: 179feb56e, 675f19ef9, 23f9b183b, b9d1abcf2, 586e08514, a727c229c (concept → future novel-counters migration), c6679b7f4, 084dcccab, 990cd4f2e, c3482a851, c3b75ebeb, 7f1f76408 — all ALREADY-HAVE/ARCH.
- **Batch D reserved (do NOT fold into this sync)**: D1 time-tracking, D2 search, D3 stats (incl. 3ece098b9 StatsScreen hunks), D4 perf, D5 scheduled updates.

### 4) Dependency/ordering constraints for the implementer
As detailed in section (c): one-unit bundles (epub trio, skeleton pair, translation pass with id_ID-first ordering); 8a12529ba→909504a72 ConfirmationDialog sequence; 909504a72 last-code/standalone claiming migration 005; 13885320a tx discipline; 57eca11a9 file mapping (no NovelChapterGroup); 7883b28cd permission policy default; 63349de1b download-queue guard; no 64707409b hunks this sync.

### 5) Migration-slot coordination (005)
- Registry `[002, 003, 004]` verified; **005 free**.
- **If 909504a72 ports now**: it takes **005** (`ALTER TABLE Repository ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1` + RepositoryTable.ts base column + 004-style column-guard test). Batch D D1 (time tracking, "1 new table") then takes **006**. Update `.agents/upstream-merge-memory.md` registry note so Batch D authors know.
- **If 909504a72 defers**: Batch D D1 may claim 005; 909504a72 uses 006 later. No loss either way — the constraint is *coordinate before authoring* (`MigrationRunner.validateMigrations` throws on duplicates/out-of-order).
- D3 stats overhaul may reuse the a727c229c backfill-combine concept (fresh-install-only, non-versioned).

## Risks (residual)
- Upstream hunk mechanisms unverified (no git tool): exact 8a12529ba fix shape, 57eca11a9 query hunk, 909504a72 pluginSelectors.ts imports, 3ad6e372f/f69e5d6a7 key lists — implementer must `git show` each before porting.
- 8a12529ba is the only DoH-overlap commit (SettingsAdvancedScreen) — surgical edit only; run DoH restart-flow QA.
- 63349de1b: select-all→download queue ballooning if upstream chunking is absent in fork's ServiceManager path.
- 7883b28cd: dangerous permission policy (Play/UX); outgoing-call handling + refill race (`STOPPING` guard exists).
- Epub whitelist: AVIF/BMP may not render in WebView on older APIs — decide whether to include or cap the whitelist.
- Translation merge errors would clobber fork keys — scripted per-key diff mandatory.
- No `useLibrary.ts` at `src/hooks/persisted/` (it's `src/screens/library/hooks/useLibrary.ts` — lane2 correct; task brief path was stale).

## Need from main agent
None blocking. One scope decision to confirm: **909504a72 in this sync (recommended, trim-first)** vs defer — if deferred, Batch D may claim migration 005. No supervisor contact required.

## Suggested execution prompt (worker handoff warranted)
```
On branch from dev, port in 3 waves with full gates between waves (pnpm run type-check && lint:fix && format && test && test:tts-wake-cycle && test:tts-refill):
WAVE1 (bug fixes, one commit each): 63349de1b select-all (use getNovelChapters; check upstream useDownload chunking; test >300 rows) | 8a12529ba clearUpdates (chunked UPDATE in withExclusiveTransactionAsync; surgical around DoH in SettingsAdvancedScreen) | 1eb8c587c useLibrary try/finally (preserve restore-task watcher) | 15560b67b cover headers via AVAILABLE_PLUGINS/imageRequestInit | 13885320a categories→inLibrary=1 (tx/runSync discipline) | epub trio as ONE commit (shared/Epub.cpp whitelist incl. svg/gif/webp/bmp + cover media-type guard; fixture EPUBs; native rebuild) | 7883b28cd PhoneStateListener in TTSForegroundService (READ_PHONE_STATE maxSdkVersion=31, SecurityException guard, unregister onDestroy; RN unchanged).
WAVE2: skeleton colors post-e0c89cdd9 wholesale | 57eca11a9 HistoryQueries SELECT + types + HistoryCard/HistoryScreen/UpdateNovelCard params (no NovelChapterGroup).
WAVE3: 909504a72 as migration 005 + RepositoryTable base column + updateRepositoryEnabled + pluginManager enabled-filter + pluginSelectors.ts (copy if pure) + RepositoryCard Switch (!!coercion) + i18n keys | translation pass LAST: 3bf025108 id_ID restore first, then 3ad6e372f corrections, then f69e5d6a7 fork-referenced subset + 909504a72 repo keys; scripted per-key merge; never overwrite locale files; regenerate strings/types.
Before each port: git show <hash> to extract exact hunks. Do NOT touch WebViewReader except 7883b28cd-adjacent (none), DoH, TTS pipeline, or migrations registry outside 005. Update .agents/upstream-merge-memory.md with migration-005 + sync record.
```

---