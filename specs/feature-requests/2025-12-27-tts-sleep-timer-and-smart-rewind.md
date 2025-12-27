# TTS Sleep Timer + Smart Rewind

## Metadata
- Status: Proposed
- Priority: P0 (High Impact for TTS users)
- Effort: M
- Target Release: TBD

## Problem Statement
TTS is a headline feature, but long listening sessions need “player-grade” controls: a sleep timer and smart rewind after interruptions/resume.

Evidence anchors:
- Audiobook session/progress separation (enables rewind heuristics): https://context7.com/advplyr/audiobookshelf/llms.txt
- User expectations are consistent with modern audiobook players (sleep timer + resume rewind is standard behavior).

## Proposed Solution
Add a TTS “Session” layer with:
- **Sleep timer**: stop/pause after N minutes OR at end of chapter OR after N paragraphs.
- **Smart rewind**: on resume after being paused for longer than a threshold (e.g., 2–10 minutes) or after audio focus loss, rewind by N paragraphs.

## Requirements

### Functional
- Sleep timer presets: 5/10/15/30/45/60 min, end of chapter.
- Optional “fade out” by reducing TTS volume (if supported), otherwise a normal pause/stop.
- Smart rewind default: 1–3 paragraphs (configurable).
- Triggers for smart rewind:
  - Resume after interruption (phone call/audio focus loss)
  - Resume after screen-off long gap
  - App killed and restored (optional)

### UI
- Reader TTS tab: Sleep timer button with status chip (“10 min left”).
- Settings: Smart rewind toggle + amount.

### Technical
- Store session start time, last pause time, and last spoken paragraph index.
- Integrate with existing TTS foreground service and state machine without introducing invalid transitions.

## Success Metrics
- Increased average TTS session length.
- Lower “lost context after pause” feedback.

## Implementation Plan
1. Define session state fields (MMKV + DB as needed).
2. Add sleep timer scheduler tied to TTS state.
3. Implement smart rewind decision logic at resume.
4. UI controls + settings.
5. QA: background playback + wake/sleep cycles.
