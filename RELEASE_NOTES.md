## What's New

**v2.0.13 brings major reader experience improvements and comprehensive code quality enhancements.** This release introduces continuous scrolling for seamless chapter transitions, advanced TTS synchronization features including per-novel settings and dual-context stitching, and improved backup management with versioned schemas. The codebase has undergone significant refactoring with 200+ new tests and enhanced type safety across critical TTS components.

### ✨ Features

* **Continuous Scrolling:** Chapters now transition seamlessly without page breaks, with configurable stitch and transition thresholds in settings
* **Per-Novel TTS Settings:** Each novel can now have its own TTS configuration (voice, speed, pitch) that auto-loads when opening a chapter
* **TTS Stitched Chapters:** Fixed TTS restart in stitched chapters with dual-context synchronization for uninterrupted playback
* **Advanced Navigation Tab:** New reader settings tab with continuous scrolling, chapter boundary, and stitch threshold options
* **Backup Schema v2:** Implemented versioned backup system with migration pipeline and improved auto/manual backup separation

### 🐛 Bug Fixes

* **Filter FAB Crash:** Resolved crash in library filter functionality and fixed duplicate key warnings
* **EPUB TTS Sync:** Fixed chapter title synchronization at Paragraph 0 for EPUB export
* **WebView Debug Logging:** Corrected DEBUG variable scope that was causing render freeze
* **TTS-Triggered Trim:** Completed trim functionality with getChapter() reload for clean state management
* **Backup Pruning:** Fixed logic to properly separate auto and manual backup pruning

### 🔧 Code Quality

* **200+ New Tests:** Comprehensive test coverage for database queries (Category, History, Novel, Repository, Stats), TTS error paths, and backup schema validation
* **Type Safety:** Replaced `any` types with proper TypeScript types, added promise error handling to 10 unhandled promises
* **TTS State Machine:** Added `TTSState.ts` with explicit state transition validation and 26 state transition tests
* **Rate-Limited Logger:** New `@utils/rateLimitedLogger` replaces console.log calls to reduce dev log spam
* **React Native Build:** Fixed CMake autolinking issues for google-signin, edge-to-edge, and file-access modules

### 📜 Commits

* **Core TTS Enhancements:** Implemented continuous scrolling with DOM stitching, dual-context synchronization for TTS restarts in stitched chapters, per-novel TTS settings with auto-load on reader entry, and comprehensive TTS state machine with transition validation. Fixed multiple TTS race conditions and synchronization issues including scroll sync dialog enhancements.
* **Reader Experience:** Added invisible chapter transitions, auto-mark short chapters feature, configurable stitch/transition thresholds, and continuous scrolling modals. Fixed EPUB TTS synchronization with chapter title at Paragraph 0 and resolved DEBUG variable scope causing render freeze.
* **Backup System:** Implemented versioned schema v2 with migration pipeline, separated auto/manual backups with fixed pruning logic, and added comprehensive backup schema validation tests.
* **Testing Infrastructure:** Added 125+ database query tests (Category, History, Novel, Repository, Stats), TTS state transition tests (26 tests), TTSHighlight error path tests, and backup schema validation tests. Total of 200+ new tests across core services.
* **Code Quality & Type Safety:** Replaced `any` types with proper TypeScript definitions, added promise error handling to 10 unhandled promises, implemented rate-limited logger to replace console.log, fixed useEffect dependencies, and resolved lint warnings across hooks and styles.
* **Bug Fixes:** Resolved filter FAB crash, duplicate key warnings, follow/unfollow failure handling, and WebView console log property name issues.
* **Documentation:** Added JSDoc comments to TTSAudioManager, updated code review action plan with verification results, and added comprehensive specs for continuous scrolling, TTS features, and code quality audits.

---
**Full Changelog**: https://github.com/bizzkoot/lnreader/compare/v2.0.12...v2.0.13
