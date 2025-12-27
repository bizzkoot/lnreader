# TTS Auto-Stop (Redesign from Sleep Timer) - Implementation Tracking

**PRD**: [2025-12-27-tts-sleep-timer-and-smart-rewind.md](../2025-12-27-tts-sleep-timer-and-smart-rewind.md)  
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

Replace the legacy “Sleep Timer” concept with a simpler, more reliable **Auto-Stop** playback limit.

Auto-Stop stops playback after a user-selected limit:
- **Time**: 15m / 30m / 45m / 60m
- **Chapters**: 1 / 3 / 5 / 10
- **Paragraphs**: 5 / 10 / 15 / 20 / 30
- **Off**: No limit (continuous)

This redesign intentionally removes screen-off / device-state conditions. The limit applies whether the screen is on or off.

## Key Files

| File                                                              | Purpose                                  |
| ----------------------------------------------------------------- | ---------------------------------------- |
| `src/hooks/persisted/useSettings.ts`                              | Auto-Stop settings schema + defaults     |
| `src/services/tts/AutoStopService.ts`                             | [NEW] Auto-Stop logic (time/chap/para)   |
| `src/screens/reader/hooks/useTTSController.ts`                    | Integrate callbacks & trigger points     |
| `src/screens/settings/SettingsReaderScreen/tabs/AccessibilityTab.tsx` | Global “Auto Stop” UI (below Background playback) |

Note: Reader bottom-sheet UI can optionally be added later, but the required placement is in Global TTS settings.
