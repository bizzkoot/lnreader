## What's New

**v2.0.12 Release** focuses on a major TTS stabilization effort, including a full refactor into a dedicated hook, comprehensive integration testing, and enhanced background navigation. It also introduces a revamped onboarding experience and automated backup features.

### ✨ Features
* **TTS Hook Refactor**: Successfully migrated TTS logic from `WebViewReader` to `useTTSController`, improving maintainability and wake-handling.
* **Enhanced Onboarding**: A new single-screen onboarding flow with real-time theme previews and clearer TTS configuration instructions.
* **Automatic Backups**: Introduced recurring automatic backups with configurable frequency and retention limits.
* **Technical Testing**: Achieved 100% hook test coverage (465 tests) and added robust integration tests for complex TTS scenarios.

### 📜 Commits
* **TTS Stabilization**: Resolved critical issues with auto-advance, download polling, button icon synchronization, and background chapter navigation. Improved wake/sleep handling and media session integration.
* **Onboarding & UI Improvements**: Redesigned the onboarding screen for better clarity and accessibility. Optimized `InfoItem` layouts for a more compact side-by-side presentation of icons and messages.
* **Backup & Restore Enhancements**: Added support for repository-based backup/restore and fixed edge cases in the restore flow that previously triggered unintended share panels.
* **Infrastructure & Reliability**: Comprehensive refactoring of the test suite, achieving full coverage for core hooks and validating complex state transitions in TTS playback.