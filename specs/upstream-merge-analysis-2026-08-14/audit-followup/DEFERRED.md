# Deferred Audit Follow-up Items — Upstream Sync 2026-08-14

**Created**: 2026-08-15 (post-audit follow-up, commits `d2195bf75`, `a54ddae1c`, `daa0b204d`)
**Policy**: Tracked, deliberately NOT fixed in the sync branch — all items are pre-existing,
low-impact, or high-blast-radius. Revisit in a dedicated pass.

Legend: ⬜ open · ✅ closed · ⏳ blocked

---

## Code items

### 1. ⬜ EPUB nav `epub:type` filter — `shared/Epub.cpp:313`
`parse_nav_xhtml` parses **every** `<nav>` (`toc`, `landmarks`, `page-list`) into the shared
label map; `nav_type` is read but never used, so a later landmark nav can overwrite a TOC
label for a shared href. Impact: chapter-name fallback only (filename heuristic kicks in),
no crash. Fix: only parse the nav whose `epub:type` (prefix-tolerant) is `toc`.

### 2. ⬜ NCX routing heuristic — `shared/Epub.cpp:450-456`
TOC branch keyed on `toc_href.find("ncx")` (filename), not on the matched media-type
(`application/x-dtbncx+xml`). An NCX named `toc.xml` routes to `parse_nav_xhtml` → empty
label map → filename-fallback chapter names. Impact: label loss only.

### 3. ⬜ Hoist `withWriteLock` to module scope — `usePlugins.ts:62`
Write queue is per-`usePlugins` instance (5 independent queues across Main/AvailableTab/
InstalledTab/PluginListItem/SettingsRepositoryScreen). Safe today because every write-lock
block is synchronous/atomic; **any future `await` inside a block** creates a cross-instance
stale-overwrite window for `INSTALLED_PLUGINS`/`AVAILABLE_PLUGINS`. Fix: hoist to a
dep-free module like `src/plugins/mutationQueue.ts`.

### 4. ⬜ Install-fetch timeout — `pluginManager.ts:52-55`
`fetch()` in `installPluginUnlocked` has no timeout. A hung request pins the global plugin
mutation queue, blocking all installs/uninstalls/updates (hang, not deadlock — `finally`
still releases). Fix: `AbortController` timeout.

### 5. ⬜ `useUpdates` generation guard — `useUpdates.ts`
`getUpdates`/`getDetailedUpdates` have no request-id guard: a slow focus-triggered fetch can
resolve after a `deleteChapter().then(getUpdates)` refetch and overwrite
`updatesOverview` with pre-delete rows. `getUpdates` deps also recreate on
`LAST_UPDATE_TIME` change (duplicate focus fetch). Fix: mirror `useLibrary`'s
`loadRequestIdRef` pattern.

### 6. ⬜ Migration 004 edge case — `004_recreate_novel_triggers.ts:40-49` (PRE-EXISTING)
`assertColumnsExist` throws for installs at `user_version ≥ 2` whose Novel table lacks the
counter columns (such installs skip 002). Integration suite does not cover "v2 + v1-era
schema". Fix: add a 002-style idempotent column-guarantee to 004 — **own migration PR** per
Batch D convention (highest blast radius: migration runner).

---

## Test gaps (lower priority — patterns already proven elsewhere)

### 7. ⬜ `useHistory` generation-guard test
Pattern identical to `useLibrary.test.ts` stale-discard test; no dedicated suite.

### 8. ⬜ `NovelScreen.selectAllChapters` component test
DB layer (`getPageChapterIds`/`getChaptersByIds` chunking) is covered; the UI wiring
(filter/page args, `selectionVersionRef` race guard, toast on error) is not.

### 9. ⬜ `LibraryUpdateQueries` direct tests
`chapterNumber` in INSERT + guarded UPDATE, `await downloadFile` cover path — module is
mocked wholesale in `services/updates/__tests__/index.test.ts`.

### 10. ⬜ `RepositoryQueries.normalizeRepository` numeric test
Never exercised with `0`/`1` (tests mock booleans); the `Number(enabled) !== 0`
normalization is hidden by mocks.

---

## Device-level (cannot run in-repo)

### 11. ⏳ EPUB device smoke test
Fixtures + procedure: `specs/upstream-merge-analysis-2026-08-14/audit/epub-device-smoke-test.md`.
Run on next APK build (namespace-prefixed / css-relative-images / percent-encoded /
duplicate-basenames).

---

## Status log

| Date | Action |
|---|---|
| 2026-08-15 | Items 1–11 tracked; none fixed in sync branch by design. |
