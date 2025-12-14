## What's New

This release brings important updates from the upstream LNReader project, including enhanced translation support and critical plugin settings improvements. The merge integrates the latest internationalization updates and fixes a significant bug where plugin settings would fail to display when new configuration options were added through updates.

### ✨ Features

* **Backup Management**: Added default backup folder functionality with an intuitive folder picker interface, improving user control over backup storage locations
* **Translation Updates**: Integrated comprehensive translation updates from upstream, enhancing multilingual support across the application

### 🐛 Bug Fixes

* **Plugin Settings Display**: Fixed critical issue where plugin settings would not appear when updates introduced new configuration options (Closes upstream #1674)

### 📜 Commits

* **Upstream Integration**: Successfully merged changes from upstream/master including translation updates (#1631) and plugin settings fix (#1674), ensuring compatibility with the main LNReader project while maintaining custom enhancements
* **Backup Feature Enhancement**: Implemented default backup folder selection with folder picker UI, streamlining backup management workflow
* **Memory Bank Updates**: Updated memory records for PR #7 merge tracking and release documentation improvements
* **Release Documentation**: Added version comparison link for v2.0.10 for better change tracking

**Full Changelog**: https://github.com/bizzkoot/lnreader/compare/v2.0.10...v2.0.11