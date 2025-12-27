# Reader Quick Settings Sheet (Two-Stage Bottom Sheet)

## Metadata
- Status: Proposed
- Priority: P1 (UX)
- Effort: S–M
- Target Release: TBD

## Problem Statement
LNReader already has a powerful reader bottom sheet, but common in-session adjustments (text size, theme, TTS toggle) can be too many taps. Material guidance supports bottom sheets as a secondary surface with clear affordances.

Evidence:
- Material 3 Bottom sheets overview: https://m3.material.io/components/bottom-sheets/overview

## Proposed Solution
Implement a two-stage bottom sheet:
- **Quick** (first snap point): text size +/- (or slider), theme toggle, line height +/- (optional), TTS play/pause.
- **Full** (second snap point): existing full settings tabs as-is.

## Requirements

### Functional
- Preserve existing settings and state.
- Allow “Quick” to be disabled (power users who dislike it).

### UI
- First snap point has clear grouping, large touch targets.
- Ensure accessible labels for icon actions.

### Technical
- Reuse current bottom sheet component; add a small “QuickControls” section rendered above tabs.

## Success Metrics
- Reduced average taps to change text size/theme.
- Increased use of in-session settings.

## Implementation Plan
1. Locate current reader bottom sheet component and wrap with a quick area.
2. Add quick controls with existing state hooks.
3. Add setting toggle + A11y labels.
