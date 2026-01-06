# Coding Conventions

**Analysis Date:** 2026-01-06

## Naming Patterns

**Files:**
- Components: PascalCase.tsx (e.g., `WebViewReader.tsx`, `TTSResumeDialog.tsx`)
- Hooks: camelCase.ts with `use` prefix (e.g., `useSettings.ts`, `useTTSController.ts`)
- Services: camelCase.ts (e.g., `TTSAudioManager.ts`, `ServiceManager.ts`)
- Utilities: camelCase.ts (e.g., `rateLimitedLogger.ts`)
- Types/Interfaces: PascalCase.ts (e.g., `ChapterGeneralSettings.ts`)
- Constants: UPPER_SNAKE_CASE (e.g., `APP_SETTINGS`, `TTS_CONSTANTS`)
- Tests: `*.test.ts`, `*.integration.test.ts`, `*.test.tsx`

**Functions:**
- camelCase for all functions (e.g., `cleanupAllTTSState`, `saveProgress`)
- No special prefix for async functions
- Event handlers: `handle{EventName}` (e.g., `handlePress`, `handleScroll`)

**Variables:**
- camelCase for variables (e.g., `uiScale`, `speechRate`, `currentParagraph`)
- UPPER_SNAKE_CASE for constants (e.g., `MAX_RETRIES`, `API_BASE_URL`)
- No underscore prefix for private members (use # private class fields instead)

**Refs:**
- Use `Ref` suffix for refs (e.g., `currentParagraphIndexRef`, `ttsStateRef`)
- Use `latest` prefix for refs holding latest values (e.g., `LatestRef`)

**Types:**
- PascalCase for interfaces, no `I` prefix (e.g., `User`, not `IUser`)
- PascalCase for type aliases (e.g., `ChapterInfo`, `TTSConfig`)
- PascalCase for enum names, UPPER_CASE for values (e.g., `Status.PENDING`)

## Code Style

**Formatting:**
- Prettier with `.prettierrc.cjs` config
- 2 space indentation
- Single quotes for strings
- No semicolons
- Trailing commas (where valid)
- Arrow function parentheses: avoid when possible (`x => x`, not `(x) => x`)
- Line width: 100 characters (soft limit)

**Linting:**
- ESLint with React Native rules
- Extends: `@react-native`, `@typescript-eslint`
- Key rules:
  - `no-console` - Error (use `@utils/rateLimitedLogger` instead)
  - `exhaustive-deps` - Warn (React hooks dependencies)
  - `prefer-const` - Error
  - `no-duplicate-imports` - Error
- Run: `pnpm run lint`
- Fix: `pnpm run lint:fix`

## Import Organization

**Order:**
1. React imports (`import React from 'react'`)
2. External packages (`import { View } from 'react-native'`)
3. Internal modules (path aliases: `@components`, `@hooks`, etc.)
4. Relative imports (`./utils`, `../types`)
5. Type imports (`import type { ... }`)

**Grouping:**
- Blank lines between groups
- Alphabetical within each group

**Path Aliases:**
- `@components` → `./src/components`
- `@database` → `./src/database`
- `@hooks` → `./src/hooks`
- `@screens` → `./src/screens`
- `@strings` → `./strings`
- `@theme` → `./src/theme`
- `@utils` → `./src/utils`
- `@plugins` → `./src/plugins`
- `@services` → `./src/services`
- `@navigators` → `./src/navigators`
- `@native` → `./src/native`
- `@api` → `./src/api`
- `@type` → `./src/type`
- `@specs` → `./specs`

## Error Handling

**Patterns:**
- Try/catch at service boundaries
- Use `@utils/rateLimitedLogger` for error logging
- Throw descriptive errors with context
- Graceful degradation where possible

**Error Types:**
- Throw on invalid input or missing data
- Log errors with context before throwing
- Use Error objects with messages

**Async:**
- Use try/catch for async operations, avoid `.catch()` chains
- Proper error propagation in promises

## Logging

**Framework:**
- `@utils/rateLimitedLogger` - Rate-limited console output
- NO `console.log`, `console.error`, or `console.warn` (ESLint error)
- Levels: debug, info, warn, error

**Patterns:**
- Use logger for debugging state transitions
- Log at service boundaries, not in utilities
- Include context in logs: `logger.debug({ chapterId }, 'Loading chapter')`

## Comments

**When to Comment:**
- Explain "why", not "what"
- Document complex algorithms and race conditions
- Explain business rules
- Non-obvious code patterns

**JSDoc/TSDoc:**
- Required for public API functions
- Use `@module`, `@param`, `@returns` tags
- Document complex types

**TODO Comments:**
- Format: `// TODO: description` or `// FIXME: description`
- Include context and what needs to be done
- Link to issues if applicable

## Function Design

**Size:**
- Keep under 50 lines when possible
- Extract helpers for complex logic
- One level of abstraction per function

**Parameters:**
- Max 3-4 parameters
- Use options object for 5+ parameters: `function create(options: CreateOptions)`
- Destructure in parameter list: `function process({ id, name }: ProcessParams)`

**Return Values:**
- Explicit return statements
- Return early for guard clauses
- Avoid implicit undefined returns

## Module Design

**Exports:**
- Named exports preferred for utilities and services
- Default exports only for React components
- Export public API from `index.ts` barrel files

**Barrel Files:**
- Use `index.ts` to re-export public API
- Keep internal helpers private (don't export from index)
- Avoid circular dependencies

## React Specific

**Components:**
- Functional components with hooks
- TypeScript for all components
- Props interfaces defined above component
- Memoization with `React.memo` or `React.useMemo` where needed

**Hooks:**
- Custom hooks for reusable logic
- Prefix with `use`: `useData`, `useCallback`
- Exhaustive dependencies enabled (enforced by ESLint)
- Use refs for persistent values across renders

**State:**
- `useState` for simple local state
- `useReducer` for complex state logic
- Refs for values that don't trigger re-renders
- MMKV via custom hooks for persistent state

## TypeScript Specific

**Types:**
- Strict mode enabled
- No `any` types (use `unknown` if truly unknown)
- Interface for object shapes, type for unions/intersections
- Type inference where possible

**Generics:**
- Use descriptive type parameter names: `TData`, `TError`
- Provide reasonable defaults where applicable

---

*Convention analysis: 2026-01-06*
*Update when patterns change*
