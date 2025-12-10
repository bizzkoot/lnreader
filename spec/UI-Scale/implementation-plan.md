# UI Scale Implementation Plan (Revised)

## Scope Clarification

### Two Separate Scaling Systems

1. **UI Scale (`uiScale`)** - Range: 0.2 to 1.5 (default: **0.8** = 80%)
   - Applies to: All app UI elements (navigation, buttons, icons, covers, margins, padding, etc.)
   - Hook: `useScaledDimensions()`
   - Setting: `AppSettings.uiScale`
   - **Default changed to 0.8**: After dependencies update, Material Design 3 sizes felt too large. 80% provides comfortable mobile density.

2. **Chapter Text Size (`textSize`)** - Font size for chapter content
   - Applies to: Only chapter content text within WebView
   - Already has native scaling implementation
   - Setting: `ChapterReaderSettings.textSize`
   - **NOT in scope for this implementation**

### What This Implementation Will Fix

- ✅ All navigation UI (bottom nav, tabs, drawers)
- ✅ Novel covers and library grids
- ✅ Actionbars and toolbars
- ✅ Buttons, icons, badges
- ✅ Modal dialogs, bottom sheets
- ✅ Settings screens UI
- ✅ Reader toolbar/controls (outside WebView)
- ❌ Chapter text content (already handled separately)
- ❌ WebView rendering (has native scaling)

## Problem Summary

UI scaling is inconsistently applied across the app. While the `uiScale` setting exists and `useScaledDimensions` hook is available, most UI components still use hardcoded dimensions instead of scaled values.

## Root Cause Analysis

### 1. Inconsistent Dimension Usage

- **Text**: ✅ Scaled correctly via `AppText` component
- **Dimensions**: ❌ Not using `useScaledDimensions` hook consistently
- **Icons**: ❌ Fixed sizes (e.g., `size={24}` in Actionbar)
- **Images/Covers**: ❌ Calculated from window width without applying scale
- **Layout Components**: ❌ Hardcoded padding/margins instead of scaled values

### 2. Component-Specific Issues

#### NovelCover Component

```typescript
// Issue: Calculating cover size based on window width without UI scale
const coverHeight = useMemo(() => {
  return (window.width / numColumns) * (4 / 3); // Missing scale!
}, [globalSearch, window.width, numColumns]);
```

#### Actionbar Component

```typescript
// Issue: Fixed icon size
<MaterialCommunityIcons
  name={icon}
  color={theme.onSurface}
  size={24} // Should be scaled!
/>
```

#### Library Grid Layout

```typescript
// Issue: Hardcoded dimensions without scale
paddingHorizontal: 12, // Should use scaled padding
paddingVertical: 8,   // Should use scaled padding
borderRadius: 4,      // Should use scaled border radius
```

## Implementation Strategy

### Phase 1: Fix Core Components (High Priority)

#### 1.1 NovelCover Component

- Import and use `useScaledDimensions` hook
- Apply scale to cover height/width calculations
- Ensure border radius scales properly

#### 1.2 Actionbar Component

- Scale icon sizes using `useScaledDimensions`
- Scale actionbar height and padding

#### 1.3 Library Grid Layout

- Replace hardcoded padding with scaled values
- Scale border radius
- Ensure grid spacing scales

### Phase 2: Fix Navigation Components (High Priority)

#### 2.1 Bottom Navigation

- Scale tab bar height
- Scale icon sizes
- Scale touch targets

#### 2.2 Tab Navigation

- Scale tab indicators
- Scale text sizes in tabs

### Phase 3: Fix Modal Components (Medium Priority)

#### 3.1 Bottom Sheets

- Scale handle height
- Scale content padding
- Scale border radius

#### 3.2 Dialogs

- Scale button dimensions
- Scale input fields
- Scale modal padding

### Phase 4: Fix List Components (Medium Priority)

#### 4.1 Novel List Items

- Scale item heights
- Scale spacing between items
- Scale badge sizes

#### 4.2 General Lists

- Scale separator heights
- Scale padding
- Scale minimum touch targets

### Phase 5: Fix Reader Components (Medium Priority)

#### 5.1 Reader Toolbar

- Scale button sizes
- Scale icon sizes
- Scale slider heights

#### 5.2 Reader Settings

- Scale all control dimensions
- Ensure text remains readable at small scales

### Phase 6: Fix Settings Screens (Low Priority)

#### 6.1 Settings Forms

- Scale switch dimensions
- Scale slider track heights
- Scale input field heights

## Technical Implementation Details

### Scaling Hook Usage Pattern

```typescript
// Before (Current)
const styles = StyleSheet.create({
  container: {
    padding: 16, // Hardcoded
    borderRadius: 8, // Hardcoded
  },
});

// After (Fixed)
const { padding, borderRadius } = useScaledDimensions();
const styles = StyleSheet.create({
  container: {
    padding: padding.md, // Scaled
    borderRadius: borderRadius.md, // Scaled
  },
});
```

### Icon Scaling Pattern

```typescript
// Before (Current)
<Icon size={24} />

// After (Fixed)
const { iconSize } = useScaledDimensions();
<Icon size={iconSize.md} /> // 24dp at 100% scale
```

### Cover/Image Scaling Pattern

```typescript
// Before (Current)
const coverWidth = window.width / 3 - 16; // No scale

// After (Fixed)
const { window } = useWindowDimensions();
const { uiScale } = useAppSettings();
const coverWidth = (window.width / 3 - 16) * uiScale; // With scale
```

## Testing Strategy

### 1. Scale Verification

- Test at 20% (0.2): Ensure nothing breaks
- Test at 100% (1.0): Baseline verification
- Test at 150% (1.5): Ensure no overflow

### 2. Component Testing

- Test each fixed component individually
- Verify consistent scaling across related components
- Check for layout issues at extreme scales

### 3. Accessibility Testing

- Verify minimum touch targets (48dp) at 20% scale = 9.6dp
- Ensure text remains readable at 20% scale
- Test with screen reader

## Rollout Plan

### Iteration 1: Core Components

1. Fix NovelCover component
2. Fix Actionbar component
3. Fix Library grid layout
4. Test and verify

### Iteration 2: Navigation

1. Fix bottom navigation
2. Fix tab navigation
3. Test navigation flows

### Iteration 3: Modals & Lists

1. Fix bottom sheets
2. Fix novel lists
3. Test modal interactions

### Iteration 4: Reader & Settings

1. Fix reader components
2. Fix settings screens
3. Full app testing

## Implementation Status

### ✅ Phase 1: Core Components (COMPLETED)

#### 1.1 NovelCover Component

- ✅ Applied scale to cover dimensions (height/width calculations)
- ✅ Converted all hardcoded badges, borders, padding to scaled values
- ✅ Created `getScaledStyles()` function for dynamic styling
- ✅ Updated child components (InLibraryBadge, DownloadBadge, UnreadBadge, etc.)
- **Files Modified:**
  - `src/components/NovelCover.tsx`
  - `src/components/ListView.tsx`

#### 1.2 Navigation Components

- ✅ BottomNavigator: Icon sizes now use `iconSize.md`
- ✅ BottomTabBar: Tab height, icon container size, padding, margins all scaled
- ✅ Created dynamic `getStyles()` function receiving scaled dimensions
- **Files Modified:**
  - `src/navigators/BottomNavigator.tsx`
  - `src/components/BottomTabBar/index.tsx`

#### 1.3 List Components

- ✅ NovelList: FlatList padding scaled (using `padding.xl`, `padding.sm`)
- ✅ Actionbar: Icon sizes and border radius scaled
- **Files Modified:**
  - `src/components/NovelList.tsx`
  - `src/components/Actionbar/Actionbar.tsx`
  - `src/screens/browse/SourceNovels.tsx`

### 🚧 Phase 2: Strategic High-Impact Components (IN PROGRESS)

Focus on components users interact with most frequently:

#### 2.1 Reader UI Components (Excluding WebView content)

- [ ] Reader toolbar buttons and controls
- [ ] Chapter drawer list items
- [ ] TTS controls and dialogs
- [ ] Reader appbar
- **Target Files:**
  - `src/screens/reader/components/ReaderAppbar.tsx`
  - `src/screens/reader/components/ChapterDrawer/index.tsx`
  - `src/screens/reader/components/TTSChapterSelectionDialog.tsx`
  - `src/screens/reader/components/TTSExitDialog.tsx`
  - `src/screens/reader/components/TTSSyncDialog.tsx`
  - `src/screens/reader/components/TTSResumeDialog.tsx`

#### 2.2 Common Dialogs & Modals

- [ ] Category modals
- [ ] Filter/sort dialogs
- [ ] Confirmation dialogs
- **Target Files:**
  - `src/screens/Categories/components/DeleteCategoryModal.tsx`
  - `src/screens/Categories/components/AddCategoryModal.tsx`
  - `src/screens/Categories/components/CategoryCard.tsx`

#### 2.3 Settings Screens

- [ ] Settings list items
- [ ] Switch/slider controls
- [ ] Input fields
- **Target Files:**
  - `src/screens/settings/**/*.tsx`

### 📋 Phase 3: Comprehensive Coverage (DEFERRED)

**Note:** These components have lower user impact and can be addressed incrementally by contributors.

#### Files with Hardcoded Dimensions (for future work):

```
src/screens/Categories/CategoriesScreen.tsx (130,131,135)
src/screens/Categories/components/CategoryCard.tsx (132-162)
src/screens/Categories/components/DeleteCategoryModal.tsx (58,62,63)
src/screens/Categories/components/AddCategoryModal.tsx (92)
src/screens/reader/components/TTSChapterSelectionDialog.tsx (153,157,177,182)
src/screens/reader/components/ChapterDrawer/index.tsx (214,241,248)
src/screens/reader/components/TTSScrollSyncDialog.tsx (92)
src/screens/reader/components/TTSExitDialog.tsx (91,95)
src/screens/reader/components/SkeletonLines.tsx (10,19,33,40,61,135)
src/screens/reader/components/TTSResumeDialog.tsx (93)
src/screens/reader/components/TTSSyncDialog.tsx (162,169,174,178,188,192,196)
src/screens/reader/ChapterLoadingScreen/*.tsx
src/screens/reader/components/ReaderAppbar.tsx (145,148)
```

#### Pattern for Future Contributors:

```typescript
// Before (hardcoded)
const styles = StyleSheet.create({
  container: {
    padding: 16,
    margin: 8,
    borderRadius: 4,
  },
});

// After (scaled)
import { useScaledDimensions } from '@hooks/useScaledDimensions';

const getStyles = (
  padding: ReturnType<typeof useScaledDimensions>['padding'],
  margin: ReturnType<typeof useScaledDimensions>['margin'],
  borderRadius: ReturnType<typeof useScaledDimensions>['borderRadius'],
) =>
  StyleSheet.create({
    container: {
      padding: padding.md,
      margin: margin.sm,
      borderRadius: borderRadius.sm,
    },
  });

// In component:
const scaledDimensions = useScaledDimensions();
const styles = useMemo(
  () =>
    getStyles(
      scaledDimensions.padding,
      scaledDimensions.margin,
      scaledDimensions.borderRadius,
    ),
  [scaledDimensions],
);
```

## Success Criteria

### Functional

- [x] Core UI elements scale proportionally (covers, lists, navigation)
- [ ] No layout breaks at 20% scale (needs testing)
- [ ] No overflow at 150% scale (needs testing)
- [x] Consistent visual density across core components

### Performance

- [x] Scaling calculations memoized with useMemo
- [x] No unnecessary re-renders (scaled dimensions only recalculate when uiScale changes)
- [ ] Smooth animations at all scales (needs testing)

### Accessibility

- [ ] Minimum touch targets maintained at all scales (needs testing)
- [x] Text scaling separate from UI scaling (textSize vs uiScale)
- [x] Screen reader compatibility maintained (no breaking changes)
