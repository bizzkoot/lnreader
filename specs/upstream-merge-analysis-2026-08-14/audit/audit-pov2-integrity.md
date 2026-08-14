All checks complete. Here is the integrity report.

## Integrity Report — POV: Fork-Integrity Cross-Cut (working-tree final state)

### Per-protected-surface verdicts

**1. TTS pipeline — UNTOUCHED ✓**
- `src/utils/htmlParagraphExtractor.ts`: full cleanup pipeline present (`cleanTtsText`, `applyTtsTextCleanup` ×5 overloads, `TTS_CLEANUP_MAX_REGEX_LENGTH=200` at L260, `isPotentiallyCatastrophic` L280, phonetic pairs, `cleanVisibleText` L584). Zero batch fingerprints (grep for `pluginSelectors|getEnabledRepositories|clearUpdates|setRepositoryEnabled|AVAILABLE_PLUGINS|FILTERED_|lastUsedPlugin|reconcileInstalledPluginUpdates` — no matches).
- `src/screens/reader/hooks/useTTSController.ts`: `applyTtsTextCleanup` wired at 8 call sites (L696, 837, 1095, 1365, 1507, 1627, 1871, 3348); `wakeTransitionInProgressRef` intact.
- `src/services/TTSState.ts`: full state machine intact (IDLE→STARTING→PLAYING→REFILLING→PLAYING→STOPPING→IDLE).
- `src/services/tts/novelTtsSettings.ts`: `resolveEffectiveTtsCleanup` intact.
- `src/services/TTSAudioManager.ts`: no fingerprints.
- `WebViewReader.tsx`: customJS injection at L738–742 (`js/index.js` + `pluginCustomJS` + inline `readerSettings.customJS`); script set is the pre-existing fork set (polyfill-onscrollend, icons, van, text-vibe, core, index, pluginCustomJS, customJS — no new tags); `paragraphHighlightOffset` handling at L160-161/405/727/782/786/982 (Ref not in memoizedHTML deps, dynamic sync effect L775-786).
- `android/.../assets/js/core.js` + `index.js`: `window.tts`/`window.reader`, `hasAutoResumed` resume-dialog logic, `tts-offset-badge`, floating TTS controller all intact.
- Kotlin TTS files (TTSForegroundService.kt, TTSHighlightModule.kt): not in any batch diff.

**2. SettingsAdvancedScreen.tsx (DoH) — OK, only intended change ✓**
- Only the clear-updates submit handler changed (L279-294: `onSubmit` now `async`, awaits `clearUpdates()`, try/catch toast). DoH imports L28-33, provider state L43-51, MMKV↔native sync effect L47-51, provider picker modal L341-379, restart dialog L381-388, `handleDoHProviderChange`/`confirmDoHProviderChange` all intact.
- `DoHManagerModule.kt` intact (SharedPreferences persistence L44-65, `setProvider` L74).

**3. Migrations — OK ✓**
- Registry `src/database/migrations/index.ts` = `[002,003,004,005]`.
- `005_add_repository_enabled.ts` matches 003/004 pattern: identical `columnExists` helper (PRAGMA table_info + try/catch), guarded `ALTER TABLE ... ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1`, rate-limited logger, `Migration` type from `../types/migration` (unchanged, sync `migrate`).
- `MigrationRunner` (`src/database/utils/migrationRunner.ts`) untouched — no batch fingerprints.
- `db.ts` bootstrap unchanged; fresh installs get `enabled` via `createRepositoryTableQuery` (now includes column) and 005's guard is a no-op (verified by "converges with fresh-install schema" test); `upgrade-path.integration.test.ts` updated to expect `user_version: 5`.
- Backup restore path (`services/backup/utils.ts` L859-868) reads only `repository.url` from old backups — old backups without `enabled` restore fine (DB default 1).

**4. useSettings.ts — UNTOUCHED ✓** (no batch fingerprints; `ttsTextCleanup`/`DEFAULT_TTS_CLEANUP_SETTINGS` L282/422, `doHProvider` L136/380 intact)

**5. Scaling utils — UNTOUCHED ✓** (`scaling.ts` clampUIScale/scaleDimension/scaleDimensions/getScaledDimensions; `useScaledDimensions.ts`). `useLoadingColors.ts` changed (intentional wholesale port); all 11 consumers destructure `[highlightColor, backgroundColor]` and the new hook returns `[highlight, bg, disableLoadingAnimations]` — 2-of-3 tuple destructure type-checks and behaves identically.

**6. Switch.tsx — backward-compatible ✓** — new props all optional with defaults (`accessible=true`, `accessibilityLabel?`, `containerStyle?`); core props `value/onValueChange/size/style` unchanged. Consumers TtsTextCleanupModal (5×), ReaderTTSTab (5×), AccessibilityTab (1×) call with unchanged props.

**7. ConfirmationDialog — backward-compatible ✓** — `onSubmit` widened `() => void → void | Promise<void>`; all 9 existing callers (SettingsAdvancedScreen ×5, AdvancedTab ×2, PluginListItem ×1) pass sync handlers that still type-check; Button is a react-native-paper wrapper so `loading`/`disabled` props resolve. No TTS dialog uses this component (grep confirms only the 4 files above).

**8. New imports/deps — all resolve ✓** — `EmptyView`/`ErrorScreenV2` in `@components/index`; `getPlugin` exported from pluginManager (L157-179); `PluginItem.imageRequestInit` in plugins/types L72; `createNovelTriggerQueryUpdate` in NovelTable L54; `newer` in compareVersion L37; `useNovelContext().setNovel` (context type = `ReturnType<typeof useNovel>`, exposes `setNovel` L638); `novelSettings/pageIndex/pages` from useNovel L625-631; string keys `libraryScreen.empty` (en L426), `common.retry` (L285), `browse` (L187), `repositories.{disable,disableTitle,disableWarning,toggle}` all present; `package.json`/lockfiles not in any batch diff (no new deps; `lodash-es` still a dependency).

**9. .agents//specs/ — not mixed into code commits ✓** — only the three docs commits (ad242c988/7a944566c/f0e3b4767, no code diff files) touch them; zero code diffs reference `.agents/` or `specs/`.

### Findings

- **NOTE** — `src/hooks/persisted/useNovel.ts` (protected surface) WAS touched by 4c5b45229: import swap `bookmarkChapter → bookmarkChapters` (L12), `bookmarkChapters` callback now calls the bulk toggle (L397-399), `deleteChapters` callback passes ids (L549-552). This is minimal, necessary API alignment for the chunked ChapterQueries changes — no behavioral regression (bulk toggle semantics identical; `markChaptersRead/Unread` callers unchanged; NovelContext.tsx untouched). Strictly "violated", benignly. **Fix if desired**: none — reverting would break `deleteChapters`' new id-based signature; the change is coherent and test-covered.
- **NOTE** — `getLoadingColors` colors changed from primary-tinted alpha to surface/onSurface mix; this is the flagged intentional wholesale port (post-e0c89cdd9) and all consumers are compatible.
- **NOTE** — `Repository.enabled: boolean` (types) vs INTEGER DB column: `db.getAllSync<Repository>` yields 0/1 numbers. Works at runtime (falsy/truthy; Switch value accepts 0/1). Same pre-existing pattern as `Novel.inLibrary`; not introduced by this batch.
- **NOTE** — `selectAllChapters` uses synchronous `getAllSync` (`getPageChapterIds`/`getChaptersByIds`); bounded by page size (500, CHAPTER_ID_BATCH_SIZE), acceptable.
- **LOW** — `clearUpdates` drop/recreate trigger is the flagged intentional deviation; safe under `withExclusiveTransactionAsync` (atomic drop+update+recreate, real-SQLite test asserts trigger survival and re-firing). No action.
- **LOW** — `refreshPlugins()` in `Main.tsx` startup is now awaited internally (async); fire-and-forget call unchanged and safe; `AvailableTab` already awaited `.finally()`.

**No BLOCKERs, no MEDs found.**

## Acceptance Report