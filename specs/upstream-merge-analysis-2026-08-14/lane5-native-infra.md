I now have comprehensive evidence for all 12 commits. Let me compile the final analysis.

## Review

### Methodology note

This session had **no shell/exec tool**, so I could not run `git show <hash>` or `git cat-file -e dev:<path>` directly. Evidence was gathered from:
1. The local git metadata (`packed-refs`, reflogs at `.git/logs/HEAD` and `.git/logs/refs/remotes/upstream/master`, confirming upstream/master fetched at `990cd4f2e`, fork dev at `d4fe64c48`).
2. Direct reads of every fork file touched by the lane commits (verified current `dev` state).
3. The prior analysis docs (`specs/upstream-merge-analysis-2026-08/`, `.agents/upstream-merge-memory.md`).

Commit contents were inferred from the task's detailed per-commit descriptions plus fork file reads; exact upstream hunk content should be confirmed with `git show` by the implementer.

---

## 990cd4f2e fix: Upgrade WorkManager for Repeated Library Updates (#1972)
- **Files (upstream)**: `modules/native-background-tasks/android/build.gradle` only.
- **Fork file status**: MISSING — fork has no `modules/` directory at all (verified). Fork's background work runs on `react-native-background-actions@^4.0.1` (package.json:89) + `src/services/ServiceManager.ts` (`BackgroundService.start`, line 114). Its Gradle lives inside `node_modules`, not a fork-maintained module.
- **Portability**: SKIP-ARCH.
- **Safety score**: 95/100 (GREEN) — nothing to port; upstream-only infra.
- **Overlap with fork-custom code**: no.
- **Porting guidance**: None. The WorkManager version bump addresses upstream's own native background-task module. The fork's `react-native-background-actions` dependency version is managed independently (a `pnpm up` decision, unrelated to this commit).
- **Verdict**: SKIP

---

## 3ac611f63 fix: Normalize EPUB SVG Images in Nitro Module (#1622)
- **Files (upstream)**: `modules/nitro-epub` C++ (`EpubChapterNormalizer.cpp` new) + tests.
- **Fork file status**: nitro-epub MISSING. Fork EPUB import = `src/services/epub/import.ts` + `shared/Epub.cpp`/`NativeEpub.cpp` (C++ TurboModule). **Fork bug confirmed**: `shared/Epub.cpp` (`parse_opf_from_folder`, line ~386) collects image paths **only** for `image/jpeg`, `image/png`, `image/jpg`. SVG (`image/svg+xml`) files are never added to `imagePaths`, so `import.ts` never moves them into the novel dir → broken images in imported EPUBs.
- **Portability**: MANUAL (concept port to fork's native C++ path, not a cherry-pick).
- **Safety score**: 55/100 (YELLOW).
- **Overlap with fork-custom code**: `shared/Epub.cpp` is fork-shared native code (adopted upstream #1599 `clean_summary` — fork-modified). No TTS/DoH/settings overlap.
- **Porting guidance**: Two tiers: (a) low-effort: add `image/svg+xml` to the accepted media-types whitelist in `shared/Epub.cpp` so SVG assets are copied to the novel dir (WebView renders SVG in `<img>` natively); (b) high-fidelity: rasterize SVG→PNG like upstream (`EpubChapterNormalizer`), which requires an SVG renderer (e.g., AndroidSVG/`resvg`) — heavy, likely not worth it. Recommend (a) first; verify in `import.ts` that `imagePaths` iteration already handles any extension (it does — it just moves files by basename).
- **Verdict**: PORT-with-care (only the "collect/copy SVG assets" slice)

---

## 197d8670f fix: Resolve EPUB Cover Document Imports (#1948)
- **Files (upstream)**: `modules/nitro-epub` C++ only.
- **Fork file status**: nitro-epub MISSING. **Fork bug confirmed**: `shared/Epub.cpp` lines 374–399 resolve `meta[name=cover]` → `id_to_href[cover_id]` and set `meta_out.cover` **without checking media-type**. If the cover item is an XHTML *document* (common in EPUBs where the cover is a `cover.xhtml` page), the fork sets cover to an `.xhtml` path → broken cover image in the library/novel header after import.
- **Portability**: MANUAL (concept port to `shared/Epub.cpp` cover resolution).
- **Safety score**: 55/100 (YELLOW).
- **Overlap with fork-custom code**: `shared/Epub.cpp` only; no TTS/DoH/settings/migrations.
- **Porting guidance**: In `parse_opf_from_folder`, after resolving `meta_out.cover`, guard the media type: if the manifest entry for `cover_id` is `application/xhtml+xml` (or the extension is `.xhtml`/`.html`), either (a) look up the first image referenced inside that cover document, or (b) walk `imagePaths` for the document's referenced image and use it. Mirrors upstream's "cover is a document" fix. Add a unit test using a fixture EPUB with `cover.xhtml` + `meta[name=cover]`.
- **Verdict**: PORT-with-care

---

## 91358ad3d fix: Support All EPUB Image Formats (#1946)
- **Files (upstream)**: `modules/nitro-epub` C++ only.
- **Fork file status**: nitro-epub MISSING. **Fork limitation confirmed**: `shared/Epub.cpp` whitelists only `image/jpeg|png|jpg`; GIF/WebP/BMP/SVG/AVIF images inside EPUBs are not copied to the novel dir and break on render.
- **Portability**: MANUAL (whitelist expansion in `shared/Epub.cpp`).
- **Safety score**: 60/100 (YELLOW).
- **Overlap with fork-custom code**: `shared/Epub.cpp` only.
- **Porting guidance**: Expand the media-type check in `parse_opf_from_folder` to include `image/gif`, `image/webp`, `image/svg+xml`, `image/bmp`, `image/avif`, `image/tiff`, `image/x-...` (or switch to a `media_type.starts_with("image/")` predicate plus a small denylist). Consider that WebView/Android may not render AVIF/BMP on older API levels; GIF/WebP/SVG are safe. Verify `NativeEpub.ts` spec needs no change (`imagePaths` is already `string[]`).
- **Verdict**: PORT-with-care (small, contained C++ change + import test)

---

## c3482a851 fix: Resolve Nitro EPUB Jest Alias
- **Files (upstream)**: `babel.config.js` + `jest.config.js` — alias for the `nitro-epub` module so Jest resolves it.
- **Fork file status**: HAS both config files (`babel.config.js` with module-resolver aliases; `jest.config.cjs` with `moduleNameMapper` for specs/NativeEpub already at `.*specs/NativeEpub$`). Fork has no `nitro-epub` and no alias problem.
- **Portability**: SKIP.
- **Safety score**: 95/100 (GREEN).
- **Overlap**: none.
- **Porting guidance**: None. Fork's Jest already maps `specs/NativeEpub` to a mock (`jest.config.cjs`).
- **Verdict**: SKIP

---

## e4246dee5 fix: Replace EPUB Exports Atomically With NativeFile (#1954)
- **Files (upstream)**: `modules/native-file` (Kotlin/Swift — SKIP-ARCH for fork), `src/services/epub/export.ts` (fork HAS NO such file — fork export runs through `@cd-z/react-native-epub-creator` EpubBuilder), `ExportEpubModal.tsx`, `ExportNovelAsEpubButton.tsx`, tests.
- **Fork file status**: HAS `ExportEpubModal.tsx`, `ExportNovelAsEpubButton.tsx`, `ExportEpubOptions.ts` (fork-added). No `src/services/epub/export.ts`. Fork export = `EpubBuilder.prepare()` → `addChapter()` → `save()` (builds in `CacheDir/epubCreation`, zips to `CacheDir/output`, then `react-native-saf-x` `copyFile` to destination). Fork recently fixed range export + options staleness (quick-fix batch `ebea3c75a`; `ExportEpubOptions.test.ts` covers payload propagation).
- **Portability**: MANUAL (atomic-write *concept* only).
- **Safety score**: 55/100 (YELLOW).
- **Overlap with fork-custom code**: yes — `ExportNovelAsEpubButton.tsx` (fork-modified in quick-fix batch, consumes `options.*` payload), `ExportEpubOptions.ts` (fork-only). No TTS/DoH overlap.
- **Porting guidance**: The fork's save path writes to cache then copies to the user-selected SAF destination — an interrupted copy can leave a partial EPUB. Atomic concept port: build into a temp file in cache, then `NativeFile.moveFile`/`copyFile` with a `.tmp`→final rename into the destination; on failure, `discardChanges()` + `unlink` the partial. Note SAF `content://` destinations may not support atomic rename — test on both filesystem-picker and SAF paths. Low priority given fork just stabilized this flow (range export + staleness); treat as hardening.
- **Verdict**: PORT-with-care (optional hardening; do not disturb recent range/options work)

---

## c3b75ebeb fix: Migrate Plugin Bundles to Reliable Internal Storage
- **Files (upstream)**: `modules/native-file` (SKIP-ARCH), `src/plugins/pluginManager.ts` (fork HAS, customized), `src/utils/Storages.ts` (fork HAS), tests.
- **Fork file status**: HAS. **Fork already stores plugin bundles in reliable storage**: `Storages.ts` sets `PLUGIN_STORAGE = ROOT_STORAGE + '/Plugins'` where `ROOT_STORAGE = NativeFile.getConstants().ExternalDirectoryPath` (= `getExternalFilesDir(null)`, app-specific persistent storage, not cache — verified `NativeFile.kt` getTypedExportedConstants). `pluginManager.ts` writes bundles to `${PLUGIN_STORAGE}/${plugin.id}/index.js` and reads them back on cold load (`getPlugin`).
- **Portability**: SKIP-ALREADY-HAVE.
- **Safety score**: 85/100 (GREEN).
- **Overlap with fork-custom code**: yes — `pluginManager.ts` is fork-customized (per-plugin sandbox `Function(...)`, storage helpers, UA injection); upstream's diff would not apply. But the *goal* (reliable internal bundle storage) is already met.
- **Porting guidance**: None required. If upstream's migration includes moving bundles from a legacy cache location, the fork has no such legacy location (bundles have always gone to `ExternalDirectoryPath/Plugins`). Confirm fork never used `ExternalCachesDirectoryPath` for plugins (verified: only `import.ts` uses caches for temp EPUB).
- **Verdict**: SKIP (already have)

---

## 7883b28cd fix: Stop TTS During Incoming and Outgoing Phone Calls (#1976)
- **Files (upstream)**: `modules/nitro-tts/android/.../TtsPlaybackStore.kt` only (+116/−8) — registers a `PhoneStateListener` and stops playback on `CALL_STATE_RINGING`/`CALL_STATE_OFFHOOK`.
- **Fork file status**: nitro-tts MISSING. Fork TTS native = `TTSForegroundService.kt` + `TTSHighlightModule.kt`. **Current fork state**: the service *already* has audio-focus handling (`audioFocusChangeListener`: `AUDIOFOCUS_LOSS` → `pauseTTSKeepService()`; `AUDIOFOCUS_LOSS_TRANSIENT` → `onMediaAction(PLAY_PAUSE)`; `AUDIOFOCUS_GAIN` → resume). No `TelephonyManager`/`PhoneStateListener`/`READ_PHONE_STATE` anywhere (grep verified manifest + Kotlin). On most devices an incoming call delivers transient focus loss so the fork pauses; but **outgoing calls, OEM quirks, and the fact the TTS engine (not the app) owns the audio stream** make audio-focus unreliable as the sole mechanism — the same gap upstream fixed.
- **Portability**: MANUAL (concept, fork's own Kotlin).
- **Safety score**: 55/100 (YELLOW) — high value but lands in fork-critical native TTS files.
- **Overlap with fork-custom code**: yes — `TTSForegroundService.kt` is the fork's crown-jewel native file.
- **Porting guidance** (concrete):
  1. **Manifest**: add `<uses-permission android:name="android.permission.READ_PHONE_STATE" />` to `AndroidManifest.xml` (required for `PhoneStateListener` call-state events). Consider `<uses-permission android:name="android.permission.READ_PHONE_STATE" android:maxSdkVersion="31"/>` if avoiding runtime-permission prompts matters; on API 31+ it's still granted only via runtime prompt — decide policy.
  2. **Kotlin**: in `TTSForegroundService.onCreate()`, get `TelephonyManager` and register a `PhoneStateListener` (API ≥ 31: `telephonyManager.registerTelephonyCallback(executor, callback)`; else legacy `listen(listener, LISTEN_CALL_STATE)`). On `CALL_STATE_RINGING`/`CALL_STATE_OFFHOOK`: if TTS is active, call `stopTTS()` (hard stop) — matching upstream's behavior — and notify RN via `ttsListener?.onMediaAction(ACTION_MEDIA_PLAY_PAUSE)` or a new `ACTION_STOP`-style event so the RN state machine syncs.
  3. **RN layer**: `useTTSController.ts` already handles `onMediaAction` → `PLAY_PAUSE` (pause path, saves progress) and `STOP` (resets refs). A native `stopTTS()` + `onMediaAction(PLAY_PAUSE)` flows through the existing handler with **no RN change required**; if you prefer full stop semantics, reuse the existing `TTS_MEDIA_ACTIONS.STOP` branch. Keep the 500ms `MEDIA_ACTION_DEBOUNCE_MS` in mind (it also applies to the call-triggered event — fine, a call is not rapid-fire).
  4. **Edge cases**: unregister the callback in `onDestroy()`; guard against `SecurityException` (permission denied) with try/catch; don't let a call interrupt mid-`speakBatch` refill (state machine `STOPPING` guard already exists).
  5. **Tests**: `TTSAudioManager`/controller tests unaffected (no new JS API); add a native-side check is optional.
- **Verdict**: PORT-with-care (highest value item in this lane)

---

## 7f1f76408 docs: Add AGENTS.md (#1974)
- **Files (upstream)**: `AGENTS.md` only.
- **Fork file status**: HAS its own fork-specific `AGENTS.md` (project context, TTS architecture, batch history). Upstream's is written for upstream's repo/org.
- **Portability**: SKIP (keep fork's).
- **Safety score**: 95/100 (GREEN).
- **Overlap**: none.
- **Porting guidance**: None. Optionally diff for any generally-useful commands, but fork AGENTS.md is already more detailed and fork-accurate.
- **Verdict**: SKIP

---

## 3ad6e372f fix: Correct Translation Strings Across Locales
- **Files (upstream)**: 34 i18n language files, ~311/−/+311 balanced edits (value corrections, no structural change).
- **Fork file status**: HAS all 34 locales + `en` (35 dirs in `strings/languages/`). Fork carries its own added keys (`readerScreen.bottomSheet.tts.*`, `skipVersion`, `chapterChapnum`, `exportEpubModal.*` etc. — verified in `en/strings.json`; `chapterChapnum`/`exportEpubModal` also present in fork id_ID). TTS text-cleanup UI uses hardcoded English strings in `TtsTextCleanupModal.tsx` (no i18n keys) → no conflict there.
- **Portability**: MANUAL (per-key corrections only; balanced edits → low structural risk).
- **Safety score**: 75/100 (GREEN).
- **Overlap with fork-custom code**: yes (translation files are fork-extended, but the commit only edits values, not adds keys — need to confirm per-file).
- **Porting guidance**: For each of the 34 files, copy only the changed *values* for keys that exist in the fork file; never overwrite whole files (would clobber fork-added keys like `readerScreen.bottomSheet.tts.*`, `skipVersion`). A scripted per-key merge (`python`/`jq` diff) is ideal. Validate `pnpm run type-check` + tests after (translations are typed via `strings/types`).
- **Verdict**: PORT (with per-key merge discipline)

---

## f69e5d6a7 chore: Update Translations (#1934)
- **Files (upstream)**: 34 language files, +63 lines each (new keys, e.g. for features upstream shipped that the fork may not have).
- **Fork file status**: HAS all 34 locale files. The new keys likely reference upstream-only features (media session seekbar, background tasks, etc.); keys for fork's own features are in fork's `en` only.
- **Portability**: PARTIAL — port the subset of keys whose consuming code exists in the fork; SKIP keys for upstream-only features.
- **Safety score**: 70/100 (GREEN).
- **Overlap with fork-custom code**: translation files (fork-extended); no TTS/DoH/DB.
- **Porting guidance**: Generate the key list from the upstream diff; for each key, check whether fork `src/` references it (e.g., `getString('...')`). Port only referenced keys across all 34 locales (with en as source of truth in fork). Unreferenced keys are dead weight — skip. Do not wholesale-overwrite files.
- **Verdict**: PORT-with-care (subset)

---

## 3bf025108 fix: Restore Indonesian Translations
- **Files (upstream)**: `id_ID/strings.json` only, 638/638 lines.
- **Fork file status**: HAS `id_ID/strings.json` — **574 lines** (ends line 574), older/mixed quality (many English fallbacks, `"indonesia"` placeholder strings in `aboutScreen`). Fork id_ID already carries fork-ported keys (`chapterChapnum` line 384, `exportEpubModal` line 387).
- **Portability**: MANUAL (full-file copy with fork-key preservation).
- **Safety score**: 70/100 (GREEN).
- **Overlap**: translation file only.
- **Porting guidance**: Copy upstream's restored file, then re-merge fork-specific keys that exist in fork's `en` but are absent in upstream's restored id_ID (e.g., `readerScreen.bottomSheet.tts.*`, `skipVersion` if upstream lacks it — fork `en` has `skipVersion`). Verify key parity against fork `en` with a script; run `type-check`/tests. Given the fork file is visibly degraded, the restore is a genuine user-facing win for Indonesian readers.
- **Verdict**: PORT

---

## Summary table

| hash | title | portability | score | verdict |
|---|---|---|---|---|
| 990cd4f2e | Upgrade WorkManager for Repeated Library Updates | SKIP-ARCH | 95 | SKIP |
| 3ac611f63 | Normalize EPUB SVG Images in Nitro Module | MANUAL (concept → shared/Epub.cpp) | 55 | PORT-with-care |
| 197d8670f | Resolve EPUB Cover Document Imports | MANUAL (concept → shared/Epub.cpp) | 55 | PORT-with-care |
| 91358ad3d | Support All EPUB Image Formats | MANUAL (concept → shared/Epub.cpp) | 60 | PORT-with-care |
| c3482a851 | Resolve Nitro EPUB Jest Alias | SKIP | 95 | SKIP |
| e4246dee5 | Replace EPUB Exports Atomically With NativeFile | MANUAL (atomic concept only) | 55 | PORT-with-care |
| c3b75ebeb | Migrate Plugin Bundles to Reliable Internal Storage | SKIP-ALREADY-HAVE | 85 | SKIP |
| 7883b28cd | Stop TTS During Incoming and Outgoing Phone Calls | MANUAL (concept → TTSForegroundService.kt) | 55 | PORT-with-care |
| 7f1f76408 | Add AGENTS.md | SKIP | 95 | SKIP |
| 3ad6e372f | Correct Translation Strings Across Locales | MANUAL (per-key) | 75 | PORT |
| f69e5d6a7 | Update Translations (#1934) | PARTIAL (subset by key) | 70 | PORT-with-care |
| 3bf025108 | Restore Indonesian Translations | MANUAL (full-file + fork-key merge) | 70 | PORT |

## Key findings
- **3 nitro-epub commits (3ac611f63, 197d8670f, 91358ad3d)** are SKIP-ARCH as code, but the fork's own `shared/Epub.cpp` carries **the same live gaps**: SVG/GIF/WebP not copied (whitelist is jpeg/png/jpg only), and cover resolution ignores media-type (cover document → broken cover). These are genuine low-effort C++ concept ports.
- **7883b28cd** (stop TTS on phone calls) is the highest-value item: the fork relies solely on audio-focus callbacks which are unreliable for TTS (audio owned by the TTS engine process; outgoing calls unhandled). Concrete Kotlin + manifest plan provided; RN layer needs no new API (existing `onMediaAction` paths suffice).
- **c3b75ebeb** is already satisfied — fork `Storages.ts`/`pluginManager.ts` store bundles in app-specific `getExternalFilesDir` storage, not cache.
- **Translation commits** are all GREEN-ish manual/partial ports requiring per-key merge discipline to protect fork-added keys (`readerScreen.bottomSheet.tts.*`, `skipVersion`, `chapterChapnum`, `exportEpubModal.*`). The `id_ID` restore (3bf025108) is a genuine improvement — the fork's current file is visibly degraded (574 vs 638 lines, English placeholders).
- No TTS-pipeline/DoH/settings/migrations/scaling overlap except the deliberately-scoped `TTSForegroundService.kt` phone-call port and fork-modified `ExportNovelAsEpubButton.tsx` (atomic-export hardening only).

## Residual risks
- No shell in this session → exact upstream hunk content not diffed directly; commit contents inferred from task descriptions + fork file state. Implementer must `git show <hash>` each commit before porting to confirm scope (esp. translation key lists and exact PhoneStateListener code).
- The epub C++ concept ports depend on the fork's TurboModule build (`shared/Epub.cpp`/`NativeEpub.cpp` compiled via cmake/gradle) — need a native rebuild + import test fixture EPUBs.
- `READ_PHONE_STATE` is a dangerous permission; runtime-prompt behavior on API 31+ must be decided (or `maxSdkVersion` strategy) to avoid Play/UX concerns.
- SAF `content://` destinations may not support atomic rename for the e4246dee5 hardening — test filesystem vs SAF picker paths.