# Scheduled Background Library Updates (PRD 3.4)

Status: Implemented — AppState foreground check, no WorkManager.

## Scope

- Persisted `automaticLibraryUpdateIntervalHours` in `AppSettings` (`0` = off, supported: `12, 24, 48, 72, 168`).
- Dispatch via existing `ServiceManager.addTask({ name: 'UPDATE_LIBRARY' })`; deduplicated against queued `UPDATE_LIBRARY`.
- Due check reuses `LAST_UPDATE_TIME` (`YYYY-MM-DD HH:mm:ss` strict, fallback to generic dayjs parse; invalid → due; future → not due).
- Respects existing DoH (transparent transport); no NetInfo added (repo has no NetInfo dep).

## Execution Model (process-death aware)

No JS interval survives Android process death. Scheduling is **opportunistic**:

- On launch: if `updateLibraryOnLaunch` is off, run `dispatchScheduledLibraryUpdateIfDue()`.
- On every `AppState === 'active'` transition (foreground), re-evaluate due check and dispatch if needed.
- `ServiceManager` already owns queuing, notification, and `UPDATE_LIBRARY` dedup.

This is the smallest integration that works with the current `react-native-background-actions` + `ServiceManager` architecture. A true periodic background job (WorkManager/AlarmManager) is explicitly out of scope per PRD constraints.

## Validation

- Interval validation is strict at the type and runtime boundary (`normalizeLibraryUpdateIntervalHours` → `0` for any unsupported value).
- Dayjs parsing is strict-first then generic fallback; documented in helper.
- Tests: `scheduledLibraryUpdates.test.ts` (validation, due, dispatch/dedup) and `scheduledLibraryUpdates.settings.test.ts` (persistence/default).

## Limitations

- Will not run while app is killed/backgrounded without a foreground transition; user must open the app after the interval elapses.
- No network constraint besides what `updateLibrary` already does; DoH is inherited.
- Per-category scheduling is not supported; dispatch is global library update.

## Files

- `src/services/updates/scheduledLibraryUpdates.ts`
- `src/hooks/persisted/useSettings.ts`
- `src/screens/settings/SettingsGeneralScreen/SettingsGeneralScreen.tsx` + modal
- `src/navigators/Main.tsx`
