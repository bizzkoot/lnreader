# UI Scale Enhancement - Full Implementation

Complete the UI scale implementation to ensure all icons, text, images, and dimensions scale properly according to the user's `uiScale` setting (0.2 - 1.5).

## Background

The specs in `specs/UI-Scale/` show that core components (NovelCover, BottomTab, Actionbar, NovelList) are already scaled. However, many components still use hardcoded values:

- **22+ files** with `size={24}` hardcoded icons
- **50+ locations** with hardcoded `fontSize`, `height`, `width` values
- Core shared components (`IconButtonV2`, `ToggleButton`, `List`, `Checkbox`, etc.) don't use scaled dimensions

## Proposed Changes

### Phase 1: Core Shared Components (High Impact)

These components are reused throughout the app, so fixing them has a cascading effect.

---

#### [MODIFY] [IconButtonV2.tsx](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/components/IconButtonV2/IconButtonV2.tsx)

- Add `useScaledDimensions` hook
- Change default `size = 24` to use `iconSize.md` from scaled dimensions
- Scale `padding` prop default from `8` to `padding.sm`
- Scale `borderRadius: 50` to use scaled value

---

#### [MODIFY] [ToggleButton.tsx](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/components/Common/ToggleButton.tsx)

- Add `useScaledDimensions` hook
- Scale icon `size={24}` to `iconSize.md`
- Convert static styles to dynamic `getStyles()` function:
  - `borderRadius: 6` → `borderRadius.sm + 2`
  - `marginHorizontal: 6` → `margin.sm - 2`
  - `padding: 8` → `padding.sm`
  - `height/width: 44` → `44 * scale` or use `buttonHeight`

---

#### [MODIFY] [List.tsx](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/components/List/List.tsx)

- Add `useScaledDimensions` hook to each sub-component
- Scale `InfoItem` icon: `size={20}` → `iconSize.md - 4` (scaled)
- Scale all hardcoded dimensions:
  - `fontSize: 16` → scaled
  - `fontSize: 12` → scaled  
  - `height: 24, width: 24` → scaled
  - `padding: 16`, `paddingVertical: 12`, `paddingLeft: 16` → scaled
  - `marginTop: 12`, `marginLeft: 12`, `marginRight: 16` → scaled

---

#### [MODIFY] [Checkbox.tsx](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/components/Checkbox/Checkbox.tsx)

- Add `useScaledDimensions` hook
- Scale `SortItem` icon: `size={21}` → `iconSize.md - 3` (scaled)
- Scale padding values: `paddingHorizontal: 16`, `paddingVertical: 6`, `paddingVertical: 16`, `paddingLeft: 64`
- Scale `marginLeft: 12`, `left: 24`

---

#### [MODIFY] [Switch.tsx](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/components/Switch/Switch.tsx)

- Add `useScaledDimensions` hook
- Scale default `size = 22` to use a scaled value based on `iconSize.md`

---

### Phase 2: Screen Components with Hardcoded Icons

Components that directly use `size={24}` for icons.

---

#### [MODIFY] [MoreScreen.tsx](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/screens/more/MoreScreen.tsx)

- Add `useScaledDimensions` hook
- Scale `Switch size={24}` → pass scaled icon size
- Scale `fontSize: 12`, `fontSize: 16` in styles
- Scale `paddingHorizontal: 16`, `paddingVertical: 14`, `marginLeft: 16`

---

#### [MODIFY] [ErrorView.tsx](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/components/ErrorView/ErrorView.tsx)

- Scale icon `size={24}` → `iconSize.md`

---

#### [MODIFY] [ErrorScreenV2.tsx](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/components/ErrorScreenV2/ErrorScreenV2.tsx)

- Scale icon `size={24}` → `iconSize.md`

---

#### [MODIFY] [GlobalSearchResultsList.tsx](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/screens/GlobalSearchScreen/components/GlobalSearchResultsList.tsx)

- Scale icon `size={24}` → `iconSize.md`
- Scale `fontSize: 12` in styles

---

#### [MODIFY] [FilterBottomSheet.tsx](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/screens/BrowseSourceScreen/components/FilterBottomSheet.tsx)

- Scale icon `size={24}` (2 locations) → `iconSize.md`
- Scale `fontSize: 16`, `width: 200` in styles

---

#### [MODIFY] [NovelSummary.tsx](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/screens/novel/components/NovelSummary/NovelSummary.tsx)

- Scale icon `size={24}` → `iconSize.md`

---

#### [MODIFY] [NovelAppbar.tsx](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/screens/novel/components/NovelAppbar.tsx)

- Scale icon `size={24}` (2 locations) → `iconSize.md`

---

#### [MODIFY] [DownloadCustomChapterModal.tsx](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/screens/novel/components/DownloadCustomChapterModal.tsx)

- Scale icon `size={24}` (4 locations) → `iconSize.md`

---

#### [MODIFY] [NovelScreenButtonGroup.tsx](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/screens/novel/components/NovelScreenButtonGroup/NovelScreenButtonGroup.tsx)

- Scale icon `size={24}` → `iconSize.md`

---

#### [MODIFY] [NovelInfoComponents.tsx](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/screens/novel/components/Info/NovelInfoComponents.tsx)

- Scale icon `size={24}` (2 locations) → `iconSize.md`
- Scale `height: 150`, `width: 100` in styles

---

#### [MODIFY] [NovelInfoHeader.tsx](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/screens/novel/components/Info/NovelInfoHeader.tsx)

- Scale icon `size={24}` → `iconSize.md`

---

#### [MODIFY] [TrackSearchDialog.tsx](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/screens/novel/components/Tracker/TrackSearchDialog.tsx)

- Scale icon `size={24}` → `iconSize.md`
- Scale `fontSize: 16`, `height: 150`, `width: 100` in styles

---

#### [MODIFY] [VoicePickerModal.tsx](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/screens/settings/SettingsReaderScreen/Modals/VoicePickerModal.tsx)

- Scale icon `size={24}` → `iconSize.md`

---

### Phase 3: Additional Hardcoded Dimensions (Lower Priority)

These files have hardcoded dimensions that should be scaled for full coverage.

| File                         | Hardcoded Values                        |
| ---------------------------- | --------------------------------------- |
| `ChapterItem.tsx`            | fontSize: 14, 12; height: 64            |
| `HistoryCard.tsx`            | height: 80, width: 56                   |
| `UpdateNovelCard.tsx`        | height: 40; fontSize: 12, 14            |
| `GlobalSearchNovelCover.tsx` | height: 150, width: 115; fontSize: 14   |
| `DiscoverNovelCard`          | width: 100; fontSize: 12, 16            |
| `PluginListItem.tsx`         | height: 40, width: 40; fontSize: 12     |
| `MigrationSourceItem.tsx`    | height: 40, width: 40; fontSize: 12, 14 |

---

## Verification Plan

### Manual Testing

1. Navigate to **Settings → Appearance → UI Scale**
2. Test at **20%** (0.2) - Ensure no elements become too small/overlap
3. Test at **80%** (0.8) - Default, verify baseline
4. Test at **150%** (1.5) - Ensure no overflow or text truncation

### Key Areas to Verify

- [ ] Icons in list items scale properly
- [ ] Toggle buttons and switches scale properly
- [ ] Modal dialogs scale properly
- [ ] Font sizes in lists scale properly
- [ ] Card dimensions scale properly
- [ ] Touch targets remain accessible at all scales

### Automated

```bash
pnpm run typecheck  # Ensure no TS errors
pnpm run lint       # Ensure code style 
pnpm test           # Run unit tests
```
