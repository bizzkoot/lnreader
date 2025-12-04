# Tasks: Voice Mapper Correction
## Metadata
Complexity: Medium | Critical Path: Data Extraction → Interface Update → Mapping Logic → Testing | Risk: Low-Medium | Timeline: 2-3 days

## Progress: 0/X Complete, 0 In Progress, 0 Not Started, 0 Blocked

## Phase 1: Data Foundation
- [ ] TASK-VMAP-001: Extract Authoritative Voice Data
  Trace: REQ-VMAP-001 | Design: VoiceDatabase | AC: AC-VMAP-001-01
  DoD (EARS Format): WHEN data extraction completed, SHALL have complete JSON file with all voices from web-speech-recommended-voices AND WHERE voice identifiers exist, SHALL match exactly with repository names
  Risk: Low | Deps: None | Effort: 3pts

- [ ] TASK-VMAP-002: Update VoiceMapping Interface
  Trace: REQ-VMAP-003 | Design: Modified VoiceMapping | AC: AC-VMAP-003-01,02,03
  DoD (EARS Format): WHEN interface updated, SHALL include platform, quality, language, languageName, region, and displayName fields AND SHALL enforce "LANGUAGE (REGION) Name - Quality" format AND WHILE maintaining backward compatibility, SHALL support existing code
  Risk: Low | Deps: None | Effort: 2pts

## Phase 2: Core Implementation
- [ ] TASK-VMAP-003: Implement VoiceDatabase Class
  Trace: REQ-VMAP-001,002 | Design: VoiceDatabase | AC: AC-VMAP-001-01, AC-VMAP-002-01,02
  DoD (EARS Format): WHEN VoiceDatabase implemented, SHALL load authoritative voice data AND WHERE queries executed, SHALL return filtered results within 10ms AND SHALL generate display names in required format
  Risk: Medium | Deps: TASK-VMAP-001,002 | Effort: 5pts

- [ ] TASK-VMAP-004: Rewrite VoiceMapperService Logic
  Trace: REQ-VMAP-001,002,003 | Design: VoiceMapperService | AC: AC-VMAP-001-01, AC-VMAP-002-03, AC-VMAP-003-01
  DoD (EARS Format): WHEN service rewritten, SHALL use new VoiceDatabase AND WHILE mapping voices, SHALL implement hierarchical fallback strategy AND IF no exact match, SHALL provide closest alternative AND SHALL ensure display names follow "LANGUAGE (REGION) Name - Quality" format
  Risk: Medium | Deps: TASK-VMAP-003 | Effort: 4pts

- [ ] TASK-VMAP-005: Replace GOOGLE_TTS_VOICE_MAP with AUTHORITATIVE_VOICE_MAP
  Trace: REQ-VMAP-001,002,004 | Design: Voice Mapping Structure | AC: AC-VMAP-001-01, AC-VMAP-002-01, AC-VMAP-004-01,02
  DoD (EARS Format): WHEN replacement complete, SHALL contain only verified voice identifiers AND WHERE regional variants exist, SHALL include at least 2 male and 2 female options per region AND SHALL have displayName in "LANGUAGE (REGION) Name - Quality" format
  Risk: Low | Deps: TASK-VMAP-003,004 | Effort: 6pts

## Phase 3: Integration & Testing
- [ ] TASK-VMAP-006: Update TTSService Integration
  Trace: All REQ | Design: Modified Integration | AC: All acceptance criteria
  DoD (EARS Format): WHEN TTSAudioManager updated, SHALL use new VoiceMapperService AND WHERE voice selection occurs, SHALL work with actual browser voices AND SHALL display voices in required naming format
  Risk: Medium | Deps: TASK-VMAP-005 | Effort: 3pts

- [ ] TASK-VMAP-007: Implement Unit Tests
  Trace: All AC | Design: Test Coverage | AC: 100% acceptance criteria coverage
  DoD (EARS Format): WHEN tests written, SHALL validate every EARS acceptance criterion AND SHALL test "LANGUAGE (REGION) Name - Quality" format generation AND WHERE performance requirements exist, SHALL measure execution time AND IF fallback logic exists, SHALL test all fallback paths
  Risk: Low | Deps: TASK-VMAP-006 | Effort: 4pts

- [ ] TASK-VMAP-008: Cross-Browser Integration Testing
  Trace: NFR-VMAP-COMPAT-001 | Design: Compatibility Matrix | AC: Platform compatibility
  DoD (EARS Format): WHEN testing complete, SHALL verify voice mapping works on Chrome, Edge, Safari AND SHALL verify display names follow required format across all browsers AND WHERE browsers support Web Speech API, SHALL detect and map available voices correctly
  Risk: Medium | Deps: TASK-VMAP-007 | Effort: 3pts

## Phase 4: Documentation & Cleanup
- [ ] TASK-VMAP-009: Update Code Documentation
  Trace: NFR-VMAP-MAINT-001 | Design: Maintainable Structure | AC: Documentation completeness
  DoD (EARS Format): WHEN documentation updated, SHALL explain new voice mapping structure AND SHALL document "LANGUAGE (REGION) Name - Quality" naming convention AND WHERE future updates needed, SHALL provide clear guidance for adding new voices
  Risk: Low | Deps: TASK-VMAP-008 | Effort: 2pts

- [ ] TASK-VMAP-010: Remove Legacy Code
  Trace: REQ-VMAP-001 | Design: Clean Architecture | AC: No deprecated mappings
  DoD (EARS Format): WHEN cleanup complete, SHALL remove all fabricated voice identifiers AND SHALL remove old naming format logic AND WHERE legacy code existed, SHALL have no remaining references
  Risk: Low | Deps: TASK-VMAP-009 | Effort: 1pt

## Voice Display Name Examples (Required Format)
- "ENGLISH (US) Emma - Very High"
- "ENGLISH (UK) Sonia - Very High"
- "ENGLISH (AU) Natasha - Very High"
- "ENGLISH (US) Ava - High"
- "ENGLISH (CA) Heather - High"
- "ENGLISH (IN) Neerja - Very High"
- "ENGLISH (EU) Voice 1 - High" (numbered names to avoid duplicates)

## Verification Checklist (EARS Compliance)
- [ ] Every REQ-* → implementing task with EARS DoD
- [ ] Every EARS AC → unit test with Given/When/Then structure
- [ ] Every NFR-* → measurable test validation
- [ ] All design interfaces → implementing tasks
- [ ] Risk mitigation for Medium+ risks with EARS success criteria
- [ ] Performance testing for <10ms lookup requirement
- [ ] Cross-browser compatibility verification
- [ ] Regional voice coverage validation (2 male + 2 female per region)
- [ ] Voice display name format validation ("LANGUAGE (REGION) Name - Quality")

## Dependencies
- External: web-speech-recommended-voices repository (for voice data)
- Internal: TTSAudioManager, WebViewReader components
- Tools: Node.js for data processing, Jest for testing
- Environment: Multiple browsers for integration testing

## Success Metrics
- 100% of voice identifiers match authoritative source
- 100% of display names follow "LANGUAGE (REGION) Name - Quality" format
- <10ms voice lookup performance
- Support for 4+ platforms (Microsoft, Apple, Google, Windows)
- 5+ regional variants with gender balance
- Zero legacy voice identifiers in production