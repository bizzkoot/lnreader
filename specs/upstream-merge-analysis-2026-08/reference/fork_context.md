# Fork Architecture Context (for merge-value analysis)

## Fork (branch `dev`, HEAD 40c6676797 v2.1.3, 2026-08-03)
- React Native 0.82.1, React 19.1.1, Expo SDK 54 (bare workflow w/ custom Kotlin native modules)
- **TTS (fork's crown jewel, heavily customized)**:
  - WebViewReader.tsx (controller), useTTSController.ts (state machine), TTSAudioManager.ts, TTSState.ts, ttsBridge.ts
  - Native: TTSHighlightModule.kt, TTSForegroundService.kt (custom Kotlin, NOT Nitro)
  - Features: background playback, per-paragraph highlight, sleep timer, smart rewind, text cleanup pipeline (htmlParagraphExtractor.ts), per-novel TTS overrides, 5-button media notification (ttsNotification.ts), chapter list live progress sync
- **Database**: expo-sqlite `SQLite.openDatabaseSync` + raw SQL table files (src/database/tables/*) + custom MigrationRunner (src/database/utils/migrationRunner.ts) + migrations/ — NOT Drizzle
- **Settings**: MMKV via src/hooks/persisted/useSettings.ts (AppSettings interface, ChapterGeneralSettings/ChapterReaderSettings)
- **Reader UI**: WebView (core.js at android/app/src/main/assets/js/core.js), ReaderBottomSheetV2 → ReaderTTSTab.tsx (custom)
- **UI lib**: react-native-paper 5.14.5
- **Plugins**: src/plugins/pluginManager.ts dynamic loading, plugin types in src/plugins/types/
- **Build**: Gradle 9.2.0, Java 17, pnpm; scripts dev:start / dev:android

## Upstream (`original` = upstream/master, c3260e8e01, 2026-08-01)
- Migrated to **Expo managed workflow** (#1885), Expo 55, rock CLI (#1812)
- **Database**: **Drizzle ORM + op-sqlite** (#1735) — completely different layer (src/database/schema, manager/)
- **TTS**: **Nitro-powered playback** (#1896), Android **MediaSession** controls (#1711) — different native stack
- **Background tasks**: native Android scheduling (#1889, replaced react-native-background-actions)
- Repository reorganized (916374b5df)

## Fork-critical files (heavily rewritten in fork — upstream changes here are RED risk)
- src/screens/reader/components/WebViewReader.tsx
- src/screens/reader/hooks/useTTSController.ts, useTTSUtilities.ts
- src/services/TTSAudioManager.ts, TTSState.ts, ttsBridge.ts, ttsNotification.ts
- src/hooks/persisted/useSettings.ts
- src/database/* (db.ts, tables/, queries/, utils/migrationRunner.ts)
- src/screens/reader/components/ReaderBottomSheet/ (fork: ReaderTTSTab.tsx; upstream file structure differs)
- android/app/src/main/assets/js/core.js, index.js
- android/app/src/main/java/com/rajarsheechatterjee/LNReader/*.kt
- android/app/build.gradle, package.json

## Prior analysis (memory bank 2025-12-30)
Full merge infeasible (100+ conflicts). RECOMMENDED: selective cherry-pick / manual port of beneficial upstream features.

## Assessment rules
For each commit classify:
- VALUE: HIGH (clear user benefit, missing in fork) / MEDIUM (nice-to-have) / LOW / NONE (chore/docs/infra) / ALREADY-HAVE (fork has own equivalent e.g. DoH, media notification, volume buttons, text cleanup, migration recovery)
- RISK if cherry-picked directly: GREEN (new files or files fork didn't touch) / YELLOW (some overlap, localized, portable) / RED (touches fork-critical files or depends on Drizzle/Nitro/Expo55/rock infrastructure)
- Portability: DIRECT (cherry-pick clean) / MANUAL (needs adaptation to fork architecture) / NOT-FEASIBLE (depends on upstream-only infra)
- One-line rationale each.

Use `git show <hash> --stat` / `git show <hash>` (read-only) when you need diff details.
Output as a markdown report with a table per commit + group summary (top valuable, notable risks).
