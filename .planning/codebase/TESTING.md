# Testing Patterns

**Analysis Date:** 2026-01-06

## Test Framework

**Runner:**
- Jest 29.x - Test runner
- Config: `jest.config.cjs` in project root

**Assertion Library:**
- Jest built-in `expect`
- Matchers: `toBe`, `toEqual`, `toThrow`, `toMatchObject`, `resolves`, `rejects`

**React Testing:**
- `@testing-library/react-native` - Component testing
- `@testing-library/react-hooks` - Hook testing

**Run Commands:**
```bash
pnpm run test                                # Run all tests (1127 tests)
pnpm run test -- --testPathPattern="FileName.test"  # Specific file
pnpm run test:tts-refill                     # TTS refill simulator
pnpm run test:tts-wake-cycle                 # TTS wake cycle tests
pnpm run test -- --coverage                  # Coverage report
pnpm run test -- --watch                     # Watch mode
```

## Test File Organization

**Location:**
- Co-located with source files in `__tests__/` directories
- Pattern: `src/path/to/file/__tests__/fileName.test.ts`

**Naming:**
- Unit tests: `*.test.ts`
- Integration tests: `*.integration.test.ts`
- Component tests: `*.test.tsx`

**Structure:**
```
src/
├── database/
│   ├── queries/
│   │   ├── __tests__/
│   │   │   ├── ChapterQueries.test.ts
│   │   │   ├── ChapterQueries.tts.test.ts
│   │   │   └── NovelQueries.test.ts
│   │   └── ChapterQueries.ts
│   └── migrations/
│       ├── __tests__/
│       │   └── 003_add_tts_state.test.ts
│       └── 003_add_tts_state.ts
├── screens/
│   └── reader/
│       ├── components/
│       │   ├── __tests__/
│       │   │   ├── TTSResumeDialog.test.tsx
│       │   │   ├── WebViewReader.integration.test.tsx
│       │   │   └── ttsHelpers.test.ts
│       │   └── WebViewReader.tsx
│       └── hooks/
│           ├── __tests__/
│           │   ├── useTTSController.integration.test.ts
│           │   ├── useScrollSyncHandlers.test.ts
│           │   └── useRefSync.test.ts
│           └── useTTSController.ts
└── services/
    ├── __tests__/
    │   ├── TTSAudioManager.test.ts
    │   ├── TTSState.test.ts
    │   └── TTSBugRegression.test.ts
    └── TTSAudioManager.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('ModuleName', () => {
  describe('functionName', () => {
    beforeEach(() => {
      // Setup: reset mocks, clear storage
    });

    it('should handle success case', () => {
      // arrange
      const input = createTestInput();

      // act
      const result = functionName(input);

      // assert
      expect(result).toEqual(expectedOutput);
    });

    it('should handle error case', () => {
      expect(() => functionName(null)).toThrow('Invalid input');
    });
  });
});
```

**Patterns:**
- Use `beforeEach` for per-test setup (preferred over `beforeAll`)
- Use `afterEach` to clean up mocks and storage
- Explicit arrange/act/assert comments in complex tests
- One assertion focus per test (multiple `expect` calls OK if related)

## Mocking

**Framework:**
- Jest built-in mocking (`jest.mock()`, `jest.fn()`)

**Patterns:**
```typescript
// Mock module
jest.mock('@services/TTSAudioManager', () => ({
  TTSAudioManager: {
    speakBatch: jest.fn(),
    stop: jest.fn(),
  },
}));

// Mock in test
const mockSpeak = TTSAudioManager.speakBatch;
mockSpeak.mockResolvedValue({ success: true });

// Clear mocks
afterEach(() => {
  jest.clearAllMocks();
});
```

**What to Mock:**
- Native modules (expo-sqlite, expo-file-system, etc.)
- External API calls
- File system operations
- Native Android modules (TTS, foreground service)

**What NOT to Mock:**
- Pure utility functions
- Internal business logic (test actual implementation)
- Simple data transformations

**Mock Location:**
- `__mocks__/` directory for global mocks (e.g., `expo-localization.js`)
- Local mocks in test files for specific tests

## Fixtures and Factories

**Test Data:**
```typescript
// Factory pattern
function createTestChapter(overrides?: Partial<Chapter>): Chapter {
  return {
    id: 'test-chapter-id',
    novelId: 'test-novel-id',
    name: 'Test Chapter',
    chapterUrl: 'https://example.com/chapter/1',
    ...overrides,
  };
}

// Test fixtures in test files or shared fixtures/
const mockChapters = [
  createTestChapter({ id: 'chapter-1' }),
  createTestChapter({ id: 'chapter-2' }),
];
```

**Location:**
- Factory functions: Define in test file near usage
- Shared fixtures: Co-locate with code being tested
- Mock data: Inline for simple data, factories for complex

## Coverage

**Requirements:**
- No enforced coverage target (tracked for awareness)
- Focus on critical paths (TTS, database, plugins)

**Configuration:**
- Jest coverage via built-in `--coverage` flag
- Excludes: `*.test.ts`, `*.mock.ts`, `node_modules/`

**View Coverage:**
```bash
pnpm run test -- --coverage
open coverage/index.html  # If HTML report generated
```

## Test Types

**Unit Tests:**
- Test single function in isolation
- Mock all external dependencies
- Fast: each test <100ms
- Examples: Query tests, utility function tests

**Integration Tests:**
- Test multiple modules together
- Mock only external boundaries (native modules, file system)
- Examples: TTS integration tests, WebView integration tests

**E2E Tests:**
- Not currently used
- Manual testing for user flows

## Common Patterns

**Async Testing:**
```typescript
it('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBe('expected');
});
```

**Error Testing:**
```typescript
it('should throw on invalid input', () => {
  expect(() => parse(null)).toThrow('Cannot parse null');
});

it('should reject on failure', async () => {
  await expect(asyncCall()).rejects.toThrow('Error message');
});
```

**Native Module Mocking:**
```typescript
jest.mock('expo-sqlite', () => ({
  openDatabase: jest.fn(() => ({
    transaction: jest.fn((cb) => cb({
      executeSql: jest.fn(),
    })),
  })),
}));
```

**Hook Testing:**
```typescript
import { renderHook, act } from '@testing-library/react-hooks';

it('should update state', () => {
  const { result } = renderHook(() => useCustomHook());
  act(() => {
    result.current.updateState('new value');
  });
  expect(result.current.state).toBe('new value');
});
```

## Specialized Testing

**TTS Testing:**
- Custom simulators in root directory:
  - `tts_refill_simulator.js` - Simulate queue refill behavior
  - `tts_wake_cycle_test.js` - Test app wake-up synchronization
- Run with `pnpm run test:tts-refill` and `pnpm run test:tts-wake-cycle`

**Database Testing:**
- Each migration tested (e.g., `003_add_tts_state.test.ts`)
- Query objects tested with mock database
- Triggers tested with transaction tests

**Plugin Testing:**
- Plugin interface validation tested
- Dynamic import mocking for plugin loading

---

*Testing analysis: 2026-01-06*
*Update when test patterns change*
