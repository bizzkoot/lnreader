# LNReader Agent Guidelines

## Commands

- **Build**: `pnpm run build:release:android`
- **Lint**: `pnpm run lint` (fix with `pnpm run lint:fix`)
- **Type Check**: `pnpm run type-check`
- **Format**: `pnpm run format` (check with `pnpm run format:check`)
- **Dev**: `pnpm run dev:start` + `pnpm run dev:android`
- **Clean**: `pnpm run clean:full`

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
