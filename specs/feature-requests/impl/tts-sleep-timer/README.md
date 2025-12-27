# TTS Sleep Timer + Smart Rewind - Implementation Tracking

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

Add TTS "player-grade" controls:
- **Sleep Timer**: Stop/pause after N minutes, end of chapter, or N paragraphs
- **Smart Rewind**: On resume after long pause or interruption, rewind N paragraphs

## Key Files

| File                                                               | Purpose                        |
| ------------------------------------------------------------------ | ------------------------------ |
| `src/hooks/persisted/useSettings.ts`                               | Add settings types + defaults  |
| `src/screens/reader/hooks/useTTSController.ts`                     | Integrate timer + rewind logic |
| `src/services/tts/SleepTimer.ts`                                   | [NEW] Sleep timer scheduler    |
| `src/screens/reader/components/ReaderBottomSheet/ReaderTTSTab.tsx` | UI controls                    |
