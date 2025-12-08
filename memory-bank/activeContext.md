# Active Context

## Current Goals

- Completed App Update UI/UX Enhancement.
- - Fixed broken GitHub links in About screen (pointing to fork).
- - Implemented "Check for Updates" manual trigger.
- - Created hybrid `NewUpdateDialog` with in-app download and GitHub view options.
- - Implemented APK download service with progress tracking.
- - Added `REQUEST_INSTALL_PACKAGES` permission in AndroidManifest.
- Next: Await next user directive.

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