All verification complete. I have read the 5 lane reports, the memory bank, and spot-verified every claimed fork-custom overlap directly from the fork working tree (dev @ d4fe64c48). Compiling the fork-integrity audit.

---

# POV-1: Fork-Integrity Guardian — Risk Audit of 19 Merge Candidates

**Evidence base**: lane1–lane5 reports + direct verification of 20+ fork files. Every overlap claim below was re-checked against the actual fork source, not just lane prose.

## Verified crown-jewel touchpoints (evidence)

| Fork-custom asset | Verification |
|---|---|
| WebViewReader.tsx (TTS crown jewel) | `customJS` inline injected at line 741 inside `memoizedHTML` (line 636), script chain 733–739 (`core.js`, `index.js`, `pluginCustomJS`), WebView consumes `html: memoizedHTML` at 1556 |
| TTSForegroundService.kt | Audio-focus listener (167–182, 827–880) present; **zero** PhoneStateListener/TelephonyManager/READ_PHONE_STATE anywhere in the Kotlin dir — 7883b28cd gap confirmed |
| SettingsAdvancedScreen.tsx | DoH block confirmed: `DoHManager` imports (29–33), provider state (44–51), handler (141–172), picker modal (336+), restart dialog (376+) |
| useSettings.ts (MMKV schema) | `uiScale` (64), `doHProvider` (136), `ttsTextCleanup` (282), `ChapterReaderSettings.customJS` (290+), uiScale clamp (451–461) |
| MigrationRunner registry | `migrations/index.ts` = [002, 003, 004] only; next free slot **005** |
| RepositoryTable.ts | `CREATE TABLE IF NOT EXISTS Repository (id, url, UNIQUE(url))` — **no `enabled` column** |
| shared/Epub.cpp | Whitelist only `image/jpeg|png|jpg` (391–392); cover resolve ignores media-type (397–398) — both live bugs confirmed |
| ChapterQueries.ts:267 | `clearUpdates` = `db.execAsync('UPDATE Chapter SET updatedTime = NULL')` — full-table JS-thread freeze confirmed |
| NovelScreen.tsx:277–280 | select-all → `setSelected(chapters)` (loaded batch only) — #1960 bug confirmed |
| useLibrary.ts:67–78 | `setIsLoading(true)` then `Promise.all` with no try/catch/finally — stuck-skeleton bug confirmed |
| useLoadingColors.ts:7–16 | Still `theme.primary` alpha(0.08) tint — #1964/e0c89cdd9 not applied |
| NovelInfoHeader.tsx:155,161 | `source={{ uri: novel.cover }}` — no plugin headers forwarded |
| usePlugins.ts / pluginManager.ts | Fork `hasSettings` blocks (118, 170); `fetchPlugins` (138–143) iterates all repos — 909504a72 filter point |
| Switch.tsx consumers | ReaderTTSTab (5×), TtsTextCleanupModal (6×) — any Switch prop change ripples into TTS UI |
| ExportNovelAsEpubButton.tsx | Uses `@cd-z/react-native-epub-creator` EpubBuilder + `options` payload (quick-fix ebea3c75a); no `src/services/epub/export.ts` |
| core.js:1295,1348 | `applyVisibleCleanup` — conceptual overlap with 64707409b's `textRemover.js` |
| HistoryQueries.ts:9–18 | SELECT lacks `Novel.isLocal`/`inLibrary` — 57eca11a9 gap confirmed |

## Risk-ranked table

| commit | fork-custom files at risk | risk | what breaks | mitigation | verdict |
|---|---|---|---|---|---|
| **63349de1b** (#1960) | NovelScreen.tsx (Portal/LegendList/useNovelContext), useDownload.ts (ServiceManager MMKV queue) | LOW | select-all only selects loaded 300-batch (live bug); over-queueing thousands of download tasks | Use existing `getNovelChapters(novel.id)` (no limit); if porting chunked enqueue keep ServiceManager task format; do NOT create upstream `useNovel/store/*` | **SAFE** |
| **13885320a** (#1945) | NovelQueries.ts (Batch-A tx discipline), NovelScreenButtonGroup.tsx | LOW | tx-safety regression (statements leaving `tx` object — the exact bug fixed in fa5e10b76) | Batch new `UPDATE Novel SET inLibrary=1` into existing `queries[]`, execute via `runSync`; don't double-insert default category | **SAFE** |
| **15560b67b** (#1977) | NovelInfoHeader.tsx + CoverImage/NovelThumbnail | LOW | cover requests lack plugin auth headers (live bug); components currently accept `uri` only | Add `headers` pass-through to both image components; keep uiScale scaling; data source exists (`pluginManager` imageRequestInit) | **SAFE** |
| **51560195b + e0c89cdd9** (#1964) | useLoadingColors.ts | NONE/LOW | visual only; primary-tinted skeleton still live | Take post-e0c89cdd9 values wholesale; **preserve** the `luminosity()===0 → negate().darken(0.98)` guard (11–14) and `disableLoadingAnimations` interpolation | **SAFE** |
| **3ad6e372f** (translations) | 34 locale files | LOW | fork-added keys (`readerScreen.bottomSheet.tts.*`, `skipVersion`, `chapterChapnum`, `exportEpubModal.*`) clobbered by file overwrite | Scripted per-key merge; balanced edits → low structural risk | **SAFE** |
| **3bf025108** (id_ID) | id_ID/strings.json (574 vs 638 lines, degraded) | LOW | fork id_ID keys (`chapterChapnum`:384, `exportEpubModal`:387) lost | Full-file copy + re-merge fork keys; TTS cleanup UI uses hardcoded EN (no conflict) | **SAFE** |
| **8a12529ba** (#1955) | SettingsAdvancedScreen.tsx (**DoH block**), ConfirmationDialog.tsx (C-7 styled), ChapterQueries.ts:267 | **MED** | DoH picker/restart flow broken by careless hunk; shared-dialog async change affects all confirm dialogs; full-table UPDATE freeze | Touch ONLY the clear-updates submit handler in SettingsAdvancedScreen; `loading`/`await onSubmit` props backward-compat on dialog (keep scaleDimension); chunked UPDATE inside `withExclusiveTransactionAsync` on `tx` | **SURGICAL** |
| **57eca11a9** (library-status) | HistoryQueries.ts, database/types, HistoryScreen/HistoryCard, UpdateNovelCard.tsx, navigators/types | LOW | none critical; `isLocal` already half-plumbed (navigators/types:103, NovelScreen:330) | Additive SELECT columns + route params; map UpdateNovelChapterGroup hunk onto fork's UpdateNovelCard | **SAFE** |
| **1eb8c587c** | useLibrary.ts (restore-task watcher 33–117), LibraryScreen.tsx (ServiceManager menu, Actionbar, EPUB import) | LOW-MED | skeleton stuck on rejection (live bug); refactor risk to MMKV restore-task watcher | try/catch/finally in `getLibrary`; preserve `restoreTasksCount` watcher + focus refetch | **SAFE** |
| **3ece098b9** (#1969) | package.json (Expo 54 pins), android/app/build.gradle (AGP 8.12/Gradle 9.2), useChapter.ts, LibraryScreen.tsx, BottomNavigator.tsx, ChapterDrawer/index, NovelList | **MED** | R8/minify breaks plugin `Function`-eval sandbox or TTS native; lottie removal if `react-native-lottie-splash-screen` still uses it; 12 import hunks land in fork-modified files | Only: (a) remove `lottie-react-native`/`lottie-ios` (zero `src/` imports — verify splash-screen first), (b) per-file import hunks; gradle shrinking = separate eval + release smoke test | **SURGICAL** |
| **909504a72** (#1628, migration 005) | MigrationRunner registry, RepositoryTable.ts (no `enabled`), RepositoryQueries.ts, pluginManager.ts:140, usePlugins.ts (hasSettings), **Switch.tsx** (TTS UI), ConfirmationDialog, SettingsRepositoryScreen/ | LOW-MED | migration version collision with Batch D (runner throws on duplicate); disabling repo nukes installed plugins if filter wrong; Switch prop changes ripple into ReaderTTSTab/TtsTextCleanupModal | Claim **005** now with `columnExists` guard (003 pattern); filter only *discovery* (installed plugins live in MMKV `INSTALLED_PLUGINS`); Switch props strictly backward-compat; verify `pluginSelectors.ts` imports before copying | **SURGICAL** |
| **7883b28cd** (#1976, READ_PHONE_STATE) | TTSForegroundService.kt (**crown jewel**), AndroidManifest.xml | **MED-HIGH** | TTS native regression (audio-focus + foreground + refill) or dangerous-permission UX fallout | PhoneStateListener in `onCreate` (API31+ `registerTelephonyCallback`), unregister in `onDestroy`, `SecurityException` guard, `maxSdkVersion=31` to skip runtime prompt; RN layer unchanged (existing `onMediaAction` paths); **must** re-run wake-cycle + refill suites | **SURGICAL** (user decision on permission) |
| **3ac611f63** (#1622) | shared/Epub.cpp (391–392), import.ts | LOW | SVG images lost on import (live bug) | Add `image/svg+xml` to whitelist (tier-a only; skip rasterizer); native rebuild + fixture test | **SAFE** |
| **91358ad3d** (#1946) | shared/Epub.cpp | LOW | GIF/WebP/BMP/AVIF lost on import (live bug) | Expand whitelist or `media_type.starts_with("image/")` + denylist; note AVIF/BMP render caveat on old API levels; `NativeEpub.ts` unchanged (`imagePaths` is `string[]`) | **SAFE** |
| **197d8670f** (#1948) | shared/Epub.cpp (374–399) | LOW-MED | cover.xhtml document → broken cover (live bug) | Guard media-type after cover resolve; walk first image referenced by cover doc; native rebuild + fixture | **SAFE** (care in logic) |
| **e4246dee5** (#1954) | ExportNovelAsEpubButton.tsx (quick-fix ebea3c75a), ExportEpubOptions.ts | LOW-MED | breaks just-stabilized range/options export flow; SAF `content://` may not support atomic rename | Defer as hardening; temp-file build + `copyFile` + `discardChanges`/unlink on failure; test filesystem vs SAF picker paths | **SURGICAL** (defer-able) |
| **f69e5d6a7** (#1934) | 34 locale files | LOW | dead/upstream-only keys (media-seekbar, background tasks) added; fork keys preserved | Port subset of keys actually referenced by fork `getString()` | **SAFE** |
| **64707409b** (#1902) | WebViewReader.tsx (crown jewel: script chain 733–741, message allowlist, memoizedHTML deps), useSettings.ts (extended schema), SettingsReaderScreen/AdvancedTab (fork layout), core.js `applyVisibleCleanup` overlap, **ToggleButton name collision** (@components/Common/ToggleButton used by ReaderTextAlignSelector/ReaderThemeSelector), App.tsx (TTS notification setup), package.json (+3 deps incl native keyboard-controller), assets path (`android/app/src/main/assets/js` ≠ upstream `assets/reader/js`) | **HIGH** | textRemover.js DOM removal can desync `core.js` paragraph counting/highlight (TTS index contract — RN extracts paragraphs from the *string*, WebView counts from the *DOM*); upstream 334-line WebViewReader hunk will corrupt MMKV-listener/wake-cycle; ToggleButton collision; native dep build break (Expo 54/Gradle 9.2) | **Never cherry-pick.** Port pieces independently: `customCode.ts` (verify pure TS+MMKV), i18n, routes, new screens (fork components + scaleDimension + webviewSecurity helpers) — GREEN/YELLOW; gate textRemover.js on a paragraph-node audit; WebViewReader wiring as a separate minimal diff (config via ref, NOT memoizedHTML deps — fork fixed this exact bug for `paragraphHighlightOffset`); rename ToggleButton; verify deps before `pnpm install` | **AVOID** (wholesale); SURGICAL per-piece only, gated |

## No-go list (do NOT port as-is)

1. **64707409b (#1902) wholesale** — the only commit that lands directly in the fork's TTS crown jewel (WebViewReader script wiring + message allowlist + memoizedHTML) *and* the extended MMKV schema *and* removes the fork's working AdvancedTab *and* adds an unverified native dep. Any single slip desyncs the RN↔WebView paragraph-index contract or the TTS wake cycle. Only piecemeal, individually-gated ports are acceptable.
2. **3ece098b9 (#1969) gradle-shrink slice** — R8/minify against the fork's plugin `Function`-eval sandbox and TTS native modules is a release-build-sized blast radius with no equivalent upstream file (`plugins/android/android-build-types.gradle` doesn't exist). The lottie dead-dep removal alone is safe.
3. **(Conditional) 7883b28cd** — not a code no-go but a *permission* no-go until a decision is made on `READ_PHONE_STATE` (dangerous permission; runtime-prompt behavior on API 31+ vs `maxSdkVersion=31`). Port only after that policy is set.

## Cross-cutting integrity findings

- **Zero** of the 19 candidates touch `htmlParagraphExtractor.ts`, `useTTSController.ts`, `useTTSUtilities.ts`, `TTSState.ts`, `novelTtsSettings.ts`, `TTSAudioManager.ts`, `DoHManagerModule.kt`, or the scaling utils themselves — the core TTS/DoH/scaling stack is not in the blast radius.
- Exactly **one** candidate touches SettingsAdvancedScreen.tsx (8a12529ba) and exactly **one** touches useSettings.ts (64707409b, additive-keys-only rule). Both must be surgical.
- Exactly **one** new migration is needed (909504a72 → 005). **Claim 005 now** to avoid a duplicate-version crash with Batch D's pending migrations (`MigrationRunner.validateMigrations` throws on duplicates).
- Shared-component caution: `Switch`/`ConfirmationDialog` changes (909504a72, 8a12529ba) ripple into TTS settings UI (ReaderTTSTab, TtsTextCleanupModal, AccessibilityTab) — backward-compatible props only, then re-run TTS refill/wake-cycle suites.
- The two-skeleton-color commits (51560195b + e0c89cdd9) are one port; take post-e0c89cdd9 file content.
- The three Epub commits are all concept-ports onto fork's own `shared/Epub.cpp` (no nitro module) — each needs a native rebuild + fixture-EPUB test.

## Residual risks

- **No git/shell tool in this session** — upstream hunk contents were not diffed directly; implementer must `git show <hash>` each commit before porting (translation key lists, exact Switch/ConfirmationDialog prop additions, the 3 deps of 64707409b, exact clearUpdates mechanism of 8a12529ba).
- `shared/Epub.cpp` changes require cmake/gradle native rebuild; behavior on AVIF/BMP for older API levels unverified.
- SAF `content://` atomicity for the e4246dee5 hardening is unverified (filesystem vs SAF picker paths).
- textRemover.js (if 64707409b pieces proceed) needs a DOM-audit against `core.js` paragraph counting before any WebViewReader wiring.