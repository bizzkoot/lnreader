# Follow-up Audit POV-2: Database & Data Integrity

**Date**: 2026-08-15 · **Range**: f0e3b4767..HEAD (fix commits) · **Reviewer**: fresh-context subagent (read-only)

I have completed a full read of all scoped files, their callers, and their tests. I could not run `git diff` (no shell tool available in this environment), so this review is based on current-file state plus the existing test suite, which the task's acceptance contract allows me to record as `not-run`.

---

# POV-2 — DATABASE & DATA INTEGRITY Review

Scope: 4 fix commits f0e3b4767..HEAD (branch `merge/upstream-sync-2026-08-14`), current-state review.

## 1. ChapterQueries.ts

### 1a. insertChapters changes-based upsert — **OK** (no break)
- INSERT (ChapterQueries.ts:41-50) is **not** `INSERT OR IGNORE`; it is `INSERT ... SELECT ... WHERE NOT EXISTS (SELECT id FROM Chapter WHERE path = ? AND novelId = ?)`. No conflict clause at all.
- `changes` semantics are correct for this shape: a zero-row insert reports `changes === 0`; a real insert reports `changes === 1`. SQLite's `sqlite3_changes()` counts only rows affected by the statement itself — the `AFTER INSERT` aggregate trigger cannot inflate the count — so `result.changes === 0 → UPDATE` (line 54) is a sound discriminator. This also matches `LibraryUpdateQueries` which uses the mirror test `changes > 0` (LibraryUpdateQueries.ts:88).
- The `UNIQUE(path, novelId)` constraint can't fire: inside `withExclusiveTransactionAsync` the WHERE NOT EXISTS pre-check is race-free; duplicate `path` entries within one `chapters` array hit the UPDATE branch with identical values → no-op UPDATE (changes 0), harmless.
- UPDATE branch (ChapterQueries.ts:59-76) uses `IS NOT` null-safe comparisons. Column types make this correct: `releaseTime TEXT` (nullable), `chapterNumber REAL NULL`, `page TEXT` (nullable), `position INTEGER DEFAULT 0`, `name TEXT NOT NULL` (ChapterTable.ts:11-13). `IS NOT` treats `NULL IS NOT NULL` as false and `5 IS NOT NULL` as true, so both the nullable columns and the `?? null` binding (line 70) behave correctly.
- NOTE: the UPDATE branch does not touch `updatedTime`; that's consistent with its purpose (list-fetch), and the `update_novel_stats_on_update` trigger only fires on `isDownloaded/unread/readTime/updatedTime` changes, so no aggregate churn from the change-guarded updates.

### 1b. getPageChapterIds — **OK**
- Async at ChapterQueries.ts:469-477 with `ORDER BY position ASC`.
- Sole production caller NovelScreen.tsx:79 `await getPageChapterIds(...)`; the only other references are tests. Select-all pagination unaffected: query is page-scoped (`WHERE novelId = ? AND page = ?`), no LIMIT, so all rows of the current page are returned regardless of how many lazy batches were loaded; ordering is now deterministic (position order matches display order).

### 1c. getChaptersByIds — **OK**
- Chunks of 500 (`CHAPTER_ID_BATCH_SIZE`) via `Promise.all`, merged into a `Map`, re-emitted by `flatMap` in input order (ChapterQueries.ts:482-495). Missing ids are skipped, input order preserved, duplicates in input yield duplicates in output. Covered by tests (1200 ids → 3 chunk calls, order asserted).

### 1d. getNovelDownloadedChapters range validation — **MED** (UX gap, no data corruption)
- ChapterQueries.ts:626-655. Rejects partial (one bound only), reversed, non-integer, or `< 1` ranges → returns `[]` without querying (guarded by tests).
- **Caller gap**: ExportEpubModal validates `isNaN` (ExportEpubModal.tsx:96-101) but **not** `start <= end`. A user entering a reversed range gets `[]` → generic "no downloaded chapters" toast (ExportNovelAsEpubButton.tsx:128-129) with no explanation. The rejection silently hides data behind a misleading message.
- NOTE: the range is treated as **ordinal position** in the flat `(CAST(page AS INTEGER), position)` sorted downloaded list (LIMIT/OFFSET), not chapter numbers — deliberate per the code comment (ChapterQueries.ts:644-646), but the modal labels read "Start Chapter"/"End Chapter", so ordinal≠number mismatches are possible when some chapters aren't downloaded. Test asserts LIMIT/OFFSET SQL exactly.

### 1e. Bulk mutations — single tx, all `tx.*` — **OK** (zero violations found)
- markChaptersRead (93-103), markChaptersUnread (116-130), deleteChapters (188-202), updateChapterProgressByIds (249-257), bookmarkChapters (269-277), clearUpdates (319-330) — each wraps ALL chunks in one `withExclusiveTransactionAsync` and uses only `tx.execAsync`/`tx.runAsync`.
- `deleteChapters`: files unlinked **outside** the tx (chunked `Promise.all`, lines 192-196), flags cleared **inside** (198-201). Ordering is correct: fail-fast before any DB write leaves no orphaned "isDownloaded=1" after a successful tx. NOTE: if a mid-batch unlink throws, some files are deleted but no flag changes (partial state, DB still claims downloaded) — acceptable fail-fast design, same tradeoff as the old code.

## 2. LibraryUpdateQueries.ts

- (a) updateNovelChapters (55-130): same `WHERE NOT EXISTS` + `changes > 0` insert-detection as insertChapters; UPDATE uses `IS NOT` null-safe comparisons incl. `chapterNumber` (lines 106-117). **Consistent** with insertChapters.
- (b) novelName param: `updateNovel` passes `novel.name` (line 145); `updateNovelPage` passes its `novelName` param (line 176), and its sole caller NovelScreenList.tsx:165 passes `novel.name`. Inside, `novelName` is used **only** in the `DOWNLOAD_CHAPTER` task payload (line 91). Contract correct — no caller passes pluginId.
- (c) cover: `await downloadFile(...)` (line 36) is awaited before the cover path is derived and the metadata UPDATE runs. OK.
- (d) mkdir guard: `if (!NativeFile.exists(novelDir)) { NativeFile.mkdir(novelDir); }` (lines 26-28) — correct, not inverted.
- **LOW**: `updateNovelMetadata` binds `cover || null` (line 46): if the source stops returning a cover URL, a refresh overwrites the stored cached cover with NULL. Pre-existing pattern.
- **LOW**: `ServiceManager.manager.addTask` runs **inside** the tx callback (lines 86-93). If a later chapter in the same loop fails, the tx rolls back the inserts but already-queued download tasks reference rolled-back ids (they fail harmlessly in the worker). Side-effect-in-transaction, pre-existing.

## 3. Migrations 002/003 (db.ts bootstrap)

- (a) db.ts: on fresh install (`user_version === 0`) `createInitialSchema()` builds the **full current schema** (including ttsState, chapterNumber, counter columns, Repository.enabled) and sets `PRAGMA user_version = 2` (db.ts:30-56). The runner then executes only versions `> 2` → 002 **never runs** on fresh installs; 003/005 are column-exists no-ops; 004 drops/recreates triggers (wasteful but harmless). Confirmed by `migrationRunner.upgrade-path.integration.test.ts` ("fresh install v0→2 → version 5").
- v1-era installs (`user_version = 1`) are the real migration-002 path (integration test covers it: 002→003→004→005, backfill on seeded data).
- (b) `columnExists` no longer try/catch (002:13-20, 003:13-20): `PRAGMA table_info(<missing>)` returns an empty result set — it does **not** throw — and `tableExists` is checked first in both migrations. 002 guards Novel (its ALTER target), 003 guards Chapter (its ALTER target). **Correct tables.**
- (c) 002 throws if a column is still missing after the ALTER block (002:62-65). Reachable only if an ALTER silently failed, in which case the old code threw on the ALTER itself anyway — so real-install behavior is unchanged; the throw is strictly more explicit. OK.
- (d) 002 backfill UPDATEs on an empty Novel table are safe (UPDATE matches 0 rows; COUNT subqueries yield 0/MAX(NULL)). OK.
- **MED residual risk (pre-existing, not introduced here)**: 004's `assertColumnsExist` (004:40-49) throws on any install at `user_version ≥ 2` whose Novel table lacks the counter columns — and such installs **skip 002** (runner filters `version > currentVersion`). The integration suite covers v0/v1/v2/v3 and empty-DB, but not "user_version=2 with v1-era (no-counter) schema". If any pre-migration build shipped with `user_version = 2` and the old schema, those installs fail at 004. The empty-DB test comment calls the 004 throw "never reached in prod" — that assumption only holds for truly empty DBs, since `db.ts` always boots a `user_version=0` DB to v2 before migrations.

## 4. RepositoryQueries.ts

- `normalizeRepository` (5-8): `enabled !== false && Number(enabled) !== 0`.
  - false → disabled ✓; 0 → disabled ✓; true → enabled ✓; 1 → enabled ✓; undefined → enabled (`Number(undefined)` = NaN ≠ 0); null → disabled (`Number(null)` = 0); `'abc'` → enabled (NaN ≠ 0).
  - The "NaN bug" is theoretical: the column is `INTEGER NOT NULL DEFAULT 1` (migration005), so DB rows are 0/1 only; backup-JSON junk is normalized to a real boolean via `setRepositoryEnabled` during restore. Acceptable.
- `getEnabledRepositoriesFromDb` `WHERE enabled = 1` (12-14) then normalize — consistent (1 survives both). OK.
- `isRepoUrlDuplicated` excludeId (19-27): optional `AND id != ?` with correct conditional arg spread; sole caller passes `repository?.id` for edit-dedupe (SettingsRepositoryScreen.tsx:64). OK.

## 5. NovelQueries.ts

- `updateNovelCategories` (line ~287-291): `if (!novelIds.length) return;` guard present; empty `categoryIds` handled via the default-category fallback. OK.

## 6. backup/utils.ts

- (a) `repositoryEnabledFromBackup` (41-43): `undefined/true/1/'1'/'true'` → enabled; `false/0/'0'/'false'/null` → disabled. Restore path (874-889): `createRepository` (runSync) → then, only if disabled, `setRepositoryEnabled(lastInsertRowId, false)` — both **synchronous** calls, strictly sequential, so `lastInsertRowId` is available immediately; **no race/ordering hazard**. Old backups without an `enabled` field → `undefined` → keep DB default (1). OK.
- (b) `backupMMKVData` (385-401): chain `getString` → `getBoolean` → `getNumber` preserves `false` (boolean), `0` (number), `''` (string); the `value !== undefined && value !== null` filter keeps `false`/`0`. Asserted by backupSchema.test.ts. Restore writes back typed values (`MMKVStorage.set(key, value)` in restoreMMKVData; typed `'b'/'n'/'s'` branches in `validateAndRestoreMMKVEntries`, incl. boolean `false`). OK.
- **LOW**: the repository restore ordering (create→setEnabled, dedupe skip) has no dedicated unit test (only backupSchema.test.ts exists under `services/backup/__tests__`).

## Direct answers

- **(A) Does the changes-based upsert break any insert/update path?** No. `INSERT ... SELECT ... WHERE NOT EXISTS` yields changes=0 (existing) / changes=1 (inserted); the UPDATE branch fires only on real differences thanks to `IS NOT` null-safe comparison against nullable `releaseTime`/`chapterNumber`. Both `insertChapters` and `updateNovelChapters` agree.
- **(B) Any DB call inside a tx using `db.*` instead of `tx.*`?** None in the scoped files. All 7 ChapterQueries tx callbacks (lines 38, 93, 116, 188, 249, 269, 319), the updateNovelChapters tx, the two NovelQueries txs (restoreLibrary, _restoreNovelAndChapters), `transactionAsync` (helpers.tsx:134), and the migrateNovel tx use `tx.*` exclusively. The only `db.runSync`-inside-`withTransactionSync` cases are db.ts (schema bootstrap) and migrationRunner — synchronous calls inside a synchronous transaction on the same connection, not the batch-A async hazard.
- **(C) Any migration that can now fail on real installs where it previously succeeded?** No new failure introduced by the fix commits. 002's new explicit throw is unreachable on real installs (ALTER would already have thrown); 003's try/catch removal is safe (PRAGMA can't throw; guard order is correct); the tableExists guards only change empty-DB/test behavior. The only migration that can fail on a real install is 004's `assertColumnsExist` for hypothetical `user_version≥2` + no-counter-column installs — **pre-existing** (the guard predates these commits), untested, and a genuine residual risk.

## Findings table

| SEVERITY | CONCERN | evidence | fix |
|---|---|---|---|
| MED | getNovelDownloadedChapters returns `[]` for invalid ranges; Epub modal doesn't validate `start<=end`, so a reversed range yields a misleading "no downloaded chapters" toast (silent data hide) | ChapterQueries.ts:628-637; ExportEpubModal.tsx:96-101; ExportNovelAsEpubButton.tsx:128-129 | validate `start<=end` in modal (reuse `invalidRange` string) before submit |
| MED | 004 can fail on real `user_version≥2` installs lacking counter columns (002 skipped); path untested | 004_recreate_novel_triggers.ts:40-49; migrationRunner.ts:85-100; integration test does not cover "v2 + v1-era schema" | add a 002-style idempotent column-guarantee to 004 or document/support the v2-old-schema path |
| LOW | insertChapters UPDATE branch (changes===0 path) has no direct unit test; db mock always returns changes:1 | ChapterQueries.ts:54-76; all ChapterQueries test mocks return `{changes:1}` | add test where mock returns changes:0 and assert the UPDATE SQL/params |
| LOW | `ServiceManager.manager.addTask` enqueues downloads inside the updateNovelChapters tx (side effect on possible rollback) | LibraryUpdateQueries.ts:86-93 | hoist task enqueue after tx commits (collect insertIds) |
| LOW | updateNovelMetadata `cover \|\| null` wipes a cached cover when source omits cover | LibraryUpdateQueries.ts:46 | preserve old cover when new cover is absent |
| LOW | markChaptersUnread clears MMKV progress before tx; tx failure loses TTS positions without flipping unread | ChapterQueries.ts:120-124 | clear MMKV after successful tx |
| LOW | deleteChapters partial failure: some files deleted, no flags changed (still marked downloaded) | ChapterQueries.ts:192-201 | pre-verify folder existence / aggregate per-chunk errors |
| NOTE | Epub range is ordinal-based, not chapter-number-based; modal labels suggest numbers | ChapterQueries.ts:644-646; ExportEpubModal.tsx:195-210 | document or relabel |
| NOTE | Repository restore ordering and enabled-normalization lack unit tests | utils.ts:874-889; backup tests contain only backupSchema.test.ts | add restoreData repository tests |
| NOTE | no blockers; `db.*`-inside-tx violations: none; changes-based upsert: sound | all files above | — |
