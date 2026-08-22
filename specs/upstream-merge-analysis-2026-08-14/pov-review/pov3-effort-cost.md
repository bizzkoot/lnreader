All evidence gathered. Compiling the effort-cost matrix now.

---

# POV: EFFORT-COST ESTIMATOR — 2026-08-14 Upstream Sync (19 commits)

**Baseline for estimates**: fork at dev `d4fe64c48`; gates baseline **80 suites / 1304 tests**, TTS wake-cycle 7/7 + refill simulator; test infra = Jest + better-sqlite3/ExpoLikeDb + `MigrationRunner.upgrade-path` pattern; native rebuild = TurboModule cmake/gradle for `shared/Epub.cpp`, gradle for `TTSForegroundService.kt`. All lane facts cross-checked against working tree (NovelScreen.tsx:280, ChapterQueries.ts:267, useLoadingColors.ts, Epub.cpp:391, migration registry [002-004], package.json, App.tsx:16 + MainActivity.kt:53 lottie splash).

## (1) Effort table

**GREEN (7 commits) — engineering cost low, all JS:**

| commit | JS/native | est files + tests | migration/dep risk | value | est effort |
|---|---|---|---|---|---|
| 63349de1b select-all-across-batches (#1960) | JS | 1-2 files (NovelScreen.tsx:280 one-liner; optional useDownload chunking) + 1 test | none | **H** (verified live bug) | **Quick** ~0.25d |
| 13885320a add-to-library-on-categories (#1945) | JS | 2 files (NovelQueries.updateNovelCategories + NovelScreenButtonGroup) + 1 test | none (keep Batch-A `tx`/runSync discipline) | **H** (inconsistent-state bug) | **Quick** ~0.25d |
| 15560b67b imageRequestInit-headers-to-cover (#1977) | JS | 1 file (NovelInfoHeader.tsx; data source already in pluginManager.ts:59-73) + 0-1 test | none | **M-H** (verified; header-gated covers) | **Quick** ~0.15d |
| 51560195b+e0c89cdd9 skeleton-colors (#1964) | JS | 1 file (useLoadingColors.ts; take post-e0c89cdd9 values, keep disableLoadingAnimations block) + 0-1 test | none | **L-M** (visual) | **Quick** ~0.15d |
| 3ad6e372f translation-corrections | JS | 34 i18n JSON (value-only per-key merge; **never whole-file** — protect fork keys `readerScreen.bottomSheet.tts.*`, `skipVersion`, `chapterChapnum`, `exportEpubModal.*`) + 0 tests (type-check) | none | M (quality) | **Quick-Med** ~0.3-0.5d (scripted merge) |
| 3bf025108 indonesian-restore | JS | 1 file (id_ID/strings.json, 574→638 lines) + fork-key re-merge script + type-check | none | **M-H** (file visibly degraded, en placeholders) | **Quick** ~0.3d |
| (SKIP-confirmed lane items: 179feb56e, 675f19ef9, 23f9b183b, b9d1abcf2, 586e08514, a727c229c, c6679b7f4, 084dcccab, 67e01bc2d, 990cd4f2e, c3482a851, c3b75ebeb, 7f1f76408 = 0 cost) | — | — | — | — | — |

**YELLOW (11 commits) — engineering cost medium+, risk cost varies:**

| commit | JS/native | est files + tests | migration/dep risk | value | est effort |
|---|---|---|---|---|---|
| 8a12529ba update-clear-freeze (#1955) | JS | 3 fork-diverged files (ConfirmationDialog C-7-custom, ChapterQueries.ts:267 chunked-update, SettingsAdvancedScreen **DoH block — surgical**) + 1-2 tests | none (fork has background-actions option) | **H** (verified freeze bug) | **Medium** ~0.75d |
| 1eb8c587c library-loading-state | JS | 2 files (useLibrary.getLibrary try/catch/finally + LibraryScreen skeleton gate) + 1 test | none | **H** (verified stuck-skeleton) | **Quick-Med** ~0.5d |
| 57eca11a9 library-status-nav | JS | 4-5 files (HistoryQueries SELECT, types, HistoryCard/HistoryScreen, UpdateNovelCard) + 1 test; route already accepts `isLocal` | none | **M** (local/not-in-library consistency) | **Medium** ~0.75d |
| 909504a72 repo-enable-disable (#1628) | JS + migration | 8-10 files (migration 005, RepositoryTable, RepositoryQueries, types, pluginManager filter, pluginSelectors.ts new, usePlugins hand-merge, RepositoryCard UI, Switch/ConfirmationDialog only-if-new-props) + 2 tests (query + 005) | **migration slot 005 — claim now or coordinate w/ Batch D** (validator throws on dup); backup restore drops flag (acceptable) | **M** (feature parity) | **Medium-Heavy** ~1d |
| 7883b28cd tts-stop-on-phone-calls (#1976) | **NATIVE** Kotlin (TTSForegroundService.kt) + AndroidManifest | 2 files + 0 new JS tests (existing `onMediaAction` path suffices) + **native rebuild** + wake-cycle/refill re-run | **READ_PHONE_STATE dangerous permission** — policy decision (`maxSdkVersion=31` vs runtime prompt) | **H** (real gap: outgoing calls/OEM quirks unhandled by audio-focus alone) | **Medium** ~0.5-0.75d code + rebuild |
| 3ac611f63 epub-svg (#1622) | **NATIVE C++** | 1 file (shared/Epub.cpp:391 whitelist +`image/svg+xml`; skip the heavy SVG-rasterize tier) + 1 import-fixture test | native rebuild cycle | **H** (verified lost images) | **Quick code** ~0.25d + rebuild |
| 91358ad3d epub-image-formats (#1946) | **NATIVE C++** | 1 file (same whitelist — **merge with 3ac611f63 in one C++ diff**: add gif/webp/svg/bmp, keep denylist for unrenderable) + 1 test | native rebuild cycle | **H** (verified) | **Quick code** (combined w/ above) |
| 197d8670f epub-cover-doc (#1948) | **NATIVE C++** | 1 file (shared/Epub.cpp cover resolution — real logic: media-type guard + resolve image inside cover doc, not a line edit) + 1 fixture (cover.xhtml) | native rebuild cycle | **M-H** (verified broken covers) | **Medium** ~0.75d + rebuild |
| e4246dee5 atomic-epub-export (#1954) | JS (export path: EpubBuilder + saf-x copy) | 1-2 files + 1 test | SAF `content://` may not support atomic rename — must test both picker paths | L-M (hardening only; fork just stabilized export) | **Med-Heavy ~1d — DEFER** |
| f69e5d6a7 translations-update (#1934) | JS | 34 JSON — **subset by keys referenced in fork src/**; skip upstream-only feature keys (dead weight) + 0 tests | none | L-M | **Quick-Med** ~0.3d |
| 3ece098b9 apk-size (#1969) | JS + **gradle build config** | ~14 files (app.json SKIP, gradle shrink concept → android/app/build.gradle, 12 import hunks in fork-modified files, package.json) + release-build validation | R8/proguard on plugins = high blast radius; **lottie "dead weight" claim WRONG** — `react-native-lottie-splash-screen` (App.tsx:16, MainActivity.kt:53) depends on lottie-react-native/lottie-ios; removal couples to a splash-screen swap | L (APK size only, uncertain) | **Heavy >1d — TRAP-adjacent** |

**RED (1 commit):**

| commit | JS/native | est files + tests | migration/dep risk | value | est effort |
|---|---|---|---|---|---|
| 64707409b custom-code-settings-page-v2 (#1902) | JS-heavy (47 files +5415/-895) + **1-3 new deps** | 7 dissectable file-groups (customCode.ts, additive useSettings keys, 7 new SettingsCustomCodeScreen files, components w/ **ToggleButton name collision** vs fork's Common/ToggleButton, routes, i18n, textRemover.js asset) + WebViewReader surgical wiring (script tag + config ref + message allowlist — keep OUT of memoizedHTML deps) + 5-8 tests | **react-native-keyboard-controller = NATIVE** — RN 0.82/Expo 54 bare compat risk (new arch autolink + rebuild + jest mock); react-syntax-highlighter pure-JS OK; 3rd dep unverified | M (feature parity) | **Heavy 2-4d dissected, or split into ~7 mini-PRs; wholesale = RED** |

## (2) QUICK-WINS (low effort + real value)

1. **63349de1b** select-all — 1-line verified bug fix (NovelScreen.tsx:280), ~0.25d
2. **13885320a** add-to-library-on-categories — verified inconsistent state, ~0.25d
3. **15560b67b** cover headers — 1-file, ~0.15d
4. **1eb8c587c** library loading state — try/finally, ~0.5d
5. **51560195b+e0c89cdd9** skeleton colors — 1-file value swap, ~0.15d
6. **3bf025108** Indonesian restore — real user-facing win, ~0.3d
7. **3ac611f63+91358ad3d** EPUB image whitelist — 2-line C++ (one combined diff), native rebuild is the only overhead
8. **3ad6e372f** translation corrections — scripted per-key, ~0.3-0.5d
9. (bonus, no port needed) drop `@react-native-community/slider`-era leftovers already done in Batch C; verify no other dead deps before touching package.json

## (3) TRAPS (high effort/low value or high regression risk)

1. **64707409b (RED)** — 47 files, +5415/−895, native dep (keyboard-controller) + WebViewReader/useSettings/SettingsReaderScreen merge-conflict density + textRemover.js vs fork's TTS paragraph-index contract (DOM removal could desync core.js counting — audit-first). Never wholesale. ~2-4d.
2. **3ece098b9 APK size** — gradle/R8 blast radius + 12 hunks in fork-modified files; lottie removal is **coupled to the splash screen**, not dead weight. Value uncertain, cost >1d.
3. **e4246dee5 atomic export** — defer; fork just stabilized export (range + staleness, `ebea3c75a`); SAF atomic-rename may be impossible; hardening value low.
4. **f69e5d6a7** — if not filtered by referenced keys, adds dead upstream-only strings across 34 locales.
5. **197d8670f** — looks trivial but needs real cover-document resolution logic in C++; sequence after the whitelist commit (share Epub.cpp rebuild cycle).
6. **909504a72** — hidden risk is the **migration 005 slot** (Batch D has pending migrations; validator throws on duplicate versions) and Switch/ConfirmationDialog backward-compat (TTS settings screens consume them — re-run TTS wake-cycle/refill after).

## Cross-cutting notes
- **Engineering vs risk cost split**: engineering dominates in GREEN (trivial); risk cost dominates in 8a12529ba (DoH block), 7883b28cd (permission policy + crown-jewel Kotlin), 909504a72 (migration slot + shared components), 64707409b (WebViewReader), 3ece098b9 (gradle).
- **Native rebuild cycles**: Epub.cpp commits (3ac611f63, 91358ad3d, 197d8670f) share ONE rebuild if sequenced; 7883b28cd (Kotlin) separate; 3ece098b9 requires a full **release** build.
- **Translation triple (3ad6e372f, 3bf025108, f69e5d6a7)** — batch together with one merge script + fork-key protection list; 0 test cost.
- **Tests to write total**: GREEN ≈ 3-4, YELLOW ≈ 6-8, RED ≈ 5-8 (all fork-style Jest, better-sqlite3/ExpoLikeDb).
- **Baseline budget**: GREEN batch ≈ 1.5-2d all-in; YELLOW (minus traps) ≈ 3-4d incl. native rebuilds; RED = separate decision.