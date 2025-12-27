# Feature Requests (Research)

This folder contains evidence-backed feature PRDs generated from competitor and trend research.

## PRD Index

| PRD                                                                                    | Status              | Priority | Tracking                                           |
| -------------------------------------------------------------------------------------- | ------------------- | -------- | -------------------------------------------------- |
| [Cross-Device Sync](2025-12-27-cross-device-sync.md)                                   | Proposed → Planning | P1       | [impl/cross-device-sync/](impl/cross-device-sync/) |
| [TTS Sleep Timer + Smart Rewind](2025-12-27-tts-sleep-timer-and-smart-rewind.md)       | Proposed → Planning | P0       | [impl/tts-sleep-timer/](impl/tts-sleep-timer/)     |
| [Reader Notes & Labeled Bookmarks](2025-12-27-reader-notes-and-labeled-bookmarks.md)   | Proposed            | P1       | -                                                  |
| [Reader Quick Settings Sheet](2025-12-27-reader-quick-settings-sheet.md)               | Proposed            | P2       | -                                                  |
| [Library Continue Reading Surface](2025-12-27-library-continue-reading-surface.md)     | Proposed            | P2       | -                                                  |
| [E-Ink Mode](2025-12-27-e-ink-mode.md)                                                 | Proposed            | P2       | -                                                  |
| [Backup/Restore Performance](2025-12-27-backup-restore-performance-and-reliability.md) | Proposed            | P1       | -                                                  |

## Implementation Tracking Structure

Each active implementation gets its own folder under `impl/` with:

```
impl/<feature-name>/
├── README.md              # Status overview, quick links
├── implementation.md      # Detailed file-level plan with code changes
├── in-progress.md         # Current work session notes, blockers
├── completed.md           # Finished items with verification results
└── verification.md        # Test results, screenshots, success/failure logs
```

### Status Definitions
- **Proposed**: PRD created, awaiting prioritization
- **Planning**: Implementation plan being drafted
- **In Progress**: Active development
- **Verification**: Testing and validation
- **Complete**: Shipped and verified

## Sources (research)

- Mihon: https://github.com/mihonapp/mihon
- TachiyomiSY: https://github.com/jobobby04/TachiyomiSY
- Komikku: https://github.com/komikku-app/komikku
- Readest: https://github.com/readest/readest
- Android accessibility guidance: https://developer.android.com/guide/topics/ui/accessibility/apps
- Material 3 Bottom Sheets: https://m3.material.io/components/bottom-sheets/overview
