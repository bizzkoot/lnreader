## What's New

This release brings major improvements to TTS functionality with comprehensive Bluetooth and wired headset support, enhanced auto-stop capabilities with screen state detection, and important Android platform fixes. The update also includes legacy backup compatibility for upstream synchronization and adopts multiple EPUB rendering improvements.

### ✨ Features

- **Bluetooth & Headset Media Controls:** Full support for Bluetooth and wired headset media buttons with silent audio workaround, enabling seamless TTS control from external devices
- **Enhanced Auto-Stop System:** Redesigned sleep timer into a comprehensive auto-stop system with screen state detection, configurable triggers (minutes/paragraphs/end of chapter), and smart rewind
- **Legacy Backup Support:** Added upstream-compatible legacy backup format to maintain compatibility with main LNReader repository
- **Volume Button Offset:** Configurable volume button scroll offset setting with improved UI controls
- **Features Screen:** New detailed guidance screen to help users discover and understand app capabilities

### 🐛 Bug Fixes

- **MainActivity Startup Crash:** Resolved critical crash on app launch caused by accessing window.insetsController before super.onCreate()
- **TTS Progress Persistence:** Fixed stale closure bug preventing reliable progress saves across app restarts
- **Media Notification Sync:** Eliminated notification flicker during TTS seek operations and kept media notification state synchronized
- **TTS Position Restore:** Fixed position restoration when returning to reader after pausing from notification
- **Auto-Stop Bugs:** Resolved three critical auto-stop bugs including race conditions and state management issues

### 🛠️ Core Updates

- **EPUB Improvements:** Adopted upstream PRs #1573 (style preservation) and #1599 (HTML tag stripping in summaries)
- **Android Platform Fixes:** Resolved Gradle deprecation warnings and API compatibility issues for Android SDK 35+
- **Developer Experience:** Added `clean:android` script for quick Android build cleanup and updated documentation
- **Upstream Synchronization:** Merged volume button offset setting from upstream (#1685)

### 📜 Commits

- **TTS Enhancements:** Complete Bluetooth/wired headset media button support implementation ([6a1aed1](https://github.com/bizzkoot/lnreader/commit/6a1aed1f45439afe65946c87359d0b4a03b4850c), [823d0c3](https://github.com/bizzkoot/lnreader/commit/823d0c3dc276a7015ca3eeed5cc09c1173faf8b6)), redesigned sleep timer into Auto-Stop system with screen state detection ([f593fd0](https://github.com/bizzkoot/lnreader/commit/f593fd0668eab76276b566f704e58408bff7eab1), [4d8e340](https://github.com/bizzkoot/lnreader/commit/4d8e3400e717dea9152d94a291f3aed843bb735c), [0a2756e](https://github.com/bizzkoot/lnreader/commit/0a2756ee5d69ebf220f6e6fb5d749358c27d25f8))
- **Bug Fixes:** Resolved stale closure in TTS progress save ([5bcb6a9](https://github.com/bizzkoot/lnreader/commit/5bcb6a9f6914b5e1df408640d9c4229bdf8ed8eb)), fixed notification state sync and flicker ([00f2328](https://github.com/bizzkoot/lnreader/commit/00f2328ebeae374393bd6c7a10ce58e78e045a49), [9ab5b1a](https://github.com/bizzkoot/lnreader/commit/9ab5b1acad4d5e3551ee713faefe753c798b0d57), [6af3f6c](https://github.com/bizzkoot/lnreader/commit/6af3f6c338f575e2ad307c7a403569b2bdde7a6d)), restored position on notification return ([126363f](https://github.com/bizzkoot/lnreader/commit/126363f054cb4743dafa4be3ae2044a7370ada81)), fixed three auto-stop bugs ([89b8e20](https://github.com/bizzkoot/lnreader/commit/89b8e2054a88695c5fa414d405c8e70ba5f084f0)), resolved MainActivity startup crash ([07f7b42](https://github.com/bizzkoot/lnreader/commit/07f7b424c5531f55dfbf5af4940f89bb74483ea0))
- **Platform Updates:** Fixed Android Gradle and API deprecation warnings ([ab193e2](https://github.com/bizzkoot/lnreader/commit/ab193e22ca95d1e00f5129e699910bad71665b12)), adopted EPUB improvements from upstream PRs #1573 and #1599 ([200ac43](https://github.com/bizzkoot/lnreader/commit/200ac435ed51adbc627b88e899494edb43d1dfce)), merged upstream volume button offset setting ([a19a0fa](https://github.com/bizzkoot/lnreader/commit/a19a0fa5fff2b53bcf11229b353ba30812d7a43e), [467a97d](https://github.com/bizzkoot/lnreader/commit/467a97dcf7f59c7be76e6d8a88806a02c6e81b18))
- **Features & UX:** Added Features screen with detailed guidance ([bf1726b](https://github.com/bizzkoot/lnreader/commit/bf1726b07a28440e514045d634fccbc3a2ba7289)), implemented legacy backup for upstream compatibility ([74d16ea](https://github.com/bizzkoot/lnreader/commit/74d16ea95cb43fcb2bff2dde3e5cae00bb83776b)), added auto-stop controls to reader bottom sheet ([0a2756e](https://github.com/bizzkoot/lnreader/commit/0a2756ee5d69ebf220f6e6fb5d749358c27d25f8))
- **Testing & Docs:** Implemented comprehensive AutoStopService test coverage ([caf796e](https://github.com/bizzkoot/lnreader/commit/caf796eac64ffbbc1d3322b420c55a839c751b92)), added skipped auto-stop mode tests ([9cc211d](https://github.com/bizzkoot/lnreader/commit/9cc211db6a13f1d28424ccb8f8e7f36796c2caaf)), documented upstream synchronization ([8fe0b83](https://github.com/bizzkoot/lnreader/commit/8fe0b831ff2286c1dfafc0c37dfb557a85a8da2e)), refactored AI agent guidance ([953f1ea](https://github.com/bizzkoot/lnreader/commit/953f1ea292162f8439a6f74e6ccc45d02ab8a1a6)), preserved feature request docs ([bd8bccd](https://github.com/bizzkoot/lnreader/commit/bd8bccd6d7ee91f9022e4f014b881ecedc4c554a)), added commit analysis ([91cf7f2](https://github.com/bizzkoot/lnreader/commit/91cf7f239161cbdaad752a2a041e307008fdf6db))
- **Chore:** Added clean:android script and updated docs ([536611b](https://github.com/bizzkoot/lnreader/commit/536611b062d01b34b476956878ee05a8e9a5849b)), added MCP server cache ignore rules ([7c57b74](https://github.com/bizzkoot/lnreader/commit/7c57b742121f3f2e2f68dc754f437bd3793ec0fc))

**Full Changelog**: https://github.com/bizzkoot/lnreader/compare/v2.0.13...v2.0.14
