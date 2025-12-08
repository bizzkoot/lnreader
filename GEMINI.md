# GEMINI.md

## Project Overview
LNReader is a React Native application for reading light novels.

## Current Task
Enhance App Update UI/UX (Completed).
- **Goal**: Improve the update experience by offering both in-app download and GitHub release viewing.
- **Approach**: Hybrid model using `expo-file-system` for download and `expo-intent-launcher` for installation, plus corrected GitHub links.

## Key Files
- `src/screens/more/About.tsx`: "Check for Updates" and "What's New" logic.
- `src/components/NewUpdateDialog.tsx`: Dialog with "Download & Install" and progress UI.
- `src/services/updates/downloadUpdate.ts`: Service for downloading APK and triggering install.
- `android/app/src/main/AndroidManifest.xml`: Added `REQUEST_INSTALL_PACKAGES` permission.

## Notes
- Implemented a hybrid update flow: users can "Download & Install" (in-app) or "View on GitHub".
- Uses `expo-file-system/legacy` for compatibility with v19.
- Added "Check for Updates" button to About screen.
- Fixed upstream vs fork link issues (Discord/Sources -> Upstream, Repo -> Fork).
