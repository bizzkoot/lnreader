# Action Tracker

This directory contains code review findings and action plans for tracking improvement work.

## Files

| File | Purpose | Last Updated |
|------|---------|--------------|
| `CODE_REVIEW_2025.md` | Comprehensive code review with detailed findings | 2025-12-24 |
| `CODE_REVIEW_ACTION_PLAN.md` | Checklist of action items with progress tracking | 2025-12-24 |

## Usage

1. **Reference the Review:** Look at `CODE_REVIEW_2025.md` for detailed analysis of each issue
2. **Track Progress:** Update checkboxes in `CODE_REVIEW_ACTION_PLAN.md` as work is completed
3. **Update Dates:** Rename files with new dates when creating fresh reviews

## Related Directories

- `../audits/` - Feature-specific audit reports
- `../FIX_PLAN_CHECKLIST.md` - Previous fix plan checklist

## Action Item States

- `[ ]` - Not started
- `[~]` - In progress
- `[x]` - Completed

## Priority Levels

- **P0 - Critical** - Must fix immediately (bugs, crashes, security)
- **P1 - High** - Should fix soon (technical debt, type safety)
- **P2 - Medium** - Consider fixing (performance, maintainability)
- **P3 - Low** - Nice to have (cosmetic, minor improvements)

## Definition of Done

Each action item is complete when:
- Code changes are implemented
- Tests are added/updated
- Type-check passes (`pnpm run type-check`)
- Lint passes (`pnpm run lint`)
- Tests pass (`pnpm test`)
- Documentation is updated (if applicable)
