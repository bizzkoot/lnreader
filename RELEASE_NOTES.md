## What's New

This release introduces the TTS Engine Picker, allowing users to choose between multiple installed TTS engines directly from the reader, along with improved engine stability, voice matching, and a fix for chapter titles not being announced during playback.

### ✨ Features

- **TTS Engine Picker:** New engine picker modal with native Android integration, quality badges for installed engines, and persistent selection per novel or globally
- **Auto-Prepend Chapter Title:** Automatically announces the chapter title via TTS when it is not visibly present in the chapter content

### 🐛 Bug Fixes

- **TTS Resume Playback Failure:** Fixed resume playback failure and wrong engine audio output after switching engines
- **Engine Selection Persistence:** Resolved engine selection not persisting in the modal picker across sessions
- **Engine Stability & Voice Matching:** Improved engine stability, voice matching accuracy, and reactive settings updates
- **UpdateNovelCard Margin:** Adjusted chapter list margin in update novel cards
- **Browse Screen State:** Reset screen mounted state on novel refetch to prevent stale UI

### 🛠️ Core Updates

- **Novel-Specific TTS Isolation:** Refactored TTS settings to isolate novel-specific configuration from global defaults
- **Reactive Modal Height:** TTS engine and voice picker modal height now adapts to content size

### 📜 Commits

- **TTS Engine Picker (6 commits):** Added native Android TTS engine enumeration, created engine picker modal with quality badges, integrated engine selection into reader TTS tab, fixed persistence of selected engine, made modal height reactive to content, and isolated novel-specific TTS settings from global configuration
- **Chapter Title Announcement (1 commit):** Auto-prepend chapter title to TTS content when not visibly present, ensuring chapter transitions are announced
- **UI Fixes (1 commit):** Adjusted UpdateNovelCard chapter list margin for better readability
- **Browse Fix (1 commit):** Reset screen mounted state on novel refetch to prevent stale data display
- **Chores (2 commits):** Made pre-commit hook executable, added .java-version to gitignore

**Full Changelog**: https://github.com/bizzkoot/lnreader/compare/v2.1.0...v2.1.1
