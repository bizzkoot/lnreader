# PRD — Batch C: UX / Theme Train

**Status**: 📋 PLANNED (analysis complete; no code changes yet)
**Date**: 2026-08-03
**Source**: `specs/upstream-merge-analysis-2026-08/analysis.md` · Manifest batch: C (7) + C-optional (2)
**Estimated effort**: 1–2 days core · optional items ~0.5 day each

---

## 1. Objective

Port the Material-3 UX polish cluster from upstream. **Strict ordering matters**: the dynamic Material You colors feature (`44c8e54e`) depends on the theme-switcher refactor (`8f47e8fd`) landing first. The fork's `useTheme.ts` was verified to match the upstream pre-refactor base, so adaptation is localized.

## 2. Core batch (7 commits, prerequisite-ordered)

| Order | Commit | Feature | Port notes |
|---|---|---|---|
| 1 | `8f47e8fd1e` | **Theme switcher refactor** (#1839) | Context-based `useTheme` + `ThemePicker` + appearance-settings rework (~20 files). Fork's `useTheme.ts` matches the pre-refactor base (same imports, same MMKV hooks). **Prerequisite** for dynamic colors. |
| 2 | `44c8e54ed8` | **Dynamic Material You theme colors** (#1863) | Android 12+ wallpaper-derived colors via `@pchmn/expo-material3-theme` + new `src/theme/dynamic.ts` + useTheme/settings/onboarding wiring. High user appeal. Verify UI-scale + tests after. |
| 3 | `0c8546188e` | **MD3 Slider component** | New MD3 Slider (416 lines) replacing `@react-native-community/slider`. Coordinate `package.json` removal; fork's `TextSizeSlider`/`ReaderValueChange` (incl. `ReaderTTSTab` path — fork's TTS tab) must migrate. |
| 4 | `6d2a9f8e15` | Slider flicker fix | Only after #3 lands. |
| 5 | `3d34658d0f` | **M3 top tab indicators** | New `TopTabBar` component; replaces `SettingsReaderScreen/components/TabBar.tsx`; applies to 6 screens incl. ReaderBottomSheet. |
| 6 | `17c891e133` | **Standardize bottom sheet UX/styling** | BottomSheet component + `surfaceContainerLow` in `useTheme` + layout util; touches ReaderBottomSheet, NovelBottomSheet, LibraryBottomSheet, FilterBottomSheet, TrackSheet. Fork's useTheme needs the new surface color keys. |
| 7 | `e9f6bdaa20` | **Menu styling + outside-tap dismissal** | Menu component overhaul; fork has its own `src/components/Menu/index.tsx` used by reader/Webview appbars — portable pattern. |

## 3. Optional (2 commits)

| Commit | Feature | Notes |
|---|---|---|
| `098782d6aa` | Simplify settings layout + theme selection | Removes `react-native-theme-switch-animation` dep — verify fork's dependency graph before removing |
| `99c31d56bb` | MD3 outline variant for tab borders | Cosmetic across 6 screens incl. ReaderBottomSheet (fork: ReaderBottomSheetV2/ReaderTTSTab) |

## 4. Risks

| Risk | Mitigation |
|---|---|
| Theme refactor touches `useTheme` used everywhere | Land as standalone PR; snapshot screenshots before/after |
| Dynamic colors may conflict with fork's `uiScale`/computed color system | Keep fork's scaling; dynamic palette only feeds existing color roles |
| MD3 Slider removal of community slider ripples to reader value sliders | Migrate all consumers in same PR; check ReaderTTSTab (fork-custom) |
| `surfaceContainerLow` AND `surfaceContainerHigh` new color keys must exist in ALL fork themes (incl. TTS/reader themes). Verified: fork `ThemeColors` (`src/theme/types/index.ts:39-41`) + `addComputedColors` (`useTheme.ts:22-27`) contain NEITHER key | Add BOTH keys to the type + computed-colors function + all 10 `src/theme/md3/` variants in same PR |

## 5. Implementation order

1. `8f47e8fd1e` theme refactor → run full test suite (themes touch SettingsAppearanceScreen, useTheme, ThemePicker)
2. `44c8e54ed8` dynamic colors → manual QA on Android 12+ (wallpaper change → app colors follow)
3. `0c8546188e` + `6d2a9f8e15` slider train
4. `3d34658d`, `17c891e1`, `e9f6bdaa` component polish
5. Optional: `098782d6`, `99c31d56`

Work on a branch: `merge/original-sync-batch-c`.

## 6. Testing & validation

```bash
pnpm run type-check && pnpm run lint:fix && pnpm run format
pnpm run test
pnpm run test:tts-wake-cycle   # safety gate (ReaderBottomSheet/ReaderTTSTab touched)
```

Manual QA:
- Theme switcher: light/dark/amoled + per-app themes still function; TTS sheet readable in all
- Dynamic colors: enable on Android 12+, change wallpaper, confirm palette updates without app restart crash
- Slider: text size slider in reader + TTS tab; no flicker on release
- Bottom sheet standard: open/close each sheet; no layout jump

## 7. Acceptance criteria

- [ ] Theme switcher refactor landed with zero visual regressions (screenshot comparison)
- [ ] Dynamic Material You colors work on Android 12+ with toggle in Settings → Appearance
- [ ] MD3 slider replaces community slider app-wide; `@react-native-community/slider` removed from package.json
- [ ] Top tab indicators + bottom sheet standardization applied to all 6 target screens
- [ ] 1235+ tests green; TTS suites green

## 8. Out of scope

- Full M3 dialog standardization (`dfd620aa`, 51 files — deferred: low value-per-conflict)
- Any reader/TTS engine change
- Batch D rewrites
