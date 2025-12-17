# LNReader Agent Guidelines

## Commands

- **Build**: `pnpm run build:release:android`
- **Lint**: `pnpm run lint` (fix with `pnpm run lint:fix`)
- **Type Check**: `pnpm run type-check`
- **Format**: `pnpm run format` (check with `pnpm run format:check`)

## Current Task

Share Panel Bug Fix (Completed).

- **Goal**: Fix share panel appearing after restore during onboarding.
- **Result**: Fixed by excluding `LAST_AUTO_BACKUP_TIME` and `LOCAL_BACKUP_FOLDER_URI` from backup/restore.

## Key Files (Backup/Restore)

- `src/services/backup/utils.ts`: Backup/restore logic, MMKV key exclusions.
- `src/services/backup/local/index.ts`: Local backup create/restore, share functionality.
- `src/screens/onboarding/OnboardingScreen.tsx`: Onboarding with restore option.
- `src/hooks/persisted/useAutoBackup.ts`: Auto backup trigger logic.

## Recent Fixes

- **Share panel bug**: Excluded device-specific keys (`LAST_AUTO_BACKUP_TIME`, `LOCAL_BACKUP_FOLDER_URI`) from restore to prevent auto backup trigger.
- **False success toast**: Removed unconditional success message after backup. Now shows success only for folder saves (confirmed), not share flow (Android can't detect cancel).
- **TTS position sync**: Fixed background TTS pause/resume position tracking.
- **Onboarding**: Enhanced single-screen setup wizard with theme, display, language, and restore options.

## Code Style

- **Imports**: Use path aliases (`@components`, `@utils`, etc.) defined in tsconfig.json
- **Formatting**: 2 spaces, single quotes, trailing commas, no tabs (Prettier config)
- **TypeScript**: Strict mode enabled, no unused locals, ES2022 target
- **Naming**: PascalCase for components, camelCase for variables/functions
- **Error Handling**: Use react-native-error-boundary, avoid console.log (ESLint error)
- **File Structure**: Component folders with index.tsx exports, barrel exports in src/components/index.ts

## Key Rules

- No `var` declarations, use `const`/`let`
- No duplicate imports, prefer named exports
- React hooks exhaustive-deps warnings enforced
- Use `@react-native` ESLint config as base
- Husky pre-commit hooks run lint-staged on all JS/TS/TSX files
