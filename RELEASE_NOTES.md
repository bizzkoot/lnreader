## What's New

**v2.1.6 hardens the v2.1.5 roadmap into a reliable daily driver — background TTS listening time is now reconciled against a native speaking clock, in-chapter search preserves the DOM with virtualized navigation, RTL paging and gestures are fully mirrored, and slider/progress persistence races are closed.**

### ✨ Features

- **Background TTS Time Reconciliation**: Native monotonic speaking clock in `TTSForegroundService` (exposed via `getTtsPlaybackClock`) tops up listening time the JS thread missed under Doze — Statistics → Time finally reflects background listening.
- **In-Chapter Search UX**: Animated return-to-position banner with hardware-back dismissal, per-novel return behavior setting, status-bar-aware searchbar, and virtualized match navigation that preserves the DOM instead of cloning it.
- **Stats Polish**: Sub-minute seconds resolution, auto-refresh on screen focus, and a reading-chapters stat powering true reading velocity.
- **RTL Completion**: Mirrored paging, tap zones, swipe direction, and navigation icons for ar/he/fa/ur, plus RTL-safe CSS and touch binding.

### 🛠 Fixes & Hardening

- **Time Tracking Integrity**: Heartbeat-based background tracking with Doze drift capping, periodic checkpoints, and migration 007 (`idx_novel_inLibrary`) for fast library-scoped aggregates.
- **Slider & Progress Races**: `sliderDragState` event bus ends bottom-sheet TabView swipe conflicts, tap-to-seek preserved, and a flush guard stops 0% progress overwrites on chapter load.
- **Build Packaging**: CommonJS Metro bundle resolution configured in Gradle for reliable release packaging.

### 📜 Commits

- **TTS Listening Reconciliation**: Added native speaking clock with flush boundaries on speak/batch calls (26348b2c1) — background listening recovered on foreground/unmount, wall-clock capped, fail-open when unbound; covered by Robolectric clock tests plus 4 reconcile suites.
- **Search UX & Virtualization**: Shipped return banner + behavior setting (74404ed43), status-bar inset (fbf73b4e3), back-press dismissal (dd53eeb3e), and bounded tree-walk highlighting with 200-match virtual window and anchor fixes (a11e42bf1).
- **RTL Hardening**: Fixed paging/gesture mirroring, touch rebinding, and early progress flush (111fa901a), then completed navigation mirroring and isolated category-only update times (a8895e63c).
- **Stats & Time Tracking**: Hardened heartbeat tracking, Doze capping, checkpoints, and migration 007 (09a966a35); added chapters stat for velocity (cf76883ae); added seconds resolution with focus refresh (317e6e1ce); preserved background TTS time across sleep (b30abcc12).
- **Gesture Arbitration**: Hardened slider responder with drag-state bus and progress flush guard (d16880e17), satisfied lint (05c5e24f4), and preserved tap behavior with flush-guard coverage (31e0f1d54).
- **Build & Docs**: Configured Metro CJS bundle resolution in Gradle (9e737c9f4) and refreshed agent context with post-merge hardening status (b7bd96318).

> **Full diff:** https://github.com/bizzkoot/lnreader/compare/v2.1.5...v2.1.6 — 16 commits, zero regressions (1688 tests passing).
