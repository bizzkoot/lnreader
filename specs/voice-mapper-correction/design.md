# Design: Voice Mapper Correction
## ADRs (Architectural Decision Records)
### ADR-001: Replace Google-Only Mapping with Multi-Platform Structure
Status: Proposed | Context: Current mapping only covers Google TTS with fabricated identifiers | Decision: Use authoritative web-speech-recommended-voices data structure | Rationale: Ensures compatibility with actual browser voices and broad platform support
Requirements: REQ-VMAP-001,002 | Confidence: 95% | Alternatives: Keep current structure, Use platform-specific mappers

### ADR-002: Adopt Repository-Driven Voice Data
Status: Proposed | Context: Voice data changes frequently as browsers update | Decision: Structure mapping to align with web-speech-recommended-voices JSON format | Rationale: Future-proof mapping and easier maintenance
Requirements: REQ-VMAP-002, NFR-VMAP-MAINT-001 | Confidence: 90% | Alternatives: Hard-coded mapping, Runtime voice detection only

### ADR-003: Hierarchical Voice Fallback Strategy
Status: Proposed | Context: Not all voices available on all platforms | Decision: Implement region → quality → gender fallback chain | Rationale: Provides consistent experience across devices
Requirements: AC-VMAP-002-03, AC-VMAP-004-03 | Confidence: 85% | Alternatives: No fallback, Random selection, Platform default only

## Components
### Modified: VoiceMapping Interface → Fulfills: AC-VMAP-003-01
Changes: Add platform, quality, and language fields for better classification

```typescript
export interface VoiceMapping {
  /** Original voice identifier from web-speech-recommended-voices */
  id: string;
  /** Display name for UI - Format: "LANGUAGE (REGION) Name - Quality" */
  displayName: string;
  /** Platform: microsoft, apple, google, windows */
  platform: 'microsoft' | 'apple' | 'google' | 'windows';
  /** Language code (en-US, en-GB, etc.) */
  language: string;
  /** Language name for display (ENGLISH, BRITISH, AUSTRALIAN, etc.) */
  languageName: string;
  /** Region name for display (US, UK, AU, CA, IN, etc.) */
  region: string;
  /** Base voice name (Ava, Emma, David, etc.) */
  name: string;
  /** Gender: male, female, neutral */
  gender: 'male' | 'female' | 'neutral';
  /** Quality level: veryHigh, high, normal, low */
  quality: 'veryHigh' | 'high' | 'normal' | 'low';
  /** Style descriptor: Natural, Warm, Professional, etc. */
  style?: string;
  /** Alternative voice identifiers */
  altIds?: string[];
  /** Native platform identifiers (Android/ChromeOS) */
  nativeIds?: string[];

  /** Generated display name following format: "LANGUAGE (REGION) Name - Quality" */
  getDisplayDisplayName(): string;
}
```

### New: VoiceDatabase → Responsibility: Centralized voice management from authoritative source
Interface (EARS Behavioral Contracts):
```typescript
interface VoiceDatabase {
  // WHEN database loads, SHALL initialize with web-speech-recommended-voices data
  initialize(): Promise<void>; // AC-VMAP-001-01

  // WHERE language code provided, SHALL return filtered voice list
  getVoicesByLanguage(language: string): VoiceMapping[]; // AC-VMAP-004-01

  // WHERE platform specified, SHALL return platform-specific voices
  getVoicesByPlatform(platform: string): VoiceMapping[]; // AC-VMAP-002-01

  // IF voice ID requested, SHALL return voice metadata
  getVoiceById(id: string): VoiceMapping | undefined; // AC-VMAP-003-01
}
```

### Modified: VoiceMapperService → Responsibility: Map browser voices to normalized voice data
Interface (EARS Behavioral Contracts):
```typescript
interface VoiceMapperService {
  // WHEN browser voices enumerated, SHALL map to normalized voice data
  mapBrowserVoices(voices: SpeechSynthesisVoice[]): NormalizedVoice[]; // AC-VMAP-001-01

  // WHERE voice lookup occurs, SHALL return within 10ms
  findBestMatch(criteria: VoiceCriteria): NormalizedVoice | null; // NFR-VMAP-PERF-001

  // IF no exact match, SHALL implement fallback strategy
  findFallback(criteria: VoiceCriteria): NormalizedVoice | null; // AC-VMAP-002-03
}
```

## API Matrix (EARS Behavioral Specifications)
| Method | EARS Contract | Performance | Platform | Test Strategy |
|--------|---------------|-------------|----------|---------------|
| getVoiceById() | WHEN valid ID provided, SHALL return VoiceMapping within 5ms | <5ms | Cross-platform | Unit+Mock |
| mapBrowserVoices() | WHEN voices array passed, SHALL return normalized list within 50ms | <50ms | All browsers | Integration |
| findBestMatch() | WHERE criteria matches multiple voices, SHALL return highest quality option | <10ms | Cross-platform | Unit+Property |
| getVoicesByLanguage() | WHEN language code valid, SHALL return regional voices within 10ms | <10ms | All locales | Unit+EdgeCase |

## Data Flow + Traceability
1. VoiceDatabase.load() → REQ-VMAP-001 (Correct Identifiers)
2. Browser Voice Detection → REQ-VMAP-002 (Multi-Platform Support)
3. Voice Mapping Normalization → REQ-VMAP-003 (Accurate Metadata)
4. Regional Filtering → REQ-VMAP-004 (Language Coverage)
5. Fallback Selection → AC-VMAP-002-03 (Graceful Degradation)

## Voice Mapping Structure
```typescript
export const AUTHORITATIVE_VOICE_MAP: Record<string, VoiceMapping> = {
  // Microsoft Edge (Natural Neural Voices) - Extract base names, avoid duplicates
  'Microsoft EmmaMultilingual Online (Natural) - English (United States)': {
    id: 'microsoft-emma-us',
    displayName: 'ENGLISH (US) Emma - Very High',
    platform: 'microsoft',
    language: 'en-US',
    languageName: 'ENGLISH',
    region: 'US',
    name: 'Emma',
    gender: 'female',
    quality: 'veryHigh',
    style: 'Natural',
    getDisplayDisplayName: function() { return this.displayName; }
  },

  // Apple Voices - Using exact names from repository
  'Ava': {
    id: 'apple-ava-us',
    displayName: 'ENGLISH (US) Ava - High',
    platform: 'apple',
    language: 'en-US',
    languageName: 'ENGLISH',
    region: 'US',
    name: 'Ava',
    gender: 'female',
    quality: 'high',
    style: 'Clear',
    getDisplayDisplayName: function() { return this.displayName; }
  },

  // Google Voices - Extract base names, avoid duplicates
  'Google US English Female': {
    id: 'google-female-us',
    displayName: 'ENGLISH (US) Female 1 - High',
    platform: 'google',
    language: 'en-US',
    languageName: 'ENGLISH',
    region: 'US',
    name: 'Female 1',
    gender: 'female',
    quality: 'high',
    style: 'Natural',
    nativeIds: ['en-US-Standard-A'],
    getDisplayDisplayName: function() { return this.displayName; }
  },

  // UK English Examples - All use ENGLISH, different regions
  'Microsoft SoniaMultilingual Online (Natural) - English (United Kingdom)': {
    id: 'microsoft-sonia-uk',
    displayName: 'ENGLISH (UK) Sonia - Very High',
    platform: 'microsoft',
    language: 'en-GB',
    languageName: 'ENGLISH',
    region: 'UK',
    name: 'Sonia',
    gender: 'female',
    quality: 'veryHigh',
    style: 'Warm',
    getDisplayDisplayName: function() { return this.displayName; }
  },

  // Australian English Examples - All use ENGLISH
  'Microsoft NatashaMultilingual Online (Natural) - English (Australia)': {
    id: 'microsoft-natasha-au',
    displayName: 'ENGLISH (AU) Natasha - Very High',
    platform: 'microsoft',
    language: 'en-AU',
    languageName: 'ENGLISH',
    region: 'AU',
    name: 'Natasha',
    gender: 'female',
    quality: 'veryHigh',
    style: 'Natural',
    getDisplayDisplayName: function() { return this.displayName; }
  },

  // European English Examples - Use ENGLISH (EU)
  'Microsoft Voice EU Female': {
    id: 'microsoft-eu-female',
    displayName: 'ENGLISH (EU) Voice 1 - High',
    platform: 'microsoft',
    language: 'en-EU',
    languageName: 'ENGLISH',
    region: 'EU',
    name: 'Voice 1',
    gender: 'female',
    quality: 'high',
    style: 'Professional',
    getDisplayDisplayName: function() { return this.displayName; }
  }
};

// Helper function to generate display names
export const generateDisplayName = (
  languageName: string,
  region: string,
  name: string,
  quality: string
): string => {
  return `${languageName} (${region}) ${name} - ${quality}`;
};
```

## Quality Gates
- ADRs: >90% confidence to requirements
- Interfaces: trace to acceptance criteria with EARS contracts
- Data Structure: aligns with web-speech-recommended-voices format
- Performance: all lookups <10ms as specified in NFRs
- Compatibility: supports all major browser platforms