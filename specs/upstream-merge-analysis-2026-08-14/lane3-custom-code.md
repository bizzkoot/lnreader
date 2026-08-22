I now have all the evidence I need. Let me compile the comprehensive analysis.

## Review
- **Correct (verified from working tree)**: fork's `SettingsReaderScreen.tsx` uses a different architecture than upstream (WebView preview top + bottom-sheet TabView with 5 tabs incl. `AdvancedTab`); fork's `AdvancedTab.tsx` is a fork-modified CSS/JS editor (no TTS settings — TTS lives in `AccessibilityTab.tsx`); fork's `WebViewReader.tsx` injects `customJS` inline in `memoizedHTML` (~line 741) + loads `pluginCustomJS` (~line 739); fork assets live at `android/app/src/main/assets/js/*.js` (NOT upstream's `assets/reader/js/`); fork `useSettings.ts` is heavily extended (TTS, DoH, uiScale, backup); fork has NO `customCode.ts`, NO `SettingsCustomCodeScreen/`, NO `AnimatedIconButton`, NO custom `TextInput`; fork jest setup is `jest.setup.js` (no `test/mocks/react-navigation.js`).
- **Note (constraint)**: This session has **no shell tool**, so `git show 64707409b`, `git cat-file`, and `git log dev` could not be executed. All upstream-diff claims come from the task's commit inventory + `.agents/upstream-merge-memory.md` + `specs/upstream-merge-analysis-2026-08/` (commit 64707409b is NOT in the 170-commit manifest — it is newer than the analyzed range c3260e8e0). Fork-side file states were verified directly. The exact git verification commands for the supervisor are listed at the end.

---

## 64707409b feat: Create Dedicated Custom Code Settings Page V2 (#1902)

- **Files (upstream)**: 47 files, +5415/−895 — `assets/reader/js/textRemover.js` (NEW, 262L), `src/utils/customCode.ts` (NEW), `src/hooks/persisted/useSettings.ts` (+64), `src/screens/reader/components/WebViewReader.tsx` (334L), `SettingsReaderScreen.tsx` (−291 restructure), `tabs/AdvancedTab.tsx` (removed, −413), `SettingsReaderWebView.tsx` (NEW), `screens/settings/SettingsCustomCodeScreen/` (CodeSnippetsScreen, CodeInput, SimpleCodeEditor, SnippetEditor, ReplaceItemModal, SettingsWebView, routes), `App.tsx`, `MoreStack.tsx`, `navigators/types`, components (`AnimatedIconButton`, `TextInput`, `ToggleButton`), i18n strings, `package.json` (+3 deps), `test/mocks/react-navigation.js`.

### Per-file / per-hunk fork status

| Upstream file | Fork status | Divergence | Classification |
|---|---|---|---|
| `assets/reader/js/textRemover.js` | MISSING | Fork WebView assets live at `android/app/src/main/assets/js/` (metro middleware maps `http://localhost:8081/assets/*` → `android/app/src/main/assets/*`; prod = `file:///android_asset`). Upstream is Expo-managed (`assets/reader/js/`), path never applies. | MANUAL (relocate file) |
| `src/utils/customCode.ts` | MISSING | New util. Fork has no such file. Risk depends on whether it is pure TS+MMKV (fork has `@utils/mmkv/mmkv`) or imports upstream-only infra. | DIRECT-if-pure (new file) |
| `src/hooks/persisted/useSettings.ts` | HAS | Fork-extended: `AppSettings` (DoH, uiScale, backup, epub*), `ChapterGeneralSettings` (ttsTextCleanup etc.), `ChapterReaderSettings` (customCSS/customJS/tts). Any upstream hunk referencing fork-added regions fails; only additive new keys are portable. | MANUAL (additive only) |
| `WebViewReader.tsx` | HAS | Fork crown jewel (~1600 LOC, TTS). Fork injects customJS inline at `memoizedHTML` line ~741; upstream's 334-line change rewires script loading + customCode config. Full hunk will never apply. | MANUAL (surgical, HIGH risk) |
| `SettingsReaderScreen.tsx` (−291) | HAS | Fork = WebView preview + bottom-sheet TabView (TopTabBar). Upstream restructure targets a completely different layout. Do not replicate. | SKIP-ARCH (fork layout) / MANUAL for entry point only |
| `tabs/AdvancedTab.tsx` (removed −413) | HAS (fork-modified) | Fork's AdvancedTab is its own CSS/JS editor with scaling + import + TTS-cleanup hint. Upstream *removes* the old one; fork does not need to delete its working tab. | SKIP-ALREADY-HAVE (keep fork's; optionally link to new page) |
| `SettingsReaderWebView.tsx` (NEW) | MISSING | Upstream extracts the preview WebView. Fork already has an inline preview WebView in `SettingsReaderScreen.tsx`. | OPTIONAL refactor, not required |
| `SettingsCustomCodeScreen/*` (7 files) | MISSING | All new files; portable, but depend on customCode.ts + new useSettings keys + new components + new strings + routes + deps. | MANUAL (new files, dependency chain) |
| components `AnimatedIconButton`/`TextInput`/`ToggleButton` | MISSING (ToggleButton name collision) | Fork has `src/components/Common/ToggleButton.tsx` (different API, used by `ReaderTextAlignSelector`/`ReaderThemeSelector`). Upstream adds its own `ToggleButton` — collision risk in `components/index.ts` exports. | MANUAL (rename or namespace) |
| `App.tsx` | HAS | Fork App.tsx has TTS notification setup; upstream hunk likely route/provider registration. Verify hunk before applying. | MANUAL (verify) |
| `MoreStack.tsx` + `navigators/types` | HAS | Simple additive: new `CustomCode` (+ `CustomCodeSnippets`) routes + params. | MANUAL-trivial |
| i18n strings | HAS | Fork strings at `strings/languages/en/strings.json` + generated `strings/types/index.ts` (`pnpm generate:string-types`). Additive per-key merge. | MANUAL (per-key) |
| `package.json` (+3 deps) | HAS | Cannot verify which 3 deps without git show. Must check RN 0.82 / Expo 54 compat (e.g. syntax highlighter is pure-JS; any native module is risky). | MANUAL (verify) |
| `test/mocks/react-navigation.js` | MISSING | Fork mocks `@react-navigation/native` inline in `jest.setup.js`; different strategy. | SKIP-INFRA |

### (a) Pieces portable WITHOUT touching fork TTS/WebViewReader internals
1. **`src/utils/customCode.ts`** — new util; safe if pure TS + MMKV (fork-compatible) and does not import TTS/native modules.
2. **`useSettings.ts` new keys** — additive interface/defaults fields only. Keep them out of `tts`, `ttsTextCleanup`, `doHProvider`, `uiScale`, `backupIncludeOptions` regions. Fork's MMKV keys (`CHAPTER_READER_SETTINGS` etc.) are shared with upstream so new sub-fields survive persistence unchanged.
3. **`SettingsCustomCodeScreen/` UI** (CodeSnippetsScreen, CodeInput, SimpleCodeEditor, SnippetEditor, ReplaceItemModal, SettingsWebView, routes) — all new files. Must be adapted to fork conventions: `scaleDimension`/`useScaledDimensions` instead of raw sizes, `@hooks/persisted` imports, `getString` from `@strings/translations` (already same API), fork `Modal`/`Button`/`List`/`Switch`/`IconButtonV2` components, and the `webviewSecurity` helpers (`shouldAllowReaderWebViewRequest`, nonce) for any preview WebView.
4. **New components** (`AnimatedIconButton`, `TextInput`) — additive. `ToggleButton` needs a name/namespace decision (fork already has `@components/Common/ToggleButton` with different props).
5. **Navigator routes** (`MoreStack.tsx`, `navigators/types/index.ts`) — add `CustomCode`/`CustomCodeSnippets` entries to `SettingsStackParamList`.
6. **i18n strings** — add new keys to `strings/languages/en/strings.json`, then run `pnpm run generate:string-types`.
7. **SettingsReaderScreen entry point** — add a `List.Item` (or a button inside fork's Advanced tab) navigating to the new CustomCode page. No TTS files touched.

### (b) Pieces requiring adapting fork's WebViewReader customJS injection
- The fork injects customJS at `WebViewReader.tsx` `memoizedHTML` (~line 731-742): script list is `polyfill-onscrollend.js, icons.js, van.js, text-vibe.js, core.js, index.js, pluginCustomJS, inline customJS`.
- Required surgical changes only:
  1. Add `<script src="${assetsUriPrefix}/js/textRemover.js"></script>` to the script list (before inline customJS).
  2. Pass textRemover/customCode config into `initialReaderConfig` (e.g. `textRemover: { rules: [...] }`) read from MMKV via a ref (pattern already used for `readerSettings` — **never** add to `memoizedHTML` dependency array, or it will trigger WebView reloads; fork fixed this exact bug for `paragraphHighlightOffset`).
  3. Add any new inbound WebView message type from textRemover.js to the allowed-types array in `handleMessage` + `parseWebViewMessage` (fork has a strict allowlist).
- **Do NOT** take upstream's 334-line hunk wholesale. It will corrupt the fork's MMKV-listener, `applyTtsUpdateToWebView`, wake-cycle, and visible-cleanup code.

### (c) Is textRemover.js loadable by the fork's WebView?
- **YES** — it is a runtime browser asset. The fork's WebView loads scripts from `${assetsUriPrefix}/js/*.js` where dev = `http://localhost:8081/assets` (metro middleware in `metro.config.cjs` serves `android/app/src/main/assets/` incl. `.js` as `text/javascript`) and prod = `file:///android_asset`. Dropping the file at `android/app/src/main/assets/js/textRemover.js` and referencing `${assetsUriPrefix}/js/textRemover.js` works in both modes.
- **⚠️ Critical audit**: fork TTS paragraph indices come from RN-side `htmlParagraphExtractor.extractParagraphs(html, ...)` (the sanitized HTML *string*), so textRemover.js DOM removal does not change the TTS audio queue. But `core.js` DOM paragraph counting / highlight / scroll sync could desync if textRemover removes paragraph-level elements. Verify textRemover only targets non-paragraph containers (e.g. `#watermark`, `.ad-box`) or hides (not removes) elements. This is the highest-risk interaction with fork-custom code — treat the file as a review-first port.

### (d) Dependency additions
- 3 deps added upstream; **cannot be verified here** (no shell). Fork package.json (RN 0.82.1 / Expo 54 / paper 5.14.5) has no code-editor deps. Pure-JS candidates (syntax highlighter, diff libs) are low risk; any native module (code-editor native view) must be checked against Expo 54 bare + Gradle 9.2.0. Run `pnpm install` + full test suite after.

### (e) Overall: **PARTIAL port** (never a cherry-pick)

Safety score: **45/100 (RED)** for the commit taken wholesale (WebViewReader + useSettings + SettingsReaderScreen all fork-modified). Dissected pieces: customCode.ts ~80 GREEN, i18n ~85 GREEN, routes ~80 GREEN, new screens ~60 YELLOW, useSettings additive keys ~70 GREEN, textRemover.js asset ~55 YELLOW (DOM-index audit), components ~65 YELLOW (ToggleButton collision), WebViewReader wiring ~30 RED (must be surgical), deps ~55 YELLOW (unverified), SettingsReaderScreen restructure SKIP, AdvancedTab removal SKIP, jest mock SKIP.

- **Overlap with fork-custom code: yes** — WebViewReader.tsx (TTS crown jewel), useSettings.ts (MMKV extended), SettingsReaderScreen/AdvancedTab (fork layout + scaling), core.js visible-text cleanup (conceptual overlap with textRemover: fork's `cleanVisibleText`/`applyVisibleCleanup` already mutates reader DOM text length-preservingly; enabling both could double-apply rules).

- **Porting guidance (implementation order)**:
  1. Verify upstream diff: `git show 64707409b --stat`, then per-file `git show 64707409b -- <path>`; confirm the 3 deps (`git show 64707409b -- package.json`).
  2. Add new useSettings keys (additive) → regenerate nothing (MMKV object).
  3. Port `customCode.ts` (adapt imports to `@utils/mmkv/mmkv`).
  4. Add new components (`AnimatedIconButton`, `TextInput`, and `ToggleButton` under a non-colliding path, e.g. `CodeToggleButton`).
  5. Port `SettingsCustomCodeScreen/*` adapting to fork components + `scaleDimension` + `webviewSecurity` helpers.
  6. Add navigator routes + SettingsScreen/AdvancedTab entry point.
  7. Add i18n keys + run `pnpm run generate:string-types`.
  8. **Audit textRemover.js** for paragraph-element removal; copy to `android/app/src/main/assets/js/`.
  9. Surgical WebViewReader wiring (script tag + config via ref + message allowlist) — keep out of `memoizedHTML` deps.
  10. Add deps (after verifying), then gates: `pnpm run type-check`, `pnpm run lint`, `pnpm run format`, `pnpm run test` (full suite incl. TTS wake-cycle + refill simulators).
- **Verdict: PORT-with-care (PARTIAL)** — port the UI/util/route/string/asset pieces; gate on the textRemover.js DOM audit; make the WebViewReader change a separate, minimal, well-tested diff.

| hash | title | portability | score | verdict |
|---|---|---|---|---|
| 64707409b | feat: Create Dedicated Custom Code Settings Page V2 (#1902) | PARTIAL (7 of 13 file groups) | 45/100 (RED wholesale; GREEN–YELLOW per-piece) | PORT-with-care (PARTIAL) |

### Git commands the supervisor must run to verify (I had no shell tool)
```
git show 64707409b --stat
git show 64707409b -- src/hooks/persisted/useSettings.ts   # confirm which keys are added (additive?)
git show 64707409b -- src/screens/reader/components/WebViewReader.tsx  # confirm exact script/config wiring
git show 64707409b -- src/utils/customCode.ts   # confirm no TTS/native imports
git show 64707409b -- package.json  # confirm the 3 new deps
git show 64707409b -- assets/reader/js/textRemover.js  # audit DOM node removal vs fork's paragraph-index contract
git show 64707409b -- src/screens/settings/SettingsCustomCodeScreen/
git show 64707409b -- App.tsx  # confirm the App.tsx hunk is route/provider-only
git log dev --oneline -5 -- src/screens/reader/components/WebViewReader.tsx  # confirm fork-only TTS history
```