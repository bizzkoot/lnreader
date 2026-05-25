## What's New

This release introduces advanced TTS gesture controls with interactive visual feedback, significant WebView performance optimizations to eliminate unnecessary reloads, enhanced TTS engine and voice picker UX with auto-dismiss timers, and comprehensive documentation updates.

### ✨ Features

- **Advanced Button Gestures:** Hold-to-wait logic for gesture distinction, vertical swipe in offset mode for highlight adjustment, interactive visual feedback with amber/teal glows and floating badge, haptic feedback integration, and discoverability hints with gesture hint toggle in reader settings
- **Auto-Refresh Voice List on Engine Switch:** Voice list now automatically reloads when switching TTS engines in settings, ensuring accurate voice availability display
- **Enhanced Picker UX:** Both EnginePickerModal and VoicePickerModal now feature 2-second auto-dismiss timers with scroll-aware pause/resume to prevent accidental dismissals during navigation

### 🐛 Bug Fixes

- **WebView Reload on Highlight Offset Gesture:** **CRITICAL FIX** - Eliminated WebView page reload when adjusting paragraph highlight offset via gesture controls. Previously, `paragraphHighlightOffset` in `memoizedHTML` dependency array triggered full WebView reload on every gesture step
- **TTS Button State Desync:** Fixed TTS play/pause icon showing incorrect state after offset adjustments. The WebView reload was resetting JavaScript execution context, causing button to revert to default state while native TTS remained active
- **Haptic Feedback Setting Reload:** Adjusting haptic feedback setting no longer causes WebView reload. Setting now updates dynamically via useEffect + injectJavaScript

### 🛠️ Core Updates

- **Dynamic WebView Context Updates:** Refactored `paragraphHighlightOffset` and `disableHapticFeedback` to update WebView context dynamically via useEffect hooks instead of triggering full page reloads
- **Gesture System Architecture:** Implemented sophisticated gesture detection system in core.js with touch event listeners, state machine for hold/swipe detection, and visual feedback system
- **Scroll-Aware Dismissal Logic:** Enhanced modal UX with intelligent auto-dismiss timers that pause during user scrolling to prevent accidental closures

### 📚 Documentation

- **Features Screen Updates:** Added comprehensive documentation for TTS Engine Picker configuration and Advanced Button Gestures (tap, hold, swipe, drag interactions) in FeaturesScreen
- **README Enhancements:** Updated feature table and Getting Started section with gesture controls documentation

### 📜 Commits

- **Advanced Button Gestures (0b4bcf32c):** Implemented sophisticated gesture system with hold-to-wait logic (500ms delay), vertical swipe for highlight offset adjustment (1px per 10px movement), interactive visual feedback system with amber/teal glows and floating badge, haptic feedback integration, and discoverability hints
  - **Files Modified:** 8 files changed, 540 insertions(+), 68 deletions(-)
  - **Key Files:** core.js (+460 lines, gesture system), tts.css (+57 lines, visual feedback), ReaderTTSTab.tsx (+16 lines), AccessibilityTab.tsx (+11 lines, gesture hint toggle), WebViewReader.tsx (+53 lines)
  - **Known Issues:** Documented page refresh on offset gesture and button state desync (subsequently fixed in commit 327cd6e59)

- **WebView Reload Prevention (327cd6e59):** Fixed critical WebView reload issue by removing `paragraphHighlightOffset` from `memoizedHTML` dependency array, implementing dynamic updates via useEffect + injectJavaScript hook, and synchronizing `disableHapticFeedback` setting without page reload
  - **Files Modified:** 2 files changed, 43 insertions(+), 3 deletions(-)
  - **Key Files:** WebViewReader.tsx (+32 lines, dynamic sync), AGENTS.md (+14 lines, documentation)
  - **Impact:** Gesture controls now operate smoothly without disrupting WebView state or TTS playback

- **Voice List Auto-Refresh (ffa6fa0e7):** Added `onEngineReady` event listener to reload voices when TTS engine switches, implemented 2-second auto-dismiss timers in both EnginePickerModal and VoicePickerModal with scroll-aware pause/resume logic
  - **Files Modified:** 3 files changed, 110 insertions(+), 13 deletions(-)
  - **Key Files:** EnginePickerModal.tsx (+52 lines), VoicePickerModal.tsx (+48 lines), AccessibilityTab.tsx (+23 lines, onEngineReady integration)
  - **Closes:** #15

- **Documentation Updates (c1ca89484):** Added TTS Engine Picker configuration guide to FeaturesScreen, documented Advanced Button Gestures interactions (tap, hold, swipe, drag), updated README feature table and Getting Started section with gesture controls
  - **Files Modified:** 2 files changed, 32 insertions(+)
  - **Key Files:** FeaturesScreen.tsx (+27 lines), README.md (+5 lines)

**Full Changelog**: https://github.com/bizzkoot/lnreader/compare/v2.1.1...v2.1.2
