# Implementation Context — Reading Time Tracking & Inactivity Detection (PRD 3.2)

## Scope
PRD section 3.2 ports upstream `89c43c1eef` (Time Tracking + Statistics) + `4a4208e336` (toggle + inactivity timeout). PRD mandates raw-SQL via `MigrationRunner`, no Drizzle/op-sqlite/zustand, distinguish manual scroll vs TTS `PLAYING` sessions, smallest safe impl without speculative UI.

Upstream source: `specs/upstream-merge-analysis-2026-08/reference/subagent/group3-report.md` line 30 (HIGH/RED/MANUAL) and `commit_manifest.csv:102` lists touched files: `useSettings.ts`, `WebViewReader.tsx`, `useChapter.ts`, `ReaderScreen.tsx`, `SettingsGeneralScreen.tsx`.

---

## Files Retrieved

1. `PRD.md` (lines 1-210) — authoritative spec; defines Migration 006, `ReadingSession` schema, `useTimeTracking.ts`, `StatsQueries.ts`, AppState listener.
2. `src/database/migrations/index.ts` (full) — registry pattern; sequential versions.
3. `src/database/db.ts` (full) — `createInitialSchema` sets `user_version=2`, `initializeDatabase` runs `MigrationRunner(migrations)`; WAL, foreign_keys ON.
4. `src/database/utils/migrationRunner.ts` (full) — sorts, validates duplicates, `withTransactionSync` per migration, `PRAGMA user_version` bump, throws on failure.
5. `src/database/types/migration.ts` (full) — `Migration` interface `{ version, description?, migrate(db) }`.
6. `src/database/migrations/005_add_repository_enabled.ts` (full) — idempotent `columnExists` guard, `ALTER TABLE`, rateLimitedLogger template.
7. `src/database/tables/ChapterTable.ts` / `NovelTable.ts` — create table + index + trigger queries; FK `Chapter.novelId → Novel.id ON DELETE CASCADE`.
8. `src/database/utils/helpers.tsx` (full) — `getAllAsync`, `getFirstAsync`, `runAsync`, `transactionAsync` wrappers over `db` (expo-sqlite); retry on `database is locked`.
9. `src/database/queries/StatsQueries.ts` (full) — current stats are library counts via `getFirstAsync`/`getAllAsync`; pattern to extend with `SUM(duration)`.
10. `src/database/queries/ChapterQueries.ts` (partial 1-600) — `db.withExclusiveTransactionAsync`, `MMKVStorage.delete` on unread, `updateChapterProgress`.
11. `src/database/queries/HistoryQueries.ts` — shows `db.getAllAsync/runAsync` usage, `datetime('now','localtime')`.
12. `src/screens/reader/hooks/useChapter.ts` (full) — lifecycle: `loadChapterText` (file → `fetchChapter`), `getChapter` (DB + cache + next/prev), `saveProgress` (MMKV `chapter_progress_{id}` + `updateChapterProgress` + `ttsState`), `refreshChaptersFromContext`, `useEffect` for history/autoDownload, `useAutoDownload`. No time tracking yet.
13. `src/screens/reader/hooks/useTTSController.ts` (lines 1-800 of ~1600) — refs: `isTTSReadingRef`, `isTTSPlayingRef`, `isTTSPausedRef`, `ttsStateRef`, `wakeTransitionInProgressRef`, `chapterTransitionTimeRef`; `restoreSavedEngine`, `syncChapterList`, `backgroundTTSPending`, `TTSState` enum (`IDLE→STARTING→PLAYING→REFILLING→STOPPING→IDLE`); hooks decomposed (`useDialogState`, `useTTSUtilities`, `useChapterTransition`, etc.). TTS synergy point per PRD.
14. `src/services/TTSState.ts` (full) — validates transitions.
15. `src/hooks/persisted/useSettings.ts` (full) — `AppSettings`, `ChapterGeneralSettings`, `ChapterReaderSettings`; MMKV keys `APP_SETTINGS`, `CHAPTER_GENERAL_SETTINGS`, `CHAPTER_READER_SETTINGS`; `useChapterGeneralSettings` via `useMMKVObject`. PRD needs toggle `enableReadingTimeTracking` + `inactivityTimeout` (upstream added to `useSettings`, but `chapterGeneralSettings` may be more appropriate for per-reader setting — risk: choose correctly).
16. `src/screens/reader/components/WebViewReader.tsx` (lines 1-900 of 1665) — `memoizedHTML`, `MMKVStorage`, `chapterGeneralSettingsRef`, `readerSettingsRef`, `tts` from `useTTSController`, `handleMessage` (save with `chapterId` validation, TTS gating). Inactivity must hook scroll/position events here + bridge to `useTimeTracking`.
17. `src/services/tts/AutoStopService.ts` (full) — reference AppState+`ScreenStateListener` pattern: `AppState.addEventListener('change')`, `hasNativeSupport` authoritative flag, debounced timers, counters for minutes/paragraphs/chapters, `clearTimerAndCounters` on foreground.
18. `src/hooks/persisted/useTheme.ts` (line 175) — existing `AppState.addEventListener('change')` pattern.
19. `jest.config.cjs` / `__mocks__/expo-sqlite.js` / `src/database/__tests__/testDbAdapter.ts` — test infra: `better-sqlite3` adapter `createExpoLikeDb`, mock fb for unit tests, `MigrationRunner` tested via real sqlite.
20. `src/database/migrations/__tests__/migrationRunner.upgrade-path.integration.test.ts` — upgrade path tests v0→5, paranoia about empty DB `user_version=0` throws at migration 004.
21. `src/database/queries/__tests__/StatsQueries.test.ts` — mock `getAllAsync`/`getFirstAsync`, asserts SQL strings.
22. `src/database/types/index.ts` — `ChapterInfo`, `NovelInfo`, `LibraryStats`.

---

## Key Code

### Migration convention (next version = 6)
```ts
// src/database/types/migration.ts
export interface Migration { version: number; description?: string; migrate: (db: SQLiteDatabase) => void; }

// src/database/migrations/index.ts
export const migrations: Migration[] = [migration002, migration003, migration004, migration005];
```
Existing: 002 counters, 003 ttsState, 004 julianday trigger rewrite, 005 repository.enabled. Version = `PRAGMA user_version` (db.ts sets to 2 on fresh, runner bumps per migrate).

Idempotent pattern from 005:
```ts
const columnExists = (db, table, col) => db.getAllSync(`PRAGMA table_info(${table})`).some(c=>c.name===col);
if (!columnExists(db,'Repository','enabled')) db.runSync(`ALTER TABLE Repository ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1`);
```

PRD proposed schema (needs hardening — see Risks):
```sql
CREATE TABLE IF NOT EXISTS ReadingSession (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  novelId INTEGER NOT NULL,
  chapterId INTEGER NOT NULL,
  startTime INTEGER NOT NULL, -- epoch ms
  duration INTEGER NOT NULL,   -- ms
  FOREIGN KEY (novelId) REFERENCES Novel(id) ON DELETE CASCADE,
  FOREIGN KEY (chapterId) REFERENCES Chapter(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reading_session_novel ON ReadingSession(novelId);
-- Missing per PRD: idx on chapterId, use helpers, nullability, CHECK
```

### Database adapter
```ts
// src/database/utils/helpers.tsx — thin wrappers, retry on locked
export async function getAllAsync<T>(q: QueryObject<T[]>) { return defaultQueryAsync<T,true>('getAllAsync', q, []); }
export async function getFirstAsync<T>(q: QueryObject<T>) { return defaultQueryAsync<T,false>('getFirstAsync', q, null); }
export async function transactionAsync(objs: TransactionObject[]) { await db.withExclusiveTransactionAsync(...) }

// src/database/db.ts — init
db.execSync('PRAGMA foreign_keys = ON');
db.withTransactionSync(()=>{ /* create tables */ db.execSync('PRAGMA user_version = 2'); });
new MigrationRunner(migrations).runMigrations(db);
```

### Reader lifecycle (`useChapter`)
- Entry: `WebViewReader` provides `webViewRef`, `chapter`, `novel`, `html`, `saveProgress`, `refreshChaptersFromContext`, `navigateChapter`, `getChapter`, `savedParagraphIndex` via `ChapterContext`.
- `useChapter` manages `chapterText`, `nextChapter/prevChapter`, `saveProgress(percentage, paragraphIndex?, ttsState?)` → `updateChapterProgress` + `MMKVStorage.set('chapter_progress_{id}')` + `markChapterRead` at 97%.
- History: `insertHistory(chapter.id)` on mount; `checkAutoDownload`.
- Debounced `refreshChaptersFromContext` (2000ms) during TTS saves — avoid tight loop with time tracking flushes.

### TTS controller (`useTTSController`)
- State refs: `isTTSReadingRef`, `isTTSPlayingRef`, `isTTSPausedRef`, `currentParagraphIndexRef`, `latestParagraphIndexRef`, `totalParagraphsRef`, `ttsQueueRef`, `ttsStateRef`, `wakeTransitionInProgressRef`, `wakeResumeGracePeriodRef` (debounce 3000ms), `chapterTransitionTimeRef`, `mediaNavDirectionRef`.
- Events: `onSpeechStart/Done/onWordRange`, `onMediaAction`, `onQueueEmpty`, `onVoiceFallback`; `handleTTSMessage` switch on `speak|stop-speak|tts-state|tts-queue`.
- TTS synergy requirement: time tracking must pause during TTS `PLAYING` with `ttsBackgroundPlayback` vs count manual reading. Minimal hook: observe `isTTSReadingRef`/`isTTSPlayingRef` or subscribe to `TTSAudioManager` events; do not mutate TTS refs.
- `syncChapterList(delayMs=100)` pattern reusable for flushing reading sessions without blocking TTS.

### AppState patterns (existing)
- `AutoStopService.ts`: dual listener (`ScreenStateListener` authoritative Android, `AppState` fallback iOS); `AppState.addEventListener('change', handler)` returns subscription with `.remove()`; track `currentState === 'background'|'inactive'`.
- `useTheme.ts:175`: `AppState.addEventListener('change', state=>...)`.
- `useTTSController` also uses `AppState` for wake handling (`pendingScreenWakeSyncRef`, `wakeTransitionInProgressRef.set(true)` on `AppState active`, pause native TTS).
- New `useTimeTracking` should mirror `AutoStopService` subscription lifecycle: `useEffect` + cleanup, debounce inactivity (PRD unspecified timeout; upstream `4a4208e336` added toggle + timeout — default likely 300s; expose as setting).

### Tests
- Migration: `__tests__/migrationRunner.upgrade-path.integration.test.ts` uses `createExpoLikeDb()` (better-sqlite3) — template for 006 idempotent + FK + index + empty-DB guard.
- Queries: `__tests__/StatsQueries.test.ts` mocks `getAllAsync/getFirstAsync` — extend for `getReadingTime*` aggregates.
- TTS: `useTTSController.integration.test.ts`, `test:tts-wake-cycle`, `test:tts-refill`, `useTTSProgressSync.test.ts` — guard against regressions when wiring time tracking.
- Helpers mock: `__mocks__/expo-sqlite.js` provides `withTransactionSync(cb=>cb())` stub; real upgrade test bypasses it via `testDbAdapter`.

---

## Architecture

```
ReaderScreen → ChapterContext (novel/chapter/saveProgress) → WebViewReader (HTML + WebView bridge + MMKV listeners)
  ├─ useChapter (chapter load, progress, history, next/prev)
  └─ useTTSController (state machine, native events, queue, dialogs, AppState wake)
       ├─ TTSAudioManager / TTSHighlight (native)
       └─ AutoStopService (AppState + ScreenStateListener reference impl)

Proposed:
  useTimeTracking(novelId, chapterId, enabledRef, inactivityMsRef)
       ├─ AppState listener (foreground/background) → pause/resume session
       ├─ Inactivity timer (scroll/touch/tts events reset) → auto-pause
       ├─ Flush on AppState background | chapter change | unmount | inactivity → INSERT ReadingSession
       └─ StatsQueries.getReadingTime* (raw SQL SUM duration GROUP BY novelId/chapterId)

DB: db.ts (user_version) → MigrationRunner → 006_add_reading_time_tracking.ts → ReadingSession table
Settings: useSettings.ts (MMKV) → toggle + timeout (PRD says global toggle; decide AppSettings vs ChapterGeneralSettings)
Reader wiring: WebViewReader injects onScroll/onTouch to reset inactivity; useChapter calls hook; useTTSController exposes isReading flag to skip counting TTS time (or count separately).
```

Data flow for duration:
`useTimeTracking` accumulates `elapsed = now - startTime` while active && not TTS-playing && not inactive → on flush `INSERT INTO ReadingSession (novelId, chapterId, startTime, duration) VALUES (?,?,?,?)` via `transactionAsync` or `db.runAsync`.

---

## Smallest Safe Implementation (no speculative UI)

1. **Migration 006** `src/database/migrations/006_add_reading_time_tracking.ts` — `CREATE TABLE IF NOT EXISTS ReadingSession ...`, `CREATE INDEX IF NOT EXISTS idx_reading_session_novel`, `idx_reading_session_chapter`, idempotent guard via `tableExists` check like 005; version 6.
2. **Settings** add to `ChapterGeneralSettings` (or `AppSettings` — prefer `AppSettings.enableReadingTimeTracking?: boolean` + `readingTimeInactivityTimeout?: number` default 300000 ms, follow upstream toggle location `SettingsGeneralScreen`; but PRD says honor existing MMKV pattern — check upstream commit diff before deciding). Minimal: one boolean `readingTimeTrackingEnabled` default false (opt-in) + number timeout default 0 (never) to match upstream `inactivityTimeoutNever`.
3. **Hook** `src/hooks/persisted/useTimeTracking.ts` (NEW) — `(novelId, chapterId, enabled)` → `AppState.addEventListener`, `setTimeout` inactivity, `useRef` startTime/duration, `flush()` inserts via `db.runAsync`; cleanup on unmount/background. TTS synergy: import `isTTSReadingRef` via prop or poll `MMKVStorage.getString('lastTTSChapterId')` — minimal is to accept `isTTSPlayingRef` as param from caller (WebViewReader) and skip accumulation when true.
4. **Wiring** `src/screens/reader/hooks/useChapter.ts` — instantiate `useTimeTracking(novel.id, chapter.id, enabled)`; reset on `chapter.id` change; expose `flush` on navigation. `src/screens/reader/components/WebViewReader.tsx` — pass `nextChapter/prevChapter` change + `AppState` already covered by hook; add scroll/touch listener bridge (`window.ReactNativeWebView.postMessage({type:'user-interaction'})`) to reset inactivity only if missing.
5. **Queries** `src/database/queries/StatsQueries.ts` — add `getReadingTimeForNovel(novelId)`, `getTotalReadingTime()`, `getReadingTimeByChapter(chapterId)` using raw SQL `SELECT SUM(duration) as total FROM ReadingSession WHERE ...`.
6. **No UI** beyond setting toggle (defer charts to 3.3). Tests: one migration upgrade-path case + one StatsQueries aggregate case + one useTimeTracking flush/pause test using `createExpoLikeDb`.

---

## Start Here
1. `PRD.md` section 3.2 + `src/database/migrations/index.ts` + `005_add_repository_enabled.ts` (migration template)
2. `src/database/db.ts` + `src/database/utils/migrationRunner.ts` (version contract)
3. `src/screens/reader/hooks/useChapter.ts` (wiring point)
4. `src/screens/reader/hooks/useTTSController.ts` lines 1-300 (TTS state refs to isolate manual vs TTS time)
5. `src/services/tts/AutoStopService.ts` (copy AppState + ScreenStateListener pattern for inactivity)

---

## Risks & Constraints

- **Migration version drift**: `db.ts` `createInitialSchema` sets `user_version=2` for fresh installs; runner applies >currentVersion. New migration must be version 6. Empty DB with `user_version=0` currently throws at migration 004 guard — new migration must remain idempotent (`IF NOT EXISTS`) and not assume tables exist beyond migration 002/003.
- **FK enforcement**: PRD schema uses FK to `Novel(id)`/`Chapter(id)` ON DELETE CASCADE — requires `PRAGMA foreign_keys=ON` (already set in `initializeDatabase`). Verify cascade deletes in migration test; otherwise orphan rows.
- **TTS vs manual accounting**: PRD says "distinguish between manual reading scrolling and automated TTS playback". If counting while TTS `PLAYING`, duration inflates (TTS already has `ttsState`). Minimal safe: pause tracking when `isTTSReadingRef.current === true` (or at least when `ttsBackgroundPlayback` batch active). Need decision on whether TTS time counts separately.
- **AppState race**: Existing TTS wake handler already juggles `AppState active` + `wakeTransitionInProgressRef`. Additional listener must not call `TTSHighlight.pause/stop`; only `isScreenOff` check via `AppState.currentState`. Duplicate subscriptions leak if not cleaned up on `chapterId` change.
- **Inactivity timeout undefined**: PRD table says `inactivityTimeout` but spec lists no default. Upstream `4a4208e336` added `inactivityTimeoutNever` string. Choose sentinel `0 = never` vs `null`; document.
- **Performance**: Flushing every paragraph progress (like TTS debounced 2000ms) could hammer DB. Debounce session inserts to ≥2000ms or batch via `withExclusiveTransactionAsync`. Use `transactionAsync` pattern, not per-ms inserts.
- **Testing gaps**: `__mocks__/expo-sqlite.js` stubs `withTransactionSync` as passthrough — migration idempotency must be tested via `testDbAdapter` real sqlite, not mocked runner.
- **Settings location ambiguity**: Upstream added to `useSettings` → `SettingsGeneralScreen` but fork's `ChapterGeneralSettings` holds TTS toggles. Placing toggle in wrong MMKV key causes desync. Verify upstream diff: `src/screens/settings/SettingsGeneralScreen/SettingsGeneralScreen.tsx` line.
- **Existing trigger interference**: `update_novel_stats_on_update` fires AFTER UPDATE OF `isDownloaded, unread, readTime, updatedTime` — ReadingSession inserts don't touch it, safe. But `insertHistory` uses `datetime('now','localtime')` vs PRD `INTEGER` epoch ms — keep consistent; store `INTEGER` ms for duration aggregation to avoid string date math.
- **No existing ReadingSession queries**: Stats screen currently only library counts — new aggregates must use `getAllAsync`/`getFirstAsync` raw SQL, not Drizzle.

---

## Focused Validation Commands

```bash
pnpm run type-check
pnpm run lint:fix
pnpm run test -- --testPathPattern="migrationRunner.upgrade-path.integration"
pnpm run test -- --testPathPattern="StatsQueries"
pnpm run test:tts-wake-cycle
pnpm run test:tts-refill
pnpm run test -- --testPathPattern="useChapter"
```

---

## Supervisor coordination
No blocking decisions; proceed with implementation per PRD. If toggle location or TTS-time counting policy is ambiguous, escalate via `need_decision`.
