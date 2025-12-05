# Progress (Updated: 2025-12-05)

## Done

- Branch integration plan created at docs/integration/feature-tts-live-update-integration-plan.md
- Integration branch created: integration/tts-live-update-review
- Cherry-picked feature branch commit (016043d0)
- Consolidated duplicate applyTtsUpdateToWebView function
- Fixed lint error in ttsHelpers.ts
- Updated test import to use ttsHelpers.ts
- All 27 tests passing
- Android release build successful
- Bug 1 fixed: TTS voice change now restarts playback with new settings
- Bug 2 fixed: Screen wake resume now uses MMKV as authoritative source
- All fixes committed and pushed to remote
 - Bugfix: Prevented TTS chapter jump caused by native queue race during settings restart — added restartInProgress gating to TTSAudioManager, safe restart flow in WebViewReader, stricter scroll/save protection in core.js, and resilient background resume behavior (see files: src/services/TTSAudioManager.ts, src/services/TTSHighlight.ts, src/screens/reader/components/WebViewReader.tsx, android/app/src/main/assets/js/core.js)

## Doing



## Next

- User testing of bug fixes
- Merge to dev branch if tests pass
- Consider adding unit tests for new TTS restart logic
