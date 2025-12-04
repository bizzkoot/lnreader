# Progress (Updated: 2025-12-04)

## Done

- Bug 1 Fix: Added ensureWakeLockHeld() in TTSForegroundService.kt to re-acquire wake lock on each utterance start
- Bug 2 Fix: Changed tts-queue handler to use addToBatch() instead of speakBatch() to preserve first paragraph during resume
- Bug 3 Fix: Added ttsScreenWakeSyncPending flag to block calculatePages during screen wake, enhanced screen wake sync handler
- Bug 4 Fix: Added isWebViewSyncedRef to track WebView chapter state, skip JS injections when WebView has old chapter HTML during background TTS

## Doing

- Testing background TTS multi-chapter transitions

## Next

- Test on real device with extended background TTS playback across multiple chapters
- Monitor for edge cases with chapter transitions when screen wakes
