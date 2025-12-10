# UI Scale Enhancement - Task Checklist

**Last Updated:** December 10, 2025  
**Status:** 19/40+ components complete (47.5%)

## Objective
Complete the UI scale implementation to ensure all icons, text, images, and dimensions scale properly according to the user's uiScale setting (0.2 - 1.5, default 0.8).

## Phase 1: Core Shared Components ✅
- [x] `IconButtonV2` - Add useScaledDimensions for default icon size
- [x] `ToggleButton` - Scale icon size and container dimensions
- [x] `List.tsx` - Scale icon sizes, font sizes, and spacing
- [x] `Checkbox.tsx` - Scale icon size and padding
- [x] `Switch.tsx` - Scale default size prop using hook

## Phase 2: Screen Components with Hardcoded Icons ✅
- [x] `MoreScreen.tsx` - Scale font sizes and Switch size prop
- [x] `ErrorView.tsx` - Scale icon sizes
- [x] `ErrorScreenV2.tsx` - Scale icon sizes
- [x] `FilterBottomSheet.tsx` - Scale icon sizes (2 instances)
- [x] `NovelSummary.tsx` - Scale icon sizes
- [x] `NovelAppbar.tsx` - Scale icon sizes (2 instances)
- [x] `DownloadCustomChapterModal.tsx` - Scale icon sizes (4 instances)
- [x] `NovelScreenButtonGroup.tsx` - Scale icon sizes
- [x] `NovelInfoComponents.tsx` - Scale icon sizes (2 instances)
- [x] `NovelInfoHeader.tsx` - Scale icon sizes
- [x] `TrackSearchDialog.tsx` - Scale icon sizes
- [x] `VoicePickerModal.tsx` - Scale icon sizes  
- [x] `GlobalSearchResultsList.tsx` - Scale icon sizes

## Phase 3: Hardcoded Dimensions

### Phase 3a: Skeleton Loading Components ✅
- [x] `Skeleton.tsx` - Scale all skeleton dimensions (height/width values)

### Phase 3b: Settings Screens - Modal Font Sizes
- [ ] `ConnectionModal.tsx` - Scale fontSize: 24
- [ ] `SelfHostModal.tsx` - Scale fontSize: 16, 24
- [ ] `GoogleDriveModal.tsx` - Scale fontSize: 12, 16, 24
- [ ] `MangaUpdatesLoginDialog.tsx` - Scale fontSize: 14, 16, 24
- [ ] `AddRepositoryModal.tsx` - Scale fontSize: 24
- [ ] `DeleteRepositoryModal.tsx` - Scale fontSize: 24
- [ ] `DisplayModeModal.tsx` - Scale fontSize: 24
- [ ] `GridSizeModal.tsx` - Scale fontSize: 16, 24
- [ ] `NovelBadgesModal.tsx` - Scale fontSize: 16, 24
- [ ] `NovelSortModal.tsx` - Scale fontSize: 16, 24
- [ ] `AutoDownloadModal.tsx` - Scale fontSize: 24

### Phase 3c: Settings Screens - Main Screens
- [ ] `SettingsAdvancedScreen.tsx` - Scale fontSize: 12, 24
- [ ] `SettingsAppearanceScreen.tsx` - Scale fontSize: 12, 16, 24
- [ ] `SettingsTrackerScreen.tsx` - Scale fontSize: 18
- [ ] `RepositoryCard.tsx` - Scale fontSize: 16
- [ ] `DisplayTab.tsx` - Scale fontSize: 16
- [ ] `ThemeTab.tsx` - Scale fontSize: 16
- [ ] `AdvancedTab.tsx` - Scale fontSize: 12, 13, 14
- [ ] `AccessibilityTab.tsx` - Scale fontSize: 12, 16, 24
- [ ] `NavigationTab.tsx` - Scale fontSize: 14
- [ ] `TTSScrollBehaviorModal.tsx` - Scale fontSize: 16, 20

## Phase 3d: Browse and Novel Screens (Optional - if time permits)
- [ ] Browse screen card dimensions
- [ ] History screen card dimensions
- [ ] Novel modal heights/widths

## Phase 4: Core Shared Components (Batch 2 - Dec 10) ✅
- [x] `SegmentedControl.tsx` - Scale icons, heights, radius
- [x] `TabBar.tsx` (Reader Settings) - Scale icons, padding
- [x] `ChapterDownloadButtons.tsx` - Scale icons, size, padding
- [x] `ThemePicker.tsx` - Scale card, icon, internal dimensions
- [x] `ColorPreferenceItem.tsx` - Scale size, padding
- [x] `RadioButton.tsx` - Scale font, padding
- [x] `SwitchItem.tsx` - Scale font, padding
- [x] `Toast.tsx` - Scale font, padding, position
- [x] `Chip.tsx` - Scale height, radius, padding
- [x] `DialogTitle.tsx` - Scale font, margin
- [x] `ConfirmationDialog.tsx` - Scale radius, padding, font
- [x] `SearchbarV2.tsx` - Scale height, font, margin
- [x] `Menu/index.tsx` - Scale font, padding, minHeight

## Verification
- [x] TypeScript type check passes
- [x] ESLint passes (0 errors)
- [ ] Jest tests pass
- [ ] Test at 20% scale (0.2)
- [ ] Test at 80% scale (0.8) - default
- [ ] Test at 150% scale (1.5)
- [ ] Verify no layout breaks or overflow

## Summary

**Completed:**
- ✅ Phase 1: 5/5 components
- ✅ Phase 2: 13/13 components
- ✅ Phase 3a: 1/1 component
- ✅ Phase 4: 13/13 components
- **Total: 32 components**

**Remaining:**
- Phase 3b: 11 files
- Phase 3c: 10 files
- Phase 3d: TBD files
