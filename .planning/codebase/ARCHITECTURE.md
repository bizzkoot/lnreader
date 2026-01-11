# Architecture

**Analysis Date:** 2026-01-06

## Pattern Overview

**Overall:** Layered Monolithic Architecture

**Key Characteristics:**
- Three-tier architecture (presentation-service-data)
- Hybrid WebView layer for content rendering
- Plugin-based extensibility
- React Native with native Android modules
- Complex state management with refs for race protection

## Layers

**Presentation Layer:**
- Purpose: UI rendering and user interaction
- Contains: Screen components, navigation, UI components
- Location: `src/screens/`, `src/components/`, `src/navigators/`
- Depends on: Service layer, data layer
- Used by: End users

**Service Layer:**
- Purpose: Business logic and state management
- Contains: TTS management, backup services, network utilities, plugin manager
- Location: `src/services/`
- Depends on: Data layer, native modules
- Used by: Presentation layer

**Data Layer:**
- Purpose: Data persistence and retrieval
- Contains: SQLite database, MMKV storage, file system
- Location: `src/database/`, `src/hooks/persisted/`
- Depends on: Native storage modules
- Used by: Service layer, presentation layer

**Hybrid WebView Layer:**
- Purpose: Chapter content rendering and highlighting
- Contains: DOM parsing, text extraction, scroll management
- Location: `android/app/src/main/assets/js/core.js`
- Depends on: React Native bridge
- Used by: Reader component

**Native Layer:**
- Purpose: Platform-specific functionality
- Contains: TTS engine, foreground service, native modules
- Location: `android/app/src/main/java/com/lnreader/`
- Depends on: Android framework
- Used by: Service layer

## Data Flow

**Navigation Flow:**

1. App launch → `index.js` entry point
2. `App.tsx` initializes theme providers and database
3. `Main.tsx` navigator sets up navigation structure
4. User navigates to screen (Browse → Novel → Chapter → Reader)
5. Reader loads chapter content via WebView

**TTS Playback Flow:**

1. User presses Play → `useTTSController` hook
2. State machine transitions: IDLE → STARTING → PLAYING
3. `TTSAudioManager` calls native TTS module
4. Native module speaks paragraph, fires events
5. `core.js` in WebView highlights current paragraph
6. Queue depletes → REFILLING state → add more paragraphs
7. Chapter ends → transition to next chapter or stop

**Plugin Loading Flow:**

1. App startup → `pluginManager.ts`
2. Fetch plugin manifest from repository
3. Download and cache plugin files
4. Dynamic import and validation
5. Register plugin in available plugins list
6. Plugins accessible from Browse screen

**Database Operations Flow:**

1. Component calls query (`ChapterQueries.getChapter(chapterId)`)
2. Query object executes SQL via table
3. SQLite database returns results
4. Results cached in MMKV for fast access
5. Component receives data via hook or query

**State Management:**

- React state for UI (useState, useReducer)
- Refs for race protection and persistent references
- MMKV for persistent settings and progress
- SQLite for structured data (novels, chapters, categories)
- State machine for TTS (`TTSState.ts`)

## Key Abstractions

**State Machine:**
- Purpose: Manage TTS playback states and transitions
- Examples: `TTSState.ts` (IDLE, STARTING, PLAYING, REFILLING, STOPPING)
- Pattern: Finite state machine with validation

**Repository Pattern:**
- Purpose: Encapsulate database operations
- Examples: `ChapterQueries`, `NovelQueries`, `CategoryQueries`
- Location: `src/database/queries/`
- Pattern: Query objects with static methods

**Service Manager:**
- Purpose: Background task management
- Examples: `ServiceManager.ts` (auto-backup, library updates)
- Pattern: Singleton task queue

**Plugin Architecture:**
- Purpose: Dynamic novel source loading
- Examples: `pluginManager.ts`, plugin interfaces
- Pattern: Dynamic import with validation

**Settings Architecture:**
- Purpose: Persistent settings with per-novel overrides
- Examples: `useSettings.ts`, `ChapterReaderSettings`
- Pattern: MMKV-backed React hooks

## Entry Points

**Main Entry:**
- Location: `index.js`
- Triggers: App launch
- Responsibilities: Register App component, load Metro

**App Component:**
- Location: `App.tsx`
- Triggers: After index.js
- Responsibilities: Theme setup, database initialization, navigation root

**Navigation Root:**
- Location: `src/navigators/Main.tsx`
- Triggers: After App initialization
- Responsibilities: Set up navigation structure (Bottom, Reader, More stacks)

**Database Init:**
- Location: `src/hooks/common/useDatabaseInitialization.ts`
- Triggers: App mount
- Responsibilities: Run migrations, create tables, set up triggers

**TTS Controller:**
- Location: `src/screens/reader/hooks/useTTSController.ts`
- Triggers: Reader component mount
- Responsibilities: Manage TTS playback state and actions

**WebView Bridge:**
- Location: `android/app/src/main/assets/js/core.js`
- Triggers: WebView load
- Responsibilities: DOM parsing, highlighting, scroll management

## Error Handling

**Strategy:**
- Try/catch at service boundaries
- Error boundaries for React components
- Graceful degradation where possible

**Patterns:**
- `@utils/rateLimitedLogger` for error logging
- User-friendly error messages
- Fallback to defaults on parse errors

## Cross-Cutting Concerns

**Logging:**
- `@utils/rateLimitedLogger` - Rate-limited console output
- No console.log/error/warn in production (ESLint enforced)

**Validation:**
- Plugin interface validation before loading
- Type safety via TypeScript
- Schema validation for database operations

**State Persistence:**
- MMKV for key-value data (settings, progress)
- SQLite for structured data (novels, chapters)
- Native SharedPreferences for TTS progress (Android)
- Database + MMKV reconciliation on load (Math.max of sources)

**Threading:**
- Main thread for UI
- Background threads for database operations
- Native threads for TTS playback
- WebView isolated context

---

*Architecture analysis: 2026-01-06*
*Update when major patterns change*
