# Progress (Updated: 2025-12-04)

## Done

- Added local simulator script for addToBatch failures
- Added npm script test:tts-refill and ran simulator
- **TTS Wake/Resume Bug Fix**: Fixed issue where screen wake during background TTS would reset to paragraph 0
  - Root cause: Chapter transition was unconditionally resetting `currentParagraphIndexRef` to 0
  - Fix: Initialize from highest of DB/MMKV/ttsState instead of resetting to 0
  - Added grace period filtering to ignore stale/early save events
  - Added pause-on-wake and resume-after-sync flow
- **Added Jest Testing Infrastructure**
  - Installed Jest as devDependency
  - Created `ttsWakeUtils.js` helper module for testable TTS logic
  - Created comprehensive test suite with 17 test cases covering:
    - Initial index computation from multiple sources
    - Batch building with correct utterance ID mapping
    - Stale save event filtering (grace period, chapter mismatch, backward progress)
    - Full wake flow simulation scenarios

## Doing

- Monitoring TTS background playback stability after fixes

## Next

- Run real-device reproduction to verify wake/resume flow works correctly
- Consider adding native-side handshake for authoritative TTS index reporting

---

## Installation & Test Instructions

### Prerequisites
- Node.js >= 20
- pnpm (package manager)

### Install Dependencies
```bash
cd /Users/muhammadfaiz/Custom\ APP/LNreader
pnpm install
```

### Run Unit Tests
```bash
# Run all tests
pnpm test

# Run tests with verbose output
pnpm test -- --verbose

# Run specific test file
pnpm test -- src/screens/reader/components/__tests__/ttsWakeUtils.test.js
```

### Run TTS Refill Simulator
```bash
pnpm run test:tts-refill
```

### Run Type Checking
```bash
pnpm run type-check
```

### Run Linting
```bash
pnpm run lint
pnpm run lint:fix  # Auto-fix issues
```

### Build & Run App
```bash
# Development
pnpm run dev:start   # Start Metro bundler
pnpm run dev:android # Run on Android device/emulator

# Release build
pnpm run build:release:android
```

---

## Test Scenarios Covered

### 1. Wake Flow Preservation
- TTS playing at paragraph N in background
- Screen wakes → pause TTS → sync UI to N → resume from N
- Verifies no position regression to 0

### 2. Chapter Transition
- Background TTS auto-advances to new chapter
- New chapter correctly starts from paragraph 0 (or saved position if resuming)
- Events from old chapter are filtered out

### 3. Stale Event Filtering
- WebView initial 0 saves blocked during grace period
- Backward progress saves blocked
- Events without chapterId blocked during transitions
- Cross-chapter events always blocked
