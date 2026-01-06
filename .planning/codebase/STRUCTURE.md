# Codebase Structure

**Analysis Date:** 2026-01-06

## Directory Layout

```
LNreader/
├── index.js                      # React Native entry point
├── App.tsx                       # Main app component
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── babel.config.js               # Babel configuration
├── metro.config.cjs              # Metro bundler config
├── jest.config.cjs               # Jest test configuration
├── .prettierrc.cjs               # Prettier formatting rules
├── flake.nix                     # NixOS reproducible build
├── android/                      # Android native code
│   ├── app/                      # Main app module
│   │   ├── build.gradle          # Android build config
│   │   └── src/main/             # Native Java/Kotlin code
│   │       ├── assets/js/core.js # WebView JavaScript
│   │       └── java/com/lnreader/ # Native modules
│   └── gradle/                   # Gradle wrapper
├── src/                          # Source code
│   ├── api/                      # External API integrations
│   │   └── drive/                # Google Drive integration
│   ├── components/               # Reusable UI components
│   │   └── index.ts              # Component exports
│   ├── database/                 # Database layer
│   │   ├── db.ts                 # Database connection
│   │   ├── tables/               # Table definitions
│   │   ├── queries/              # Query objects
│   │   ├── migrations/           # Schema migrations
│   │   └── utils/                # Database utilities
│   ├── hooks/                    # Custom React hooks
│   │   ├── common/               # General purpose hooks
│   │   ├── persisted/            # MMKV-backed state hooks
│   │   └── index.ts              # Hook exports
│   ├── navigators/               # Navigation setup
│   │   ├── Main.tsx              # Root navigator
│   │   ├── BottomNavigator.tsx   # Bottom tab navigation
│   │   ├── ReaderStack.tsx       # Reader navigation
│   │   └── MoreStack.tsx         # Settings navigation
│   ├── plugins/                  # Plugin system
│   │   ├── pluginManager.ts      # Plugin loader
│   │   ├── types/                # Plugin interfaces
│   │   └── helpers/              # Plugin utilities
│   ├── screens/                  # Screen components
│   │   ├── reader/               # Reader interface
│   │   │   ├── components/       # Reader UI components
│   │   │   ├── hooks/            # Reader-specific hooks
│   │   │   └── types/            # Reader types
│   │   ├── browse/               # Source browsing
│   │   ├── more/                 # Settings and more
│   │   ├── onboarding/           # First-time setup
│   │   └── novel/                # Novel details
│   ├── services/                 # Business logic
│   │   ├── tts/                  # TTS services
│   │   ├── backup/               # Backup services
│   │   ├── network/              # Network utilities
│   │   └── updates/              # Update management
│   ├── theme/                    # Theming
│   ├── utils/                    # Utility functions
│   ├── native/                   # Native module interfaces
│   └── strings/                  # String resources
├── specs/                        # Type specifications
├── __tests__/                    # Global test utilities
├── __mocks__/                    # Mock files for testing
└── .planning/                    # Planning documents
```

## Directory Purposes

**`src/api/`**
- Purpose: External API integrations
- Contains: Drive API client, Remote sync
- Key files: `src/api/drive/request.ts`
- Subdirectories: `drive/`, `remote/`

**`src/components/`**
- Purpose: Reusable UI components
- Contains: Common components used across screens
- Key files: `src/components/index.ts` (barrel export)
- Naming: PascalCase.tsx

**`src/database/`**
- Purpose: Data persistence layer
- Contains: SQLite database setup, queries, migrations
- Key files: `db.ts` (connection), `queries/ChapterQueries.ts`
- Subdirectories: `tables/`, `queries/`, `migrations/`, `utils/`

**`src/hooks/`**
- Purpose: Custom React hooks
- Contains: State management, side effects, data fetching
- Key files: `useSettings.ts`, `useTheme.ts`, `useDownload.ts`
- Naming: camelCase starting with `use`

**`src/hooks/persisted/`**
- Purpose: MMKV-backed persistent state
- Contains: Settings, theme, download state
- Key files: `useSettings.ts`, `useTheme.ts`

**`src/hooks/common/`**
- Purpose: General purpose hooks
- Contains: `useBoolean`, `useDebounce`, etc.

**`src/navigators/`**
- Purpose: React Navigation setup
- Contains: Navigation structure and linking
- Key files: `Main.tsx`, `BottomNavigator.tsx`

**`src/plugins/`**
- Purpose: Dynamic plugin loading system
- Contains: Plugin manager, types, helpers
- Key files: `pluginManager.ts`, `types/plugin.ts`

**`src/screens/`**
- Purpose: Screen components
- Contains: Full-page UI components
- Organization: Grouped by feature (reader, browse, more, etc.)

**`src/screens/reader/`**
- Purpose: Reading interface and TTS
- Contains: Reader UI, TTS controls, chapter navigation
- Key files: `components/WebViewReader.tsx`, `hooks/useTTSController.ts`

**`src/services/`**
- Purpose: Business logic services
- Contains: TTS, backup, network, update services
- Naming: camelCase.ts

**`src/theme/`**
- Purpose: App theming system
- Contains: Colors, fonts, styling

**`src/utils/`**
- Purpose: Utility functions
- Contains: Helpers, formatters, loggers
- Key files: `rateLimitedLogger.ts`

**`android/app/src/main/assets/js/core.js`**
- Purpose: WebView JavaScript bridge
- Contains: DOM parsing, highlighting, scroll management
- Size: 3,814 lines (large file, consider modularization)

**`android/app/src/main/java/com/lnreader/`**
- Purpose: Native Android modules
- Contains: TTS engine, foreground service, native modules

## Key File Locations

**Entry Points:**
- `index.js` - React Native entry point
- `App.tsx` - Main app component
- `src/navigators/Main.tsx` - Navigation root

**Configuration:**
- `tsconfig.json` - TypeScript config with path aliases
- `babel.config.js` - Babel and React Compiler config
- `metro.config.cjs` - Metro bundler config
- `jest.config.cjs` - Test configuration
- `.prettierrc.cjs` - Formatting rules
- `package.json` - Dependencies and scripts

**Core Logic:**
- `src/database/queries/ChapterQueries.ts` - Chapter data operations
- `src/database/queries/NovelQueries.ts` - Novel data operations
- `src/screens/reader/hooks/useTTSController.ts` - TTS state machine (3,090 lines)
- `src/screens/reader/components/WebViewReader.tsx` - Reader UI (1,299 lines)
- `src/services/TTSAudioManager.ts` - TTS native module wrapper

**Testing:**
- `src/database/queries/__tests__/` - Database query tests
- `src/screens/reader/hooks/__tests__/` - TTS integration tests
- `src/services/__tests__/` - Service tests
- `__tests__/` - Global test utilities

**Documentation:**
- `README.md` - User-facing documentation
- `CONTRIBUTING.md` - Contributor guide
- `CLAUDE.md` - Claude Code context

## Naming Conventions

**Files:**
- Components: PascalCase.tsx (e.g., `WebViewReader.tsx`)
- Hooks: camelCase.ts (e.g., `useSettings.ts`)
- Services: camelCase.ts (e.g., `TTSAudioManager.ts`)
- Utilities: camelCase.ts (e.g., `rateLimitedLogger.ts`)
- Types: PascalCase.ts (e.g., `ChapterGeneralSettings.ts`)
- Tests: *.test.ts, *.integration.test.ts, *.test.tsx

**Directories:**
- Features: kebab-case or camelCase (e.g., `reader/`, `browse/`)
- Collections: plural names (e.g., `hooks/`, `components/`, `services/`)

**Special Patterns:**
- `__tests__/` - Test directories colocated with source
- `__mocks__/` - Mock files in root
- `index.ts` - Barrel exports for directories
- `.test.ts` - Unit tests alongside source
- `.integration.test.ts` - Integration tests

## Where to Add New Code

**New Screen:**
- Primary code: `src/screens/{feature}/{ScreenName}.tsx`
- Tests: `src/screens/{feature}/__tests__/{ScreenName}.test.tsx`
- Types: `src/screens/{feature}/types/`

**New Component:**
- Implementation: `src/components/{ComponentName}.tsx`
- Tests: `src/components/__tests__/{ComponentName}.test.tsx`
- Export: Add to `src/components/index.ts`

**New Hook:**
- Implementation: `src/hooks/common/use{HookName}.ts`
- Tests: `src/hooks/__tests__/use{HookName}.test.ts`
- Export: Add to `src/hooks/index.ts`

**New Database Query:**
- Implementation: `src/database/queries/{Entity}Queries.ts`
- Tests: `src/database/queries/__tests__/{Entity}Queries.test.ts`

**New Service:**
- Implementation: `src/services/{ServiceName}.ts`
- Tests: `src/services/__tests__/{ServiceName}.test.ts`

**New Plugin:**
- Plugin files go in external repository
- Plugin type definitions in `src/plugins/types/`

## Special Directories

**`__mocks__/`**
- Purpose: Mock files for testing
- Source: Manually created mocks
- Committed: Yes

**`__tests__/`**
- Purpose: Global test utilities and setup
- Source: Test helper functions
- Committed: Yes

**`.planning/`**
- Purpose: Project planning documents
- Source: Manually created
- Committed: Yes (optional, can be gitignored)

**`android/app/src/main/assets/js/`**
- Purpose: WebView JavaScript bundle
- Source: `core.js` and dependencies
- Committed: Yes (loaded into WebView at runtime)

---

*Structure analysis: 2026-01-06*
*Update when directory structure changes*
