## What's New

This release delivers the **Unified Visible Text & TTS Cleanup** (issue #19) — one declarative ruleset now governs both the on-screen text and TTS audio, eliminating the need to maintain two separate cleanup configs. It also brings a sweeping **Material 3 UI modernization** (dynamic Material You colors, MD3 sliders, M3 top tab indicators, standardized bottom sheets), new **Kitsu tracker support**, faster library updates, smarter reader navigation, and a major round of **database reliability fixes** hardened during the 52-commit merge verification.

### ✨ Features

- **Unified Visible Text & TTS Cleanup (issue #19):** The declarative JSON ruleset now applies to the visible DOM as well as TTS audio — cleaned display text while keeping paragraph indexing count-preserving so TTS always reads pristine, fully-cleaned text
- **Material 3 UI Overhaul:** Dynamic Material You color theming, MD3 slider replacing the community slider (no more post-release flicker), M3 top tab indicators, and standardized bottom sheet UX with modernized menu styling
- **Kitsu Tracker Support:** New tracker integration with request restoration on submit and null-safe chapter progress handling
- **Faster Library Updates:** Parallel updates across sources, configurable chapter download cooldown, and skip-version update notifications
- **Reader & Novel Enhancements:** Jump to first unread chapter via the read button and FAB, unloaded chapters load on demand in the jump modal and drawer, more novel statuses and icons
- **EPUB Improvements:** Chapter numbers in EPUB chapter titles, range export fixes, and sanitized EPUB filenames

### 🛡️ Robustness & Reliability

- **Database Hardening:** Exclusive transactions with awaited `runAsync`, julianday trigger migration (004), date-correct library updates and sorting, numerically stable chapter page ordering, scoped download deletion, and preserved default categories after reordering
- **Build System Fixes:** `expo-material3-theme` patched for AGP deprecations (Gradle namespace + `abortOnError`)
- **Stability Fixes:** Reader table overflow and white drawer seam prevention, bottom nav alignment with M3, crash-free native file operations, corrected notification throttling, and TTS quote-stripping in normalized text

### 📜 Commits

- **Core Updates**: Unified the visible-text and TTS cleanup rulesets (issue #19), resolving 9 audit findings from the 52-commit merge verification; refactored the theme layer to a context-based provider with ID migration
- **UI Polishing**: Rolled out Material 3 across the app — dynamic Material You colors, MD3 slider (flicker-free), M3 top tab indicators, standardized bottom sheets, modernized menus, and stable browse tab bar with capped modal height
- **New Features**: Added Kitsu tracker support, parallel library updates, skip-version update notifications, configurable download cooldown, jump-to-first-unread via read button/FAB, on-demand chapter loading in jump modal/drawer, chapter numbers in EPUB titles, and additional novel statuses/icons
- **Bug Fixes**: Hardened the database layer (exclusive transactions, julianday trigger migration, date-correct updates/sorting, order-stable chapter pages, download deletion scoping, category preservation); fixed reader table overflow, white drawer seam, slider flicker, tracker search restoration, and crash-prone native file operations
- **Build & Testing**: Patched `expo-material3-theme` for AGP deprecations, added type-safe fixtures for download deletion tests, and restored chapter progress from the database on reader open

**Full Changelog**: https://github.com/bizzkoot/lnreader/compare/v2.1.3...v2.1.4
