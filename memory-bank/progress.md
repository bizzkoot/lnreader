# Progress (Updated: 2025-12-03)

## Done

- Fixed TTS ForegroundService Android 12+ background start restriction by tracking isServiceForeground state
- Fixed TTS chapter/paragraph sync issue by including chapterId in utterance IDs and validating in event handlers
- Fixed UI/UX on screen wake by adding isBackgroundPlaybackActive flag to prevent resume prompts during active background TTS
- Removed stop() call before speakBatch() in background chapter transition to maintain foreground service state

## Doing

- Committing changes and pushing to dev branch

## Next

- Test TTS background playback with multi-chapter continuation
- Verify no prompts appear during background TTS when waking screen
