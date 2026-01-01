# Cross-Device Sync - Implementation Tracking

**PRD**: [2025-12-27-cross-device-sync.md](../2025-12-27-cross-device-sync.md)  
**Status**: 📋 Planning  
**Started**: 2025-12-27  

---

## Quick Links

| Document                               | Purpose                    |
| -------------------------------------- | -------------------------- |
| [implementation.md](implementation.md) | Detailed file-level plan   |
| [in-progress.md](in-progress.md)       | Current work session notes |
| [completed.md](completed.md)           | Finished items             |
| [verification.md](verification.md)     | Test results               |

---

## Summary

Implement opt-in sync layer for cross-device reading state synchronization:
- **Progress sync**: Chapter progress, scroll position, TTS paragraph index
- **Library sync**: Novels in library, categories, read/unread states
- **Provider v1**: Google Drive AppData (reuse existing Drive auth)

## Key Files

| File                                                  | Purpose                                 |
| ----------------------------------------------------- | --------------------------------------- |
| `src/services/sync/types.ts`                          | [NEW] Schema, entity types, timestamps  |
| `src/services/sync/SyncEngine.ts`                     | [NEW] Queue, merge rules, orchestration |
| `src/services/sync/providers/DriveAppDataProvider.ts` | [NEW] Google Drive adapter              |
| `src/services/sync/local/export.ts`                   | [NEW] DB/MMKV → sync payload            |
| `src/services/sync/local/import.ts`                   | [NEW] Sync payload → DB/MMKV            |
| `src/screens/settings/SettingsBackupScreen/index.tsx` | Add sync UI section                     |
| `src/services/backup/utils.ts`                        | Reference for backup patterns           |
