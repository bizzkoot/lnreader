# Requirements: Voice Mapper Correction

## Meta-Context

- Feature UUID: FEACH-VMAP-001
- Parent Context: LNreader TTS voice mapping system
- Dependency Graph: VoiceMapper.ts → TTSService → WebViewReader → User Experience

## Functional Requirements

### REQ-VMAP-001: Correct Voice Identifiers

Intent Vector: Replace fabricated Google voice codes with actual Web Speech API voice identifiers from authoritative source
As a TTS user I want voice selections to work with actual browser voices So that I can hear text-to-speech playback
Business Value: 9 | Complexity: M

Acceptance Criteria (EARS Syntax):

- AC-VMAP-001-01: WHEN VoiceMapper.ts loads, the system SHALL use only voice identifiers verified in web-speech-recommended-voices repository {confidence: 100%}
- AC-VMAP-001-02: WHERE voice identifiers don't match available browser voices, the system SHALL gracefully fallback to default voice {confidence: 95%}
- AC-VMAP-001-03: IF a voice identifier is deprecated, the system SHALL log warning and use alternative {confidence: 90%}

### REQ-VMAP-002: Multi-Platform Voice Support

Intent Vector: Expand voice mapping coverage beyond Google TTS to include Microsoft Edge, Apple, and Windows voices
As a user on any device/browser I want appropriate voice options available So that I can choose preferred voice characteristics
Business Value: 8 | Complexity: M

Acceptance Criteria (EARS Syntax):

- AC-VMAP-002-01: WHEN system initializes, the system SHALL support Microsoft Edge, Apple Safari, Google Chrome, and Windows voices {confidence: 100%}
- AC-VMAP-002-02: WHILE enumerating available voices, the system SHALL include regional variants (US, UK, AU, CA, IN) {confidence: 95%}
- AC-VMAP-002-03: IF platform-specific voices are unavailable, the system SHALL provide cross-platform alternatives {confidence: 85%}

### REQ-VMAP-003: Accurate Voice Metadata

Intent Vector: Provide correct voice names, genders, and style descriptions matching actual voice characteristics
As a user selecting voices I want accurate descriptions of voice characteristics So that I can make informed choices
Business Value: 7 | Complexity: S

Acceptance Criteria (EARS Syntax):

- AC-VMAP-003-01: WHEN displaying voice options, the system SHALL show actual voice names from web-speech-recommended-voices {confidence: 100%}
- AC-VMAP-003-02: WHERE gender information is available, the system SHALL correctly categorize male/female/neutral voices {confidence: 95%}
- AC-VMAP-003-03: IF style descriptors exist, the system SHALL provide meaningful characteristics (Natural, Warm, Professional, etc.) {confidence: 85%}

### REQ-VMAP-004: Regional Language Coverage

Intent Vector: Support major English regional variants with appropriate voice options
As a user in non-US region I want voices that match my local accent and pronunciation So that content sounds natural
Business Value: 6 | Complexity: M

Acceptance Criteria (EARS Syntax):

- AC-VMAP-004-01: WHEN detecting user locale, the system SHALL prioritize voices for en-US, en-GB, en-AU, en-CA, en-IN {confidence: 90%}
- AC-VMAP-004-02: WHILE loading voices, the system SHALL include at least 2 male and 2 female options per region {confidence: 85%}
- AC-VMAP-004-03: IF regional voices are unavailable, the system SHALL provide closest accent alternatives {confidence: 80%}

## Non-functional Requirements (EARS Format)

- NFR-VMAP-PERF-001: WHEN voice mapping lookup occurs, the system SHALL return results within 10ms
- NFR-VMAP-COMPAT-001: WHERE browser implements Web Speech API, the system SHALL support voice detection across Chrome, Edge, Safari, Firefox
- NFR-VMAP-MAINT-001: WHEN new voices are added to web-speech-recommended-voices, the system SHALL support easy mapping updates
- NFR-VMAP-QUAL-001: IF voice metadata is missing, the system SHALL maintain functionality with default values

## Traceability Manifest

Upstream: web-speech-recommended-voices repository, Web Speech API specification | Downstream: TTS service initialization, voice selection UI, audio playback | Coverage: 95%
