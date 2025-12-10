# UI Scale Testing Guide

## Quick Start

1. Build and install the app:

   ```bash
   cd /Users/muhammadfaiz/Custom\ APP/LNreader
   pnpm run build:release:android
   ```

2. Open the app and navigate to:

   ```
   More → Settings → Appearance → UI Scale
   ```

3. Test at four key values:
   - **20% (0.2)** - Minimum density (extremely compact)
   - **80% (0.8)** - **Default** (comfortable mobile density)
   - **100% (1.0)** - Full Material Design 3 spec
   - **150% (1.5)** - Maximum density (very spacious)

## Implementation Status: ✅ COMPLETED

All UI scaling implementation has been completed as of December 11, 2025. The following components have been successfully updated:

### Total Components Implemented: 26 files

#### P1: Settings Modals (9 files) ✅
- ConnectionModal.tsx - fontSize: 24 scaled
- SelfHostModal.tsx - fontSize: 16, 24 scaled
- GoogleDriveModal.tsx - fontSize: 12, 16, 24 scaled
- MangaUpdatesLoginDialog.tsx - fontSize: 14, 16, 24 scaled
- AddRepositoryModal.tsx - fontSize: 24 scaled
- DeleteRepositoryModal.tsx - fontSize: 24 scaled
- ConcurrentSearchesModal.tsx - fontSize: 24 scaled
- SourceSettings.tsx - fontSize: 16, 24 scaled
- ExportEpubModal.tsx - fontSize: 24 scaled

#### P2: Novel Components (6 files) ✅
- NovelInfoComponents.tsx - All sub-components scaled
- NovelInfoHeader.tsx - Layout and text elements scaled
- NovelDrawer.tsx - Drawer dimensions and text scaled
- PagePaginationControl.tsx - Pagination controls and buttons scaled
- ScoreSelectors.tsx - Form inputs and labels scaled
- TrackerCards.tsx - Card dimensions and icons scaled

#### P2: Browse Components ✅
- Already completed in previous phases

#### P3: Reader Controls (4 files) ✅
- ReaderFooter.tsx - 6 IconButton instances scaled
- ReaderValueChange.tsx - Increment/decrement buttons scaled
- ReaderTextSize.tsx - Text size controls scaled
- ReaderBottomSheet.tsx - estimatedItemSize scaled

#### P3: Error/Misc Views (7 files) ✅
- EmptyView/EmptyView.tsx - fontSize: 40 scaled
- EmptyView.tsx (root) - fontSize: 45 scaled
- ErrorView.tsx - fontSize: 45, 12 scaled
- ErrorScreenV2.tsx - fontSize: 44 scaled
- AppErrorBoundary.tsx - fontSize: 20, lineHeight: 20 scaled
- LoadingScreenV2.tsx - ActivityIndicator size: 50 scaled
- ColorPickerModal.tsx - fontSize: 24, height: 40 scaled

## Test Scenarios

## Test Scenarios

### Scenario 1: Library View

**Path**: Library tab

**At 20% scale:**

- [ ] Novel covers are small but visible
- [ ] Unread/download badges are readable
- [ ] 3-column grid layout maintained
- [ ] Touch targets remain functional

**At 150% scale:**

- [ ] Covers are large and comfortable to tap
- [ ] No text truncation in titles
- [ ] No layout overflow
- [ ] Smooth scrolling

### Scenario 2: Navigation

**Path**: Bottom navigation bar

**At 20% scale:**

- [ ] Icons remain recognizable
- [ ] Labels (if enabled) don't overlap
- [ ] Tab indicator visible
- [ ] Minimum 48dp touch target maintained

**At 150% scale:**

- [ ] Icons properly sized
- [ ] No label truncation
- [ ] Tab bar doesn't overflow screen
- [ ] Active tab clearly indicated

### Scenario 3: Novel Details

**Path**: Library → Tap any novel

**At 20% scale:**

- [ ] Cover loads and displays properly
- [ ] Chapter list items are tappable
- [ ] Badges visible
- [ ] Action buttons functional

**At 150% scale:**

- [ ] Cover doesn't overflow
- [ ] Chapter list scrollable
- [ ] All buttons accessible

### Scenario 4: Reader

**Path**: Open any chapter

**Important**: Chapter text should NOT scale with UI Scale!

**Verify:**

- [ ] Reader toolbar icons scale properly
- [ ] Chapter drawer items scale
- [ ] TTS controls scale
- [ ] **Chapter text size unchanged** (controlled by separate textSize setting)

**To test chapter text scaling:**

1. Reader settings → Text Size (separate slider)
2. This should scale ONLY the chapter content, not UI elements

### Scenario 5: Dialogs & Modals

**Path**: Various → Any dialog

**Test:**

- [ ] TTS Exit Dialog (stop TTS while scrolled away)
- [ ] Category dialogs (More → Categories)
- [ ] Filter/sort dialogs

**At 20% scale:**

- [ ] Dialog content readable
- [ ] Buttons tappable

**At 150% scale:**

- [ ] Dialog fits on screen
- [ ] No button overlap
- [ ] Scrollable if needed

## Visual Regression Checks

### Screenshots to Compare

Take screenshots at each scale level for:

1. Library grid view
2. Novel details screen
3. Chapter reader (toolbar visible)
4. Bottom navigation
5. Settings screen

Compare for:

- Consistent proportions
- No layout breaks
- Proper spacing
- Readable text

## Performance Testing

### FPS Check

1. Open Library with 100+ novels
2. Scroll rapidly
3. Switch between 20% → 100% → 150% scale
4. **Expected**: Smooth scrolling, no frame drops

### Memory Check

1. Monitor app memory usage
2. Change scale multiple times
3. **Expected**: No memory leaks, stable memory usage

## Accessibility Testing

### Screen Reader (TalkBack)

1. Enable TalkBack
2. Navigate with gestures
3. **Expected**: All elements announced correctly at all scales

### Touch Target Size

Use Android's "Show taps" developer option:

1. Enable in Developer Options
2. Tap elements at 20% scale
3. **Expected**: Minimum 48dp touch targets maintained

## Known Limitations

### Not Scaled

- Chapter text content (use textSize setting)
- WebView controls (native implementation)
- System UI (status bar, navigation gestures)

### Intentional Behavior

- Font sizes in UI do NOT scale (use Android system font size)
- Icon shapes remain consistent (only size changes)
- Aspect ratios preserved

## Bug Reporting Template

If you find issues, report with:

```
**Component**: [e.g., NovelCover]
**Scale Level**: [e.g., 20%]
**Issue**: [Description]
**Expected**: [What should happen]
**Actual**: [What actually happens]
**Screenshot**: [Attach if possible]
**Device**: [Model and Android version]
```

## Automated Testing (Future)

### Visual Regression Tests

```typescript
describe('UI Scale - NovelCover', () => {
  it('should render at 20% scale', async () => {
    await device.updateSettings({ uiScale: 0.2 });
    await element(by.id('library-screen')).tap();
    await expect(element(by.id('novel-cover'))).toBeVisible();
    await device.takeScreenshot('novel-cover-20');
  });

  it('should render at 150% scale', async () => {
    await device.updateSettings({ uiScale: 1.5 });
    await element(by.id('library-screen')).tap();
    await expect(element(by.id('novel-cover'))).toBeVisible();
    await device.takeScreenshot('novel-cover-150');
  });
});
```

### Snapshot Tests

```typescript
import { render } from '@testing-library/react-native';
import { NovelCover } from '@components';

describe('NovelCover Snapshots', () => {
  it('matches snapshot at 20% scale', () => {
    const { toJSON } = render(
      <MockProvider uiScale={0.2}>
        <NovelCover {...mockProps} />
      </MockProvider>
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
```

## Success Criteria

✅ **All scenarios pass** at all three scale levels
✅ **No visual regressions** compared to 100% baseline
✅ **Performance maintained** (60 FPS scrolling)
✅ **Accessibility preserved** (TalkBack navigation works)
✅ **No crashes or errors** during scale changes

---

**Testing Duration**: ~30 minutes for full manual test  
**Automated Test Duration**: ~5 minutes (when implemented)  
**Recommended Devices**: Phone (5-6"), Tablet (10"), Foldable (if available)
