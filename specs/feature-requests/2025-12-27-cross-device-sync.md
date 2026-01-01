# Cross-Device Sync (Progress + Library State)

## Metadata
- Status: Proposed
- Priority: P1 (Strategic)
- Effort: L (requires backend / provider integration)
- Target Release: TBD

## Problem Statement
Users increasingly read across multiple devices. Today LNReader supports backup/restore, but that’s not the same as continuous sync. Competitor ecosystems show repeated demand for progress syncing and consistent read state.

Evidence:
- Readest issue: progress/notes not syncing between PC and mobile (user expectation of sync): https://github.com/readest/readest/issues/1356
- Mihon issue: syncing reading progress/tracker state: https://github.com/mihonapp/mihon/issues/236
- TachiyomiSY includes cross-device sync in releases (feature category): https://github.com/jobobby04/TachiyomiSY/releases

## Proposed Solution
Implement an opt-in Sync layer that can reconcile:
- Current chapter progress (scroll index or paragraph index for TTS)
- Read/unread per chapter
- Library entries (in library, categories)
- App settings (optional, later)

Provide at least one sync provider initially:
- **Google Drive AppData** (Android-first, minimal UX, privacy reasonable)
- Optionally later: WebDAV / self-hosted endpoint, or device-to-device export.

## Requirements

### Functional
- Sync toggle: Off by default.
- Manual sync button + automatic periodic sync.
- Conflict resolution: last-write-wins with timestamps, plus per-entity merges where safe.
- Offline-first: queue changes and sync when network available.

### Edge Cases
- Two devices editing different novels offline then coming online.
- Partial restores/sync failures.
- Account change / sign-out: keep local state, stop syncing.

### UI
- Settings > Backup/Sync: enable, account status, last sync time, sync now.
- Optional per-novel: “Prefer local” vs “Prefer remote” if conflicts.

### Technical
- Define a sync schema version.
- Store server timestamps + local modified timestamps for merge.
- Consider using existing backup serialization utilities as a starting point, but avoid device-specific keys.

## Success Metrics
- 7-day retention uplift for users with sync enabled.
- % of sync conflicts resolved without user intervention.
- Sync success rate and mean sync duration.

## Implementation Plan
1. Spike: define schema, choose provider (Drive AppData vs WebDAV). 
2. Create SyncEngine (queue, merge rules, telemetry).
3. Implement provider adapter (auth + upload/download + versioning).
4. UI + settings + sync status.
5. Beta rollout + metrics + fix conflict bugs.
