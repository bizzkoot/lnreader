# Active Context

## Current Goals

- Performing comprehensive audit of LNReader app focusing on security, performance, code quality, and architecture after recent improvements

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
