## What's New

**v2.1.5 consolidates the post-2.1.4 roadmap into a polished release — In-Chapter Search, RTL layout, reading analytics with charts, and scheduled background updates land alongside deep hardening of progress persistence, DoH networking, and upstream sync integrity.**

### ✨ Features
* **In-Chapter Search**: Non-destructive WebView search engine (`window.readerSearch`), live match counters, steppers, and MD3 `ReaderSearchbar` with hardware-back dismissal.
* **RTL Language Support**: Native + WebView layout direction for ar/he/fa/ur with CSS alignment fixes and inset handling.
* **Reading Time Tracking**: Dual-mode foreground tracking (inactivity pause + TTS synergy), `ReadingSession` table (migration 006, cascading deletes), and `useTimeTracking` listener.
* **Statistics Overhaul & Charts**: Raw-SQL aggregates in `StatsQueries`, Overview/Time/Plugins tabs, `react-native-svg` donut distribution, genre taxonomy exploration, and reading velocity metrics.
* **Scheduled Library Updates**: Persisted interval settings with `ServiceManager` opportunistic foreground checks and task deduplication.
* **Reader UX Polish**: Tab swipe gestures enabled with slider-drag protection, UI scale live-dragging, and tab indicator/appbar inset fixes.

### 🛠 Fixes & Hardening
* **Progress Persistence**: Tightened and hardened background progress flush (3 commits) — reliable saves when app backgrounds, regression-tested.
* **Plugin & Queue Reliability**: Deterministic FIFO queues with reset gate, stale update badge clearing, and `refreshPlugins` cold-start rejection handling.
* **Networking & Backups**: DoH routing for remote backups, streamed backup archive completion, and hardened archive/restore input validation.
* **UI & Gestures**: Fixed RTL/scheduler/inset issues, UI scale slider range/sync, skeleton loading color neutralization, and library fetch stuck-loading prevention.
* **Novel & Reader Fixes**: Preserved TTS paused paragraph, stabilized update-card navigation deps, select-all across lazy batches, and category-to-library addition.

### 🔄 Upstream Sync
* **Merge Waves 1-3**: Consolidated CSV parsing, relaxed summary limit, predicate-split clarification (M15 Option B), and deferred audit nit remediation (H5/M12/M13/LOW-7/9/10).
* **Plugin & i18n**: Repository enable/disable controls (#1628), plugin selector extraction, and translation restoration across locales.
* **Media & Content**: EPUB image-format/cover support (#1622/#1946/#1948), novel cover image headers (#1977), and media session test activation.

### 📜 Commits

* **Core Reader & Analytics**: Added in-chapter search (932638119), RTL support (6ddfe3d2e), reading time tracking (cde0aa1ff), stats overhaul with charts (caa1645cd), scheduled updates (8fecb06a9), and tab-gesture/slider safeguards (4e6feb8cc) — completing the upstream feature roadmap.
* **UI & Settings Polish**: Fixed UI scale slider range and live sync (4dd63579b), tab indicator/insets (296e6492c), hardening of RTL/scheduler/insets (384cdef45), and analytics UI dual-mode polish (e00cd22d9).
* **Progress & Persistence Hardening**: Tightened background progress saves (653a9e9f9), hardened flush logic (5baef20a6), and added background flush regression test (d090bef38) plus audit-driven validation/gesture fixes (710249981, 25a5186bd).
* **Plugin / DB / Queue Stability**: Made FIFO queues deterministic (29d20cd4e), extracted plugin selectors and cleared stale badges (06852a6a8), and consolidated DB CSV parsing with docs alignment (82ab55b7f, da8110cec).
* **Networking, Security & Backups**: Routed remote backups through DoH (64be3eef5), finished streamed archives (d4c5525bc), wired DoH with restore hardening (ffddaa1b5), and hardened archive/restore inputs (1dea15cad).
* **Tests & Coverage**: Added minimal search/RTL coverage (91011becd), reading velocity/navigation regressions (3466bfecc), and closed harden-commit gaps for plugins/db/epub with harden-commit burn-down fixtures (a54ddae1c, 54b36d5da, daa0b204d).
* **Upstream & Housekeeping**: Pulled 12+ upstream fixes (library loading, DB freeze, EPUB covers, translations, navigation deps) from `lnreader/lnreader`, recorded sync waves and POV audits, and documented features/roadmap (433830717, 6b7b213bb, ad242c988, 02f0127de — 55 commits since v2.1.4).

> **Full diff:** https://github.com/bizzkoot/lnreader/compare/v2.1.4...v2.1.5 — 55 commits, zero regressions (1628 tests passing).
