# Reader Notes + Labeled Bookmarks

## Metadata
- Status: Proposed
- Priority: P0 (Quick Win / High Impact)
- Effort: M
- Target Release: TBD

## Problem Statement
Users want to remember context (what happened, why they stopped) and organize key moments. Competitors consistently add notes and richer bookmark metadata.

Evidence:
- Mihon releases mention “user-defined manga notes” (notes as a first-class feature): https://github.com/mihonapp/mihon/releases
- Mihon issue: “Add Note Label Feature to Bookmarks” (bookmark labels are explicitly requested): https://github.com/mihonapp/mihon/issues/1509

## Proposed Solution
Add two related but distinct features:
1) **Novel note**: a free-form note attached to a novel (series-level).
2) **Bookmark note/label**: bookmarks can have an optional label and note.

## Requirements

### Functional
- Create/edit/delete novel note.
- Create bookmark at current position (existing) + add label/note.
- List bookmarks per novel, sortable by chapter and created time.
- Jump to bookmark location in reader.

### Edge Cases
- Bookmark within downloaded vs streamed chapters.
- If paragraph indexes change (plugin updates), fall back to closest match (chapter + percent).

### UI
- Novel detail screen: “Notes” section (collapsed by default).
- Reader: bookmark button opens a small modal: label (optional), note (optional).
- Bookmark list: show chapter title, % / paragraph, label.

### Technical
- DB migration: add `novel_note` field to Novel table, and bookmark metadata fields (label, note, created_at).
- Ensure export/backup includes notes.

## Success Metrics
- % of active readers creating at least one note/bookmark per week.
- Reduction in “lost my place” / “need better bookmarks” issues.

## Implementation Plan
1. Add DB fields + queries.
2. Add UI surfaces (Novel detail + Reader bookmark modal).
3. Add bookmark list improvements.
4. Add backup/restore integration.
