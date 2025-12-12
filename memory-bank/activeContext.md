# Active Context

## Current Goals

- Enhanced Media Control - Phase 1 delivered; MediaSessionCompat integration deferred due to dependency/import issues. Next: investigate Media3 or compat libs.

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
