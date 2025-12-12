# Active Context

## Current Goals

- Current focus: Fix native crash on TTS start (awaiting Android logcat FATAL EXCEPTION from user). Build pipeline is green after clean+release. MVP features (actions, marquee, progress, pause/resume, chapter transitions) are implemented; only crash blocks on-device validation.

## Key Files Modified

- `src/screens/more/About.tsx`: Added Update check and fixed links.
- `src/components/NewUpdateDialog.tsx`: Added download flow and progress UI.
- `src/services/updates/downloadUpdate.ts`: New service for APK download/install.
- `android/app/src/main/AndroidManifest.xml`: permission addition.
- `strings/languages/en/strings.json`: Added update-related strings.

## Test Commands

```bash
# Run all tests
pnpm test

# Run specific TTS tests
pnpm test -- --testPathPattern=ttsWakeUtils
```

## Current Blockers

- None (Ready for real-device verification)
