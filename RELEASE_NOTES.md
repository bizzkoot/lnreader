
## What's New

### v2.0.6 — 2025-12-05

**Stable, reliable TTS across sessions — this release fixes critical race conditions and background-resume issues so Text‑to‑Speech playback is predictable across chapter boundaries, device sleep/wake, and foreground/background transitions.**

### ✨ Features

- **Continuous multi-chapter playback** — TTS now reliably continues across chapter boundaries with improved paragraph highlighting and queue management.
- **Race condition & sync fixes** — fixed several timing and state-racing issues that caused premature jumps, wrong lines, and paragraph resets during screen wake and settings changes.
- **Background/foreground resilience** — addressed foreground-service issues (incl. Android 12+), improved resume behavior after interruptions, and hardened background playback logic.
- **Live settings & sync flow** — reading-mode TTS settings now apply live; added an auto-retry + sync dialog to recover from out-of-sync states.
- **Convenience & polish** — LOCAL/NETWORK voice badges, language-first voice labels, auto-download for remaining chapters, and UI/interaction improvements in the reader TTS experience.

### 📜 Commits

Range: `v2.0.5..HEAD` — 27 commits

Detailed technical summary:

- **Core architecture:** Heavy refactors to the TTS queue and playback controller to support continuous cross-chapter playback, consistent paragraph highlighting, and deterministic resume points.
- **Race & timing hardening:** Multiple fixes to prevent stale closures and race conditions during chapter transitions, settings changes, and screen wake — eliminating premature chapter/paragraph jumps.
- **Background service fixes:** Resolved Android foreground-service edge cases and shaped better recovery paths for background → foreground transitions (Android 12+ fixes included).
- **Sync & retry flow:** Implemented live TTS settings propagation, an auto-retry mechanism for intermittent failures, and a sync dialog to manually reconcile out-of-sync playback/reader state.
- **UX, diagnostics, and tests:** Improved voice labeling and badges, added small UX polish across the reader, and included tests and simulators to reproduce refill/auto-download scenarios.