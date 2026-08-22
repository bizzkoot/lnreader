# Behavioral Correctness Audit — POV3 (16-commit batch, branch merge/upstream-sync-2026-08-14)

## Per-Hunk Verdicts

| # | Hunk | Verdict |
|---|------|---------|
| 1 | ChapterQueries.ts (clearUpdates, chunked bulk ops, select-all) | behavior OK |
| 2 | useLibrary.ts + LibraryScreen skeleton gate | behavior OK |
| 3 | usePlugins.ts + pluginSelectors | behavior OK |
| 4 | NovelScreen.tsx selectAllChapters | behavior OK |
| 5 | shared/Epub.cpp cover logic | behavior OK (2 LOW divergence notes) |
| 6 | NovelInfoHeader coverSource | behavior OK |
| 7 | SettingsRepositoryScreen toggleRepository | behavior OK |
| 8 | NovelQueries updateNovelCategories inLibrary | behavior OK |
| 9 | Translation merge (id_ID + emptyChapterMessage) | **REGRESSION (MED)** — `%{reportUrl}` unbound in 31 locales |

---

## Findings

### MED-1 — REGRESSION: `readerScreen.emptyChapterMessage` now renders a literal `[missing "%{reportUrl}" value]` in 31 non-English locales
- **Evidence**: `strings/languages/{af_ZA,ar_SA,as_IN,ca_ES,cs_CZ,da_DK,de_DE,el_GR,es_ES,fi_FI,fr_FR,he_IL,hi_IN,hu_HU,id_ID,it_IT,ja_JP,ko_KR,nl_NL,no_NO,or_IN,pl_PL,pt_BR,pt_PT,ro_RO,ru_RU,sq_AL,sr_SP,sv_SE,tr_TR,uk_UA,vi_VN,zh_CN,zh_TW}/strings.json` — e.g. `id_ID/strings.json:673`, `fr_FR/strings.json:492`: `"emptyChapterMessage": "...<a href='%{reportUrl}'>report the plugin issue</a>...%{pluginId}<br>%{novelName}<br>%{chapterName}"` (new upstream format from ba2e07c63).
- **Evidence**: `src/screens/reader/utils/sanitizeChapterText.ts:41-45` calls `getString('readerScreen.emptyChapterMessage', { pluginId, novelName, chapterName })` — **no `reportUrl`** is passed (grep for `reportUrl` in `src/` = 0 matches).
- **Evidence**: `node_modules/i18n-js/dist/import/helpers/interpolate.js` — a placeholder not present in options calls `i18n.missingPlaceholder`, which defaults (I18n.js:25) to `` `[missing "${placeholder}" value]` ``.
- **Impact**: For every non-English locale, an empty-chapter failure renders the literal token in the message and produces a dead `href='[missing "%{reportUrl}" value]'` link. `en/strings.json:585` kept the old hardcoded-GitHub-URL format, so English is unaffected — the merge applied the new upstream string to non-en locales but never ported the `reportUrl` supply side (upstream builds `reportUrl` in its reader).
- **Fix**: Either pass a `reportUrl` value from `sanitizeChapterText.ts` (e.g. the GitHub issue URL), or revert `emptyChapterMessage` in all non-en files to the pre-batch format (`<a href='https://github.com/LNReader/lnreader-sources/issues/new/choose'>GitHub</a>`).

### LOW-1 — Epub cover/image whitelist narrower than upstream
- **Evidence**: `shared/Epub.cpp:348-356` `isSupportedImageMediaType()` whitelists 7 types; upstream 91358ad3d/#1948 uses `media_type.rfind("image/", 0) == 0`.
- **Impact**: `image/avif` / `image/heic` manifests are excluded from `imagePaths` **and** from cover resolution (branch at line 466-470 fails; the fallback cover-document branch at 483-485 then tries to XML-parse a binary AVIF → `load_file` fails → `meta_out.cover` stays empty). Divergence from upstream, not a regression vs the fork's previous jpeg/png/jpg-only state.
- **Fix**: switch to the upstream prefix test.

### LOW-2 — Epub `findImageReference`: `#fragment`-only reference short-circuits sibling attributes
- **Evidence**: `shared/Epub.cpp:374-377` — for `href="#sprite"`, the full string is non-empty, so it returns the empty stripped string without trying `src`/`href` on the same node; first-match-wins recursion can also pick a header logo before the cover `<img>` in a wrapper document.
- **Fix**: only return when the stripped reference is non-empty; optionally prefer the largest `<img>`.

### NOTE-1 — NovelScreen select-all version guard is dead (all-synchronous path)
- **Evidence**: `screens/novel/NovelScreen.tsx:76-84` — `getPageChapterIds`/`getChaptersByIds` are `getAllSync`; there is no `await` between `++selectionVersionRef.current` and the check, so the guard can never trip. Harmless. Filter is respected (`novelSettings.filter` is the pre-existing raw-SQL fragment `' AND \`unread\`=1'` style, valid when appended), order of selection is DB-id order (irrelevant: UI uses `selectedIdSet` + count).

### NOTE-2 — `filterAvailablePlugins` sort change for non-ASCII names
- **Evidence**: `hooks/persisted/pluginSelectors.ts:52-53` `localeCompare` vs old lodash `orderBy('name')` (code-unit `<`/`>`). Locale-aware collation reorders accented names (e.g. `Água` now before `Zebra`). Improvement, but ordering differs from before; `Array.prototype.sort` is stable so same-name order is preserved.

### NOTE-3 — `getPlugin` sync init inside render-path `useMemo`
- **Evidence**: `screens/novel/components/Info/NovelInfoHeader.tsx:149-154` — `getPlugin(novel.pluginId)` may synchronously read + evaluate a plugin file during render when the plugin cache is cold. Idempotent (cached in `pluginManager.ts:162-171`); `undefined`/missing headers handled via optional chaining and `novel.cover ?? undefined` (CoverImage reads `source.uri`, safe). Acceptable but a render-phase side effect.

### NOTE-4 — id_ID translation merge: extras are inert; fork keys intact
- **Evidence**: `strings/languages/id_ID/strings.json` top-level sections = en + 3 extras: `errorBoundary` (:383), `time` (:773), `genreStats` (:791); grep for `getString('(errorBoundary|time|genreStats` in `src/` = 0 matches → inert. `skipVersion` (:337), `chapterChapnum` (:532), `exportEpubModal` (:535), `readerScreen.bottomSheet.*` (:625-660) intact. File imports cleanly in `strings/translations.ts` (i18n-js). **NOTE**: id_ID lacks `readerScreen.bottomSheet.tts.*` (referenced by `useTTSController.ts:2923-2978`) — **pre-existing** (absent before the batch too); `enableFallback=true` + `defaultLocale='en'` covers it.

### NOTE-5 — `updateNovelCategories` lacks the upstream `if (!novelIds.length) return;` guard
- **Evidence**: `database/queries/NovelQueries.ts:280-300` — `UPDATE Novel SET inLibrary = 1 WHERE id IN ()` would be a syntax error on empty `novelIds`. Pre-existing failure mode (the DELETE below has the same `IN ()` shape), so not a new regression; only reachable if a caller passes `[]` (SetCategoriesModal always passes non-empty). Recommend adding upstream's guard.

### NOTE-6 — Protected-surface policy: `useNovel.ts` touched (benign)
- `hooks/persisted/useNovel.ts:397-410, 546-560` — only the `bookmarkChapters`/`deleteChapters` plumbing was changed (bulk id mapping); per-novel settings/TTS logic untouched. `NovelContext.tsx` itself is untouched. Flagging for policy awareness only; no behavioral risk found.

---

## Confirmed-OK details (key evidence)

- **clearUpdates** (`ChapterQueries.ts:304-315`): recreate uses the exact exported `createNovelTriggerQueryUpdate` constant — identical DDL to bootstrap (`db.ts:55`) and migration 004 (`004_recreate_novel_triggers.ts:91`); `DROP IF EXISTS` + `CREATE IF NOT EXISTS` is safe even if the trigger never existed; expo-sqlite supports DDL inside `withExclusiveTransactionAsync`; real-SQLite test covers drop/recreate/fire. Bulk `lastUpdatedAt=NULL` matches upstream #1955 and is equivalent to the previous per-row trigger outcome.
- **Chunking** (`ChapterQueries.ts:17-26, 87-112, 170-185, 233-261`): 500/batch below any SQLite variable/length limit; empty arrays no-op; `deleteChapters` id-signature callers all updated (`useNovel.ts:399,549-553`; tests).
- **useLibrary** (`screens/library/hooks/useLibrary.ts:70-98`): request-id guard prevents stale writes; `hasErrorRef` guarantees an error→retry cycle re-shows the skeleton; search flow still sets `isLoading`; `useFocusEffect(useCallback)` stable; LibraryScreen gate mirrors upstream (EmptyView effectively unreachable since Default/Local categories are seeded in bootstrap).
- **usePlugins** (`usePlugins.ts:69-101`): reference-identity guard correctly skips writes when nothing changed; `lastUsedPlugin` findIndex block only fires when the entry actually changed; `clearUnavailableUpdates: repository.enabled` is correct (true only when disabling); `fetchPlugins` reads enabled repos via `getEnabledRepositoriesFromDb()` after the synchronous `setRepositoryEnabled` (runSync), so the disable is visible before refresh; all three `refreshPlugins` callers handle the promise (Main fire-and-forget = old behavior; AvailableTab `.finally().catch`; toggleRepository await+try/catch).
- **NovelInfoHeader / Epub / RepositoryScreen / ConfirmationDialog async**: header `headers: undefined` path safe; `RepositoryCard` prop type `() => void | Promise<void>` matches the async `toggleRepository`; all 10 ConfirmationDialog callers resolve (DoH confirm awaits `setProvider` then the restart timer fires after dismissal — no hang).

## Residual Risks

- The MED emptyChapterMessage regression ships to all non-English locales until fixed; verify with a manual render or a unit test on `sanitizeChapterText` with `fr` locale.
- Epub cover-document path has no fork C++ test harness (upstream has `EpubParserTest.cpp`, fork build does not) — the new `findCoverImagePath`/`property_cover_id` logic is verified by inspection only.
- Could not execute the test suite (read-only audit); batch claims 1235 passing.