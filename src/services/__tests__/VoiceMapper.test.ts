// Ensure Jest globals are available for type-checking
import '@jest/globals';
import { getVoiceMapping } from '../VoiceMapper';

describe('VoiceMapper', () => {
  it('should resolve by native ID (Android)', () => {
    // "Female voice 2 (US)" -> en-us-x-iob-network
    const mapping = getVoiceMapping('en-us-x-iob-network');
    expect(mapping).toBeDefined();
    expect(mapping?.name).toBe('Female voice 2 (US)');
    expect(mapping?.displayName).toContain(
      'ENGLISH (US) Female voice 2 (US) HIGH',
    );
  });

  it('should resolve by full name (Microsoft)', () => {
    const mapping = getVoiceMapping(
      'Microsoft Jenny Online (Natural) - English (United States)',
    );
    expect(mapping).toBeDefined();
    expect(mapping?.name).toBe('Jenny');
  });

  it('should resolve by alternative ID', () => {
    // Microsoft Emma has altId: "Microsoft Emma Online (Natural) - English (United States)"
    const mapping = getVoiceMapping(
      'Microsoft Emma Online (Natural) - English (United States)',
    );
    expect(mapping).toBeDefined();
    expect(mapping?.name).toBe('Emma');
  });

  it('should resolve case-insensitive', () => {
    const mapping = getVoiceMapping('EN-US-X-IOB-NETWORK');
    expect(mapping).toBeDefined();
    expect(mapping?.name).toBe('Female voice 2 (US)');
  });

  it('should resolve local native ID and return matchedNativeType=local', () => {
    const mapping = getVoiceMapping('en-us-x-iob-local');
    expect(mapping).toBeDefined();
    expect(mapping?.name).toBe('Female voice 2 (US)');
    expect((mapping as any).matchedNativeType).toBe('local');
  });

  it('should return undefined for unknown voice', () => {
    const mapping = getVoiceMapping('unknown-voice-id');
    expect(mapping).toBeUndefined();
  });
});
