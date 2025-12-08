# GEMINI.md

## Project Overview
LNReader is a React Native application for reading light novels.

## Current Task
Dependency Update Audit (Completed).
- **Goal**: Audit the recent dependency update (React Native 0.82.1, ESLint 9, Jest 30, Prettier 3) for issues.
- **Result**: All checks passed (TypeScript, ESLint, Jest 94/94, security audit).
- **Fix Applied**: Updated Husky prepare script from `husky install` to `husky` for v9 compatibility.

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

