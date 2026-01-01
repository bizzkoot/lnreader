# Backup/Restore Performance + Reliability Improvements

## Metadata
- Status: Proposed
- Priority: P0 (Trust / Data Safety)
- Effort: M–L
- Target Release: TBD

## Problem Statement
Backups are a trust feature: users expect restore to be fast, complete, and safe. Competitors frequently receive issues about restore speed, corruption, and missing data.

Evidence:
- Komikku issue: “Optimize restore backup” (restore performance pain): https://github.com/komikku-app/komikku/issues/2
- Readest release notes: “Improved backup handling to prevent file corruption” (reliability focus): https://github.com/readest/readest/releases
- Mihon issue: “Backup support for custom cover” (backup completeness expectations): https://github.com/mihonapp/mihon/issues/16

## Proposed Solution
Improve backup/restore along three axes:
1) **Completeness**: clear inclusion list (library, categories, history, settings, custom assets like covers).
2) **Reliability**: checksums + schema/versioning + transactional restore.
3) **Performance**: streaming restore, incremental parsing, progress UI.

## Requirements

### Functional
- Backup format versioning.
- Restore validation step:
  - Verify schema version compatibility.
  - Validate checksum(s).
  - Report what will be restored (counts).
- Restore strategy:
  - Transactional import into DB (roll back on failure).
  - MMKV restore with an allowlist/denylist for device-specific keys.

### UX
- Restore progress UI: % and current phase (DB, settings, files).
- Completion summary: restored counts + any skipped items.
- Clear messaging about what is and isn’t included.

### Technical
- Add manifest file in backup with:
  - app version, schema version
  - counts per entity
  - checksums of payload files
- Use streaming I/O where possible to avoid memory spikes.

## Success Metrics
- Restore success rate.
- Mean restore duration for typical backups.
- Reduced support issues about broken restore.

## Implementation Plan
1. Audit current backup payload (DB + MMKV + files).
2. Add backup manifest + checksums.
3. Implement transactional restore + progress reporting.
4. Add restore summary.
5. Add regression tests around versioning and key exclusions.
