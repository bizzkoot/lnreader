# Roadmap: LNReader TTS Highlight Sync Fix

## Overview

Fix critical TTS highlight synchronization bug where highlight displays one paragraph ahead of audio playback. The fix must address two reproduction scenarios while maintaining all existing functionality and passing all 1,127 tests. Work progresses through deep analysis, root cause identification, fix design, implementation, and comprehensive validation across both TTS modes.

## Domain Expertise

None (React Native/TTS domain knowledge in codebase)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Deep Analysis** - Understand current TTS sync architecture and data flows
- [ ] **Phase 2: Root Cause Investigation** - Identify exact source of +1 offset in both scenarios
- [ ] **Phase 3: Fix Design** - Design solution addressing both scenarios without regressions
- [ ] **Phase 4: Implementation** - Apply the fix to affected components
- [ ] **Phase 5: Scenario 1 Testing** - Verify background continuation scenario fixed
- [ ] **Phase 6: Scenario 2 Testing** - Verify scroll-then-play scenario fixed
- [ ] **Phase 7: Cross-Mode Verification** - Confirm fix works in foreground and background modes
- [ ] **Phase 8: Final Validation** - All tests passing, zero regressions

## Phase Details

### Phase 1: Deep Analysis
**Goal**: Understand current TTS synchronization architecture, data flows, and identify all components involved in highlight tracking
**Depends on**: Nothing (first phase)
**Research**: Unlikely (existing codebase patterns to understand)
**Plans**: 2 plans

Plans:
- [ ] 01-01: Map TTS sync data flow (Native → RN → WebView)
- [ ] 01-02: Identify all progress tracking locations and reconciliation logic

### Phase 2: Root Cause Investigation
**Goal**: Pinpoint exact source of +1 offset in both reproduction scenarios (background continuation, scroll-then-play)
**Depends on**: Phase 1
**Research**: Likely (complex async interactions, race conditions, timing issues)
**Research topics**: TTS event flow (onSpeechDone/onRangeStart), wakeTransitionInProgressRef behavior, currentParagraphIndexRef vs currentIndex drift, progress reconciliation logic (Math.max), WebView bridge timing, chapter transition state handling
**Plans**: 3 plans

Plans:
- [ ] 02-01: Investigate Scenario 1 - Background continuation into new chapter
- [ ] 02-02: Investigate Scenario 2 - Scroll past header then press TTS
- [ ] 02-03: Identify common pattern between scenarios

### Phase 3: Fix Design
**Goal**: Design solution that addresses both scenarios without breaking existing functionality
**Depends on**: Phase 2
**Research**: Likely (architectural decision on where to apply fix)
**Research topics**: Best layer for fix (RN vs WebView vs Native), impact on foreground vs background TTS modes, test coverage approach, potential side effects on other TTS features
**Plans**: 2 plans

Plans:
- [ ] 03-01: Design fix approach and location
- [ ] 03-02: Design test cases for validation

### Phase 4: Implementation
**Goal**: Apply the designed fix to affected components following codebase patterns
**Depends on**: Phase 3
**Research**: Unlikely (once designed, implementation follows existing patterns)
**Plans**: 2 plans

Plans:
- [ ] 04-01: Implement core fix
- [ ] 04-02: Add necessary guards and validation

### Phase 5: Scenario 1 Testing
**Goal**: Verify background continuation scenario is fixed with comprehensive tests
**Depends on**: Phase 4
**Research**: Unlikely (test implementation using existing patterns)
**Plans**: 2 plans

Plans:
- [ ] 05-01: Create integration test for background continuation scenario
- [ ] 05-02: Verify fix passes all Scenario 1 tests

### Phase 6: Scenario 2 Testing
**Goal**: Verify scroll-then-play scenario is fixed with comprehensive tests
**Depends on**: Phase 4
**Research**: Unlikely (test implementation using existing patterns)
**Plans**: 2 plans

Plans:
- [ ] 06-01: Create integration test for scroll-then-play scenario
- [ ] 06-02: Verify fix passes all Scenario 2 tests

### Phase 7: Cross-Mode Verification
**Goal**: Confirm fix works correctly in both foreground and background TTS modes
**Depends on**: Phase 5, Phase 6
**Research**: Unlikely (verification using existing test infrastructure)
**Plans**: 2 plans

Plans:
- [ ] 07-01: Test fix in foreground TTS mode
- [ ] 07-02: Test fix in background TTS mode

### Phase 8: Final Validation
**Goal**: All 1,127 tests passing, zero regressions, code quality checks pass
**Depends on**: Phase 7
**Research**: Unlikely (standard validation commands)
**Plans**: 1 plan

Plans:
- [ ] 08-01: Run full test suite and validation

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Deep Analysis | 0/2 | Not started | - |
| 2. Root Cause Investigation | 0/3 | Not started | - |
| 3. Fix Design | 0/2 | Not started | - |
| 4. Implementation | 0/2 | Not started | - |
| 5. Scenario 1 Testing | 0/2 | Not started | - |
| 6. Scenario 2 Testing | 0/2 | Not started | - |
| 7. Cross-Mode Verification | 0/2 | Not started | - |
| 8. Final Validation | 0/1 | Not started | - |
