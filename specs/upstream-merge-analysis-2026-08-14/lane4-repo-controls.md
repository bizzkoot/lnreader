I have now completed my fork-side verification. Here is my analysis.

---

# Lane 4 — Commit Analysis: `909504a72` feat: Add Repository Enable And Disable Controls (#1628)

## Methodological caveat (read first)

This subagent has **no shell/git execution tool** (read/grep/find/ls only), so I could not run `git show 909504a72` to inspect the upstream diff directly. All **fork-side facts below are verified** from the working tree (file contents, line numbers cited). Upstream-side claims come from the task brief (file list, +1216/−88, Drizzle files present) plus codebase-structure reasoning. **The parent must run the `git show` commands listed under "Required verification commands"** to confirm exact upstream hunk contents (function names, new i18n keys, Switch/ConfirmationDialog prop changes, `pluginSelectors.ts` imports).

---

## 909504a72 feat: Add Repository Enable And Disable Controls (#1628)

- **Files (upstream)**: 22 files, +1216/−88 — Drizzle `migration.sql` + snapshot, `drizzle/migrations.js`, `src/database/queries/RepositoryQueries.ts`, `src/database/types/index.ts`, `src/hooks/persisted/usePlugins.ts`, `src/hooks/persisted/pluginSelectors.ts` (NEW), `src/plugins/pluginManager.ts`, `src/components/Switch/Switch.tsx`, `src/components/ConfirmationDialog.tsx` (or `/ConfirmationDialog/ConfirmationDialog.tsx`), `src/screens/settings/SettingsRepositoryScreen.tsx`, tests, i18n strings
- **Fork file status + divergence notes** — see per-file table below
- **Portability**: **PARTIAL** — the feature logic is fully portable to the fork's raw-SQL layer; only the 3 Drizzle-infra files are SKIP-ARCH
- **Safety score**: **74/100 (GREEN, YELLOW-adjacent)** — risk LOW/MED, no fork-crown-jewel files touched, but several fork-modified files involved (all localized)
- **Overlap with fork-custom code**: **Yes, moderate** — `usePlugins.ts` (fork added `hasSettings`, Dec 2025 PR #7), `pluginManager.ts` (fork-customized loader/fetch), `Switch.tsx` + `ConfirmationDialog.tsx` (fork-scaled/modernized), `SettingsRepositoryScreen/` directory (fork restructured), i18n JSON format, migrations registry. **No overlap** with TTS pipeline, DoH, `useSettings.ts`, scaling utils, or novel store.
- **Verdict**: **PORT-with-care (PARTIAL file set)**

---

## Per-file classification

| # | Upstream file | Fork status | Portability | Details |
|---|---|---|---|---|
| 1 | `drizzle/<migrations>/<xx>_<name>_migration.sql` + snapshot | MISSING (no `drizzle/` dir in fork) | **SKIP-ARCH** | Drizzle-generated. **Extract the schema change**: add `enabled` column to Repository (upstream name/default TBD — likely `enabled boolean default true`). Port as fork migration 005 + base-table change. |
| 2 | `drizzle/migrations.js` | MISSING | **SKIP-ARCH** | Drizzle migration registry. Never portable. |
| 3 | `src/database/queries/RepositoryQueries.ts` | HAS — raw SQL, 5 fns (`getRepositoriesFromDb`, `isRepoUrlDuplicated`, `createRepository`, `deleteRepositoryById`, `updateRepository`) | **MANUAL** | Upstream version is Drizzle (`db.update(Repository).set({enabled})`). Fork adaptation is 2 lines: `updateRepositoryEnabled(id, enabled)` via `UPDATE Repository SET enabled = ? WHERE id = ?`; optionally `getEnabledRepositoriesFromDb()` with `WHERE enabled = 1`. Logic 100% portable. |
| 4 | `src/database/types/index.ts` | HAS — `Repository = { id, url }` (lines 116–119) | **MANUAL (trivial)** | Add `enabled: boolean` to the interface. |
| 5 | `src/hooks/persisted/pluginSelectors.ts` | **MISSING** (verified: no file) | **NEW — DIRECT-candidate** | Only genuinely new file. If it contains pure selectors over `PluginItem[]`/MMKV (no Drizzle imports), copy as-is. **Verify imports via `git show` before copying.** |
| 6 | `src/hooks/persisted/usePlugins.ts` | HAS — fork-modified (`hasSettings` added in `installPlugin`/`updatePlugin` per 2025-12-14 PR #7) | **MANUAL** | Upstream hunk likely small (repo-enabled awareness in `refreshPlugins`). Port by hand; keep fork's `hasSettings` block intact. |
| 7 | `src/plugins/pluginManager.ts` | HAS — fork-customized (`fetchPlugins` at lines 87–108: `getRepositoriesFromDb()` → `Promise.allSettled` → `uniqBy(reverse(allPlugins), 'id')`) | **MANUAL** | Upstream change = filter repos by `enabled` before fetching manifests. Fork single point of control: filter `allRepositories`. Tiny, localized hunk. |
| 8 | `src/components/Switch/Switch.tsx` | HAS — fork custom (Reanimated `withSpring`/`withTiming`, `useScaledDimensions`, theme `outline`/`primary`) | **SKIP-ALREADY-HAVE (verify prop additions)** | Fork's Switch is already the general-purpose component used by 9+ consumers incl. TTS screens (`ReaderTTSTab.tsx`, `AccessibilityTab.tsx`, `TtsTextCleanupModal.tsx`). Only port if upstream adds new props (e.g. `disabled`) — add **backward-compatibly**. |
| 9 | `src/components/ConfirmationDialog/ConfirmationDialog.tsx` | HAS — fork-modernized (`Button` components, `scaleDimension`, `theme.overlay3`, row-reverse) | **MANUAL (only if upstream adds props)** | If upstream uses it for a disable-repo warning with new props (custom confirm text/destructive style), add those props to fork's version preserving fork styling. |
| 10 | `src/screens/settings/SettingsRepositoryScreen.tsx` | Upstream FLAT; fork has DIRECTORY (`SettingsRepositoryScreen.tsx` + `AddRepositoryModal` + `DeleteRepositoryModal` + `RepositoryCard`) | **MANUAL** | Map enable/disable UI onto fork's `RepositoryCard.tsx` + wire in screen. Keep fork's `route.params?.url` quick-add flow (AvailableTab → `RespositorySettings` `/repo/add` deep link, navigators/types line 85). |
| 11 | tests | HAS — fork's own `RepositoryQueries.test.ts` (401 lines, extensive) + migration tests (003/004, `migrationRunner.upgrade-path.integration.test.ts` w/ better-sqlite3 + `ExpoLikeDb`) | **MANUAL** | Extend existing test files; add `updateRepositoryEnabled` cases + migration 005 test following the 004 pattern. Do not copy upstream test harness (Drizzle mocks). |
| 12 | i18n strings | HAS — fork format `strings/languages/*/strings.json` + `strings/types/index.ts`; only `repositories.emptyMsg` exists (en: line 246–248) | **MANUAL (trivial)** | Add new keys (likely `repositories.enable`/`disable`/warning) to `en/strings.json` + `strings/types/index.ts`; other languages optional (fork is en-centric). Upstream strings live in `src/i18n/` (post-916374b5df) — do not copy wholesale. |

---

## Task questions (a)–(g)

### (a) Fork Repository schema vs upstream addition
**Verified**: `src/database/tables/RepositoryTable.ts` defines `Repository(id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL, UNIQUE(url))`. **No `enabled` column exists** — in the table query, in `db.ts createInitialSchema` (line 53), in any migration (registry = [002, 003, 004]), or in the `Repository` type. Upstream adds an `enabled` column (default true). Fork port requires:
- New migration `src/database/migrations/005_add_repository_enabled.ts` following the established 002/003 pattern (`columnExists` guard via `PRAGMA table_info` + `ALTER TABLE Repository ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1`).
- Update `createRepositoryTableQuery` in `RepositoryTable.ts` to include the column (convergence pattern verified: `ChapterTable.ts:17` already contains `ttsState TEXT` added by migration 003 — fresh installs and migrated installs converge, migration becomes an idempotent no-op via the guard).
- Register `migration005` in `migrations/index.ts`. ⚠️ **Coordinate numbering**: Batch D has pending migrations (time tracking, stats overhaul) — grab `005` now or align with the Batch D branch.

### (b) Query-layer portability to raw SQL
**High.** The upstream Drizzle logic (`db.update(Repository).set({ enabled }).where(eq(Repository.id, id))` / filtered select) maps to:
```ts
export const updateRepositoryEnabled = (id: number, enabled: boolean) =>
  db.runSync('UPDATE Repository SET enabled = ? WHERE id = ?', enabled ? 1 : 0, id);

export const getEnabledRepositoriesFromDb = () =>
  db.getAllSync<Repository>('SELECT * FROM Repository WHERE enabled = 1');
```
**Caveat — boolean coercion**: expo-sqlite returns 0/1 integers; the `Repository` type should declare `enabled: boolean`, and UI code passing it to `Switch value={...}` needs coercion (`!!repo.enabled`). `getRepositoriesFromDb` uses `SELECT *`, so the column appears automatically once the migration runs. Precedent for int↔bool handling exists in fork queries (e.g. `isRepoUrlDuplicated` count pattern).

### (c) Mapping upstream RepositoryCard changes onto fork's RepositoryCard.tsx
Fork's `RepositoryCard.tsx` (verified): card with `IconButtonV2` row (`open-in-new`, `content-copy`, `delete-outline`) + `AddRepositoryModal`/`DeleteRepositoryModal` in a `Portal`; styles memoized via `scaleDimension(uiScale)`; `useAppSettings` for `uiScale`. Port steps:
1. Add an enable `Switch` (from `@components/Switch/Switch`) — recommended as a card sub-row (icon + label + trailing Switch) to preserve the existing scaled card layout; wrap `value={!!repository.enabled}`.
2. On toggle: `updateRepositoryEnabled(repository.id, value)` → `refetchRepositories()` + `refreshPlugins()`.
3. If upstream shows a disable confirmation (when the repo has installed plugins), reuse fork's `ConfirmationDialog` with fork props.
4. Optional dimming of disabled cards (`theme.onSurfaceVariant`) — match upstream visual if the diff shows it.
5. Do **not** copy upstream's inline card JSX — the fork's modal decomposition and scaled styles are the port target.

### (d) usePlugins.ts / pluginManager.ts overlap
**Yes, both are fork-modified.**
- `usePlugins.ts`: fork added `hasSettings: !!_plg.pluginSettings` in `installPlugin` and `updatePlugin` (lines ~108, ~161) per the 2025-12-14 PR #7 merge of upstream `3849b797c`. `refreshPlugins` (lines 52–72) is fork-tweaked. Upstream's #1628 changes here must be hand-merged around these blocks. Low risk — likely just an enabled-repo awareness line in `refreshPlugins`/`fetchPlugins`.
- `pluginManager.ts`: fork's `fetchPlugins` (lines 87–108) is already customized (`Promise.allSettled`, `uniqBy(reverse(...))`, toast per failure, `PLUGIN_STORAGE`/`NativeFile` install path). The upstream change (skip disabled repos) slots into one line: filter `allRepositories` before the fetch loop. **Behavior note**: disabling a repo only stops *discovery/update checks* — installed plugin code is cached on disk and in `INSTALLED_PLUGINS` MMKV, so installed plugins keep working (matches upstream intent; confirm upstream doesn't also uninstall/hide installed plugins from disabled repos in the `usePlugins.ts`/`pluginSelectors.ts` hunks).

### (e) Switch.tsx + ConfirmationDialog.tsx divergence
- **Switch.tsx**: fork version is a full custom Reanimated switch with `useScaledDimensions` — it is the general-purpose switch used across 9+ consumers including **TTS screens** (`ReaderTTSTab.tsx:20`, `AccessibilityTab.tsx:17`, `TtsTextCleanupModal.tsx:13`). It is effectively a superset of what the repo toggle needs (`value`/`onValueChange`/`size`/`style`). Treat as **SKIP-ALREADY-HAVE** unless `git show` reveals new upstream props; if so, add them without changing default behavior (blast radius: all TTS-setting toggles).
- **ConfirmationDialog.tsx**: fork version already modernized (uses fork `Button` row-reverse + `scaleDimension` + `theme.overlay3`; signature `title/message/visible/theme/onSubmit/onDismiss`). Batch C-7 modernized the *Menu* (NativeModal), not this dialog. If upstream extends its props (e.g., custom confirm label / destructive color) for the disable-repo flow, add those props to the fork component preserving its styling; otherwise fork's dialog is directly usable.

### (f) Is pluginSelectors.ts new + portable as-is?
**New — confirmed MISSING in fork** (`find` returned no `pluginSelectors*` under `src/`). Portability is conditional on imports: if it's pure selector logic over `PluginItem[]`/MMKV keys (likely, given it lives under `hooks/persisted`), it copies **as-is (DIRECT)**. If it imports Drizzle/upstream-only modules or upstream's `i18n` path (`@i18n`), it needs small adaptations. **Must verify with `git show 909504a72 -- src/hooks/persisted/pluginSelectors.ts`.**

### (g) Overall verdict
**PARTIAL / PORT-with-care.** Skip: `drizzle/*` (3 files, SKIP-ARCH). Port everything else manually. No full-file cherry-pick will apply cleanly (6 of 9 code files are fork-diverged); treat each as a guided hand-port. Backup flow (`services/backup/utils.ts:576–580` export, `:865` restore) absorbs the new column automatically — export serializes `getRepositoriesFromDb()` rows (will include `enabled`), restore calls `createRepository(url)` and drops the flag (default `1` = enabled — acceptable; optionally extend restore to preserve it later).

---

## Required verification commands (parent must run — I could not)

```bash
git show 909504a72 --stat
git show 909504a72 -- drizzle/ | head -80                      # exact column name + default
git show 909504a72 -- src/database/queries/RepositoryQueries.ts   # exact fn names to port
git show 909504a72 -- src/hooks/persisted/pluginSelectors.ts      # imports / portability check
git show 909504a72 -- src/hooks/persisted/usePlugins.ts src/plugins/pluginManager.ts
git show 909504a72 -- src/components/Switch/Switch.tsx src/components/ConfirmationDialog.tsx
git show 909504a72 -- src/screens/settings/SettingsRepositoryScreen.tsx
git show 909504a72 -- src/database/types/index.ts
git cat-file -e dev:src/hooks/persisted/pluginSelectors.ts; echo $?   # expect non-zero (NEW confirmed)
git log dev --oneline -1 -- src/hooks/persisted/usePlugins.ts          # expect fork-only commits (MANUAL confirmed)
```

---

## Summary table

| hash | title | portability | score | verdict |
|---|---|---|---|---|
| 909504a72 | feat: Add Repository Enable And Disable Controls (#1628) | PARTIAL (port 9/12 code files; SKIP 3 Drizzle-infra files) | 74/100 (GREEN, YELLOW-adjacent) | PORT-with-care |

---

## Findings with severity

- **MED — upstream diff unverified by this subagent**: no git execution tool in this run. All fork facts verified; upstream hunk details (exact function names, i18n keys, Switch/ConfirmationDialog prop additions, `pluginSelectors.ts` imports) must be confirmed with the commands above before porting.
- **MED — migration numbering coordination**: next free slot is `005`; Batch D has pending migrations (time tracking, stats overhaul). Claim `005` now or align with the Batch D branch to avoid a duplicate-version crash (`MigrationRunner.validateMigrations` throws on duplicates).
- **LOW — boolean coercion**: expo-sqlite returns `0/1` integers; `Switch value={!!repo.enabled}` coercion needed in UI.
- **LOW — backup restore drops the flag**: `services/backup/utils.ts:865` re-creates repos without `enabled` (defaults to enabled=1). Acceptable; note as future enhancement.
- **LOW — shared-component blast radius**: if upstream adds `Switch`/`ConfirmationDialog` props, changes touch components used by TTS settings screens (`ReaderTTSTab`, `AccessibilityTab`, `TtsTextCleanupModal`) — keep changes backward-compatible and re-run TTS refill/wake-cycle suites.

---

## Concrete porting plan for the implementer

1. **DB**: create `005_add_repository_enabled.ts` (copy 003's `columnExists` guard pattern) → `ALTER TABLE Repository ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1`; add `enabled INTEGER NOT NULL DEFAULT 1` to `RepositoryTable.ts`; register in `migrations/index.ts`.
2. **Queries/types**: add `updateRepositoryEnabled(id, enabled)` (+ optional `getEnabledRepositoriesFromDb`) to `RepositoryQueries.ts`; add `enabled: boolean` to `Repository` in `types/index.ts`.
3. **pluginManager.ts**: filter `allRepositories` by enabled in `fetchPlugins` (verify upstream's exact filter location).
4. **pluginSelectors.ts**: copy verbatim if pure (verify imports first); otherwise adapt imports.
5. **usePlugins.ts**: hand-merge upstream hunk, preserving fork's `hasSettings` blocks.
6. **UI**: add Switch + optional disable-confirmation to fork's `RepositoryCard.tsx`; wire `updateRepositoryEnabled` + `refetchRepositories` + `refreshPlugins` in `SettingsRepositoryScreen.tsx`; keep `params?.url` quick-add flow.
7. **Switch/ConfirmationDialog**: only if upstream adds props — extend fork components backward-compatibly.
8. **i18n**: add new keys to `strings/languages/en/strings.json` + `strings/types/index.ts`.
9. **Tests**: extend `RepositoryQueries.test.ts` (enable/disable update cases + boolean coercion), add migration-005 test following 004's better-sqlite3 pattern.
10. **Gates**: `pnpm run type-check`, `pnpm run lint:fix`, `pnpm run format`, `pnpm run test`, plus TTS refill + wake-cycle suites (Switch/dialog changes touch TTS-setting UI).