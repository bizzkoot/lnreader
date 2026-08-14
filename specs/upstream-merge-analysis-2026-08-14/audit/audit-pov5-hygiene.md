I have completed my review. Let me compile the final audit findings.

## Review — POV 5: Maintainability & Code Hygiene (final-state audit)

### (1) Dead code

**LOW — `getLastUsedPluginId` exported but unused in fork production code**
- Evidence: `src/hooks/persisted/pluginSelectors.ts:4-14` exports `getLastUsedPluginId`; grep across `src/` shows it is imported only by its own test (`__tests__/pluginSelectors.test.ts:6`). This is the documented intentional deviation (fork keeps object-form `LAST_USED_PLUGIN`; upstream's string-id migration not ported). Acceptable, but the file has no comment explaining the purpose of the export, so a future dead-code pass could remove it.
- Fix: add a 1–2 line comment in `pluginSelectors.ts` documenting that it exists for legacy object-form compat / upstream API parity; otherwise leave as-is.

**OK — `FILTERED_*` keys still present and used**
- Evidence: `src/hooks/persisted/usePlugins.ts:25-26` (constants), `:45-47` (`useMMKVObject` consumers). Kept intentionally per `ps-povC-decision.md`. No action.

**OK — `orderBy`/`newer` imports removed cleanly**
- Evidence: `usePlugins.ts` no longer imports `orderBy` (grep shows no `lodash-es` in usePlugins.ts); `newer` moved into `pluginSelectors.ts:2`. Remaining `lodash-es` imports elsewhere are for unrelated functions. Clean.

**LOW — `useLoadingColors` returns an unused third tuple element**
- Evidence: `src/utils/useLoadingColors.ts:37` returns `[...colors, disableLoadingAnimations]`; all 10 callers (CategorySkeletonLoading, UpdatesSkeletonLoading, HistorySkeletonLoading, TrackerLoading, MalLoading, GlobalSearchSkeletonLoading, SourceScreenSkeletonLoading, Skeleton.tsx x2, NovelScreenLoading) destructure only `[highlightColor, backgroundColor]`.
- Fix: drop the third element, or consume it in the callers that already re-read `disableLoadingAnimations` from `useAppSettings` themselves.

### (2) Leftover TODOs / comments / debug code

**NOTE — no new TODO/FIXME/console.log introduced by the batch** (grep across all changed dirs returned nothing). The commented-out `// TODO: fix this` `useEffect` block at `src/screens/novel/NovelScreen.tsx:96-102` predates the batch and is unchanged.

**MED — duplicate skeleton-color implementation now diverges**
- Evidence: `6fb30f26c` updated only `src/utils/useLoadingColors.ts` (new neutralized `surface.mix(foreground)` approach). `src/components/Skeleton/useLoadingColors.tsx:1-21` is a stale copy of the OLD implementation (primary-alpha tint, `lighten/darken`, `interpolateColor` hack) and is still imported by `src/components/Skeleton/Skeleton.tsx:11` (`./useLoadingColors`, used at lines 22 and 276). The batch created two divergent copies of the same utility.
- Fix: point `Skeleton.tsx` at `@utils/useLoadingColors` and delete `components/Skeleton/useLoadingColors.tsx`; if the reader skeleton deliberately keeps the old colors, document the intentional divergence with a comment.

### (3) Consistency

**MED — `inLibrary` route param is dead plumbing with an incorrect default**
- Evidence: `src/navigators/types/index.ts:104` adds `inLibrary?: boolean`; it is passed at `HistoryScreen.tsx:94`, `HistoryCard.tsx:84,101`, `UpdateNovelCard.tsx:118` — but never consumed. `NovelContext.tsx:32-34` always re-derives the novel from the DB (`useNovel(path, pluginId)`); the only "consumer"-adjacent code is `NovelScreenList.tsx:90-97` `routeNovel` fallback (used only before DB load, and `inLibrary` isn't rendered there). Worse, `UpdateNovelCard.tsx:109` hardcodes `inLibrary: false` for the downloaded-chapters variant, which is factually wrong for in-library novels and would mislead any future consumer.
- Fix: either consume the param (seed the context novel's `inLibrary` before the DB load) or drop the param additions; at minimum remove the `false` default and derive it from real data.

**OK — new queries follow fork naming/raw-SQL conventions**
- `getPageChapterIds`/`getChaptersByIds` (`ChapterQueries.ts:446-472`) use the same `getAllSync`/`getAllAsync` + string-SQL style as `getPageChaptersBatched`/`getFirstUnreadChapter`; the `filter` fragment and `page || '1'` defaults mirror `getPageChapters`. `setRepositoryEnabled`/`getEnabledRepositoriesFromDb` (`RepositoryQueries.ts:8-11,27-31`) match the file's arrow-style. `chunkChapterIds` is private + tested. Consistent.

**OK — migration 005 consistency**
- `005_add_repository_enabled.ts` follows the 003/004 `columnExists`/`PRAGMA table_info` guard pattern and the registry is sequential `[002,003,004,005]`. The rethrow-on-failure differs from 003's graceful catch but matches 004's explicit fail-fast philosophy. Note the known-intentional deviation: `clearUpdates` drops/recreates the trigger (`ChapterQueries.ts:305-317`) instead of upstream's chunked update — not re-flagged.

### (4) i18n

**OK — en/strings.json + strings/types/index.ts consistent**
- The 4 new keys (`repositories.disable/disableTitle/disableWarning/toggle`) exist in `strings/languages/en/strings.json:246-250` and `strings/types/index.ts:220-224`; `common.later`/`common.skipVersion` exist in both (`en:294,299`; types `:265,270`). `i18n.enableFallback = true` (`translations.ts:105`) makes missing keys in other locales fall back to English safely.

**LOW — id_ID carries upstream-only orphan keys**
- Evidence: `strings/languages/id_ID/strings.json:815-827` (categories.taxonomy block: `addCategory`, `addChild`, `addNormalization`, `noCategories`, `noNormalization`, `parentNamePlaceholder`, …) exist in no other locale and nowhere in `types/index.ts` (grep-verified). Dead translations imported via the 3bf025108 restore.
- Fix: strip the orphan block from id_ID, or keep it as a documented Crowdin-reconciliation baseline.

**NOTE — `common.later`/`common.skipVersion` English placeholder values in every non-en locale** (e.g., `af_ZA:238-239`, `de_DE:238-239`, `ar_SA:238-239`). Matches upstream; fork genuinely consumes both keys (`components/NewUpdateDialog.tsx:285-287`), so non-English users see English buttons. Worth flagging to Crowdin for translation.

**NOTE — `repositories.*` keys are en-only for now**; other locales fall back. Add to Crowdin.

**NOTE — `strings/types/index.ts` header says "auto-generated"; keys were added by hand** (`03683bd31`). Values match what `pnpm run generate:string-types` would produce, so no drift — but run the generator on the next string change for parity.

### (5) Format / lint

**NOTE — no formatting drift spotted** in spot-checked files (pluginSelectors.ts, usePlugins.ts, RepositoryCard.tsx, Switch.tsx, ConfirmationDialog.tsx, UpdateNovelCard.tsx, migrations). The two-part dep-array fix was run through Prettier (4757b3aee reformats 8c49e6c05's one-liner into a multi-line array). No new obvious lint hazards; the batch does not touch WebViewReader/ChapterDrawer (the 7 pre-existing warnings), and grep found no new `console.*`, unused imports, or `any` leaks in changed files.

### (6) Commit hygiene

**OK — conventional style + upstream refs** — all code commits use `type(scope): subject (upstream #NNNN)`.

**NOTE — 8c49e6c05 ("fix") + 4757b3aee ("style") both edit only the same dependency array** in `UpdateNovelCard.tsx` (6 lines). Could be squashed; harmless.

**NOTE — stale describe title** — `migrations/__tests__/migrationRunner.upgrade-path.integration.test.ts:169` still reads `describe('MigrationRunner upgrade paths → migration004', …)` while all expectations were updated to `user_version: 5`. Rename to `→ migration005`.

**NOTE — duplicate registry comment** — `src/database/migrations/index.ts:3-9` and `:13-19` carry two identical "Registry of all database migrations" blocks. Pre-existing (second block was already there above migration004), worth tidying while the registry is hot.

**OK — no accidental files** — the diff set contains only source, tests, strings, and `shared/Epub.cpp`; no lockfiles, build artifacts, or generated bundles.

### (7) Error handling on new async paths

**MED — `ConfirmationDialog` can leak unhandled rejections and leave the dialog open**
- Evidence: `src/components/ConfirmationDialog/ConfirmationDialog.tsx:56-64` — `handleOnSubmit` is `try { await onSubmit(); onDismiss(); } finally { setIsConfirming(false); }` with no `catch`. Any rejecting `onSubmit` propagates out of the async handler → unhandled promise rejection, dialog never dismissed, `isConfirming` reset with no user feedback. Existing callers that pass rejecting promises: `deleteReadChaptersFromDb` (`SettingsAdvancedScreen.tsx:254`), `deleteCachedNovels` (`:275`), `handleCredentialLogin` (`SettingsTrackerScreen.tsx:392`), `confirmDoHProviderChange` (`SettingsAdvancedScreen.tsx:385`, `await DoHManager.setProvider`). Before this batch the dialog dismissed immediately (fire-and-forget), so failure-path behavior regressed.
- Fix: `try { await onSubmit(); onDismiss(); } catch (error) { rateLimitedLogger... } finally { setIsConfirming(false); }`. (The batch's own new callers — `clearUpdates` and `toggleRepository` — already catch internally, so the fix is only needed for the shared component.)

**LOW — `selectAllChapters` has no error handling and runs sync DB reads**
- Evidence: `src/screens/novel/NovelScreen.tsx:72-86` does `getPageChapterIds` + `getChaptersByIds` (sync `getAllSync`, 1-3 chunked queries) with no try/catch; invoked via `void selectAllChapters()` at `:303` → any DB error is an unhandled rejection. Prior code (`setSelected(chapters)`) could not throw.
- Fix: wrap in try/catch + `showToast` (fork pattern).

**LOW — floating `refreshPlugins()` promises**
- Evidence: `SettingsRepositoryScreen.tsx:64` (`upsertRepository` → `refreshPlugins()` with no catch) and `navigators/Main.tsx:67` (launch, pre-existing). `AvailableTab.tsx:182-184` handles errors properly (`.finally().catch()`). `fetchPlugins` uses `Promise.allSettled`, so rejections are mostly DB-level, but an unhandled rejection remains possible.
- Fix: add `.catch(showToast)` in `upsertRepository`; Main.tsx can stay or get a no-op catch.

**OK — clearUpdates/toggleRepository** — both new callers are wrapped in try/catch + toast (`SettingsAdvancedScreen.tsx:282-289`, `SettingsRepositoryScreen.tsx:72-81`).

### Other observations

**LOW — long-press range-select early-return no longer triggers after select-all**
- Evidence: `src/screens/novel/components/NovelScreenList.tsx:214` `if (selected.length === chapters.length) return;`. After 4c5b45229's select-all selects chapters beyond the loaded batch, `selected.length > chapters.length`, so the guard never early-returns and long-press builds a range on top of an already-full selection.
- Fix: guard against the full page selection (reuse `getPageChapterIds` count or track a "selectAll active" flag).

**NOTE — `useNovel.ts` was modified despite the protected-surface list** (`4c5b45229`, lines ~396-400 bookmarkChapters→ids and ~548-556 deleteChapters→ids). The change is minimal and interface-preserving (public methods still accept `ChapterInfo[]`), and required by the id-based bulk API. Acknowledge/document this thin adaptation rather than treating it as an untouched surface.

**NOTE — no BLOCKERS.** Protected surfaces verified untouched: TTS pipeline, DoH (SettingsAdvancedScreen change is surgical, away from the DoH block), per-novel settings, UI scaling, MigrationRunner core (only registry + new 005 + tests).

### Recommended cleanups (priority order)
1. `ConfirmationDialog.tsx` — catch async `onSubmit` rejections (unhandled-rejection + stuck-dialog regression).
2. Delete or redirect the stale `components/Skeleton/useLoadingColors.tsx` duplicate.
3. Consume or remove the `inLibrary` route-param plumbing; fix `UpdateNovelCard.tsx:109`'s `false` default.
4. Add try/catch + toast to `selectAllChapters`; drop the unused 3rd tuple element in `useLoadingColors`.
5. Add a comment to `pluginSelectors.ts` documenting the intentionally-unused `getLastUsedPluginId`.
6. Strip (or document) the id_ID orphan taxonomy keys; push `common.later`/`skipVersion` + `repositories.*` to Crowdin.
7. Rename the stale `→ migration004` describe block; consider squashing 8c49e6c05+4757b3aee; dedupe the registry comment in `migrations/index.ts`.

---

**Findings summary (severity | file:line | fix):**
- MED | ConfirmationDialog.tsx:56-64 | catch async onSubmit rejections
- MED | components/Skeleton/useLoadingColors.tsx:1-21 vs utils/useLoadingColors.ts | dedupe skeleton-color logic
- MED | navigators/types/index.ts:104 + UpdateNovelCard.tsx:109-118 + NovelContext.tsx:32-34 | consume or drop inLibrary plumbing; fix false default
- LOW | NovelScreen.tsx:72-86,303 | try/catch + toast on selectAllChapters
- LOW | SettingsRepositoryScreen.tsx:64, Main.tsx:67 | catch floating refreshPlugins
- LOW | utils/useLoadingColors.ts:37 | drop unused 3rd tuple element
- LOW | pluginSelectors.ts:4-14 | document intentionally-unused getLastUsedPluginId
- LOW | NovelScreenList.tsx:214 | fix range-select guard after select-all
- LOW | id_ID/strings.json:815-827 | strip orphan taxonomy keys
- LOW/NOTE | all non-en strings.json `common.later`/`skipVersion` | flag for Crowdin
- NOTE | strings/types/index.ts | run generate:string-types on next change
- NOTE | migrationRunner.upgrade-path.integration.test.ts:169 | rename describe → migration005
- NOTE | migrations/index.ts:3-19 | dedupe registry comment
- NOTE | useNovel.ts:396-400,548-556 | document minimal adaptation of protected surface