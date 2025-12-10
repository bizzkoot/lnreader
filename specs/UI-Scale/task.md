# UI Scale Enhancement - Full Implementation

## Objective
Complete the UI scale implementation to ensure all icons, text, images, and dimensions scale properly according to the user's uiScale setting.

## Phase 1: Core Shared Components (High Priority) ✅
- [x] `IconButtonV2` - Add useScaledDimensions for default icon size
- [x] `ToggleButton` - Scale icon size and container dimensions
- [x] `List.tsx` - Scale icon sizes, font sizes, and spacing
- [x] `Checkbox.tsx` - Scale icon size and padding
- [x] `Switch.tx` - Scale default size prop using hook

## Phase 2: Screen Components with Hardcoded Icons
- [x] `MoreScreen.tsx` - Scale font sizes and Switch size prop
- [ ] `FilterBottomSheet.tsx` - Scale icon sizes
- [ ] `NovelAppbar.tsx` - Scale icon sizes
- [ ] `DownloadCustomChapterModal.tsx` - Scale icon sizes
- [ ] `NovelScreenButtonGroup.tsx` - Scale icon sizes
- [ ] `NovelInfoComponents.tsx` - Scale icon sizes
- [ ] `NovelInfoHeader.tsx` - Scale icon sizes
- [ ] `TrackSearchDialog.tsx` - Scale icon sizes and dimensions
- [ ] `VoicePickerModal.tsx` - Scale icon sizes
- [ ] `GlobalSearchResultsList.tsx` - Scale icon sizes
- [ ] `ErrorView.tsx` - Scale icon sizes
- [ ] `ErrorScreenV2.tsx` - Scale icon sizes
- [ ] `NovelSummary.tsx` - Scale icon sizes

## Phase 3: Hardcoded Dimensions
- [ ] Settings screens - Scale hardcoded widths/heights
- [ ] Browse screens - Scale card/list dimensions
- [ ] History screens - Scale card dimensions
- [ ] Novel screens - Scale modal heights and widths
- [ ] Loading animations - Scale skeleton dimensions

## Verification
- [ ] Test at 20% scale (0.2)
- [ ] Test at 80% scale (0.8) - default
- [ ] Test at 150% scale (1.5)
- [ ] Verify no layout breaks or overflow
