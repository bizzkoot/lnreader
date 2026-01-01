# Library “Continue Reading” Surface

## Metadata
- Status: Proposed
- Priority: P1 (Retention)
- Effort: S–M
- Target Release: TBD

## Problem Statement
Returning to the last active novel/chapter should be one tap. Many reader apps treat “Continue” as a primary entry point.

Evidence:
- Competitor reader ecosystems consistently emphasize fast return to current reading item; this is a common retention pattern.

## Proposed Solution
Add a pinned “Continue Reading” section at the top of Library (and optionally Home/Discover):
- Show last 1–3 currently-reading items with cover, title, last chapter, and progress.
- Tap opens directly to the last chapter + position.

## Requirements

### Functional
- Source from reading history / last opened novel.
- Update immediately when user exits reader.
- Hide if no history.

### UI
- Compact horizontal list or stacked cards.
- Include a “See all history” link.

### Technical
- Add a lightweight selector in the library screen using existing History queries.

## Success Metrics
- Increased daily opens that go directly to reader.
- Reduced time-to-first-read after app launch.

## Implementation Plan
1. Identify history query + extend to fetch last chapter + progress.
2. Add Continue section component.
3. Wire navigation to reader with restored position.
