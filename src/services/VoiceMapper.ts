import {
  AUTHORITATIVE_VOICE_MAP,
  VoiceMapping,
} from './authoritative-voice-map';

export type { VoiceMapping };

/**
 * Lookup a voice mapping by its identifier.
 * The identifier can be:
 * 1. The full voice name (key in AUTHORITATIVE_VOICE_MAP)
 * 2. A native Android ID (e.g. "en-us-x-iob-network") - found in nativeIds
 * 3. An alternative ID - found in altIds
 * 4. The normalized ID - found in id field
 */
export const getVoiceMapping = (
  identifier: string,
): VoiceMapping | undefined => {
  if (!identifier) return undefined;

  // 1. Try exact match on the key (most common for web/some android)
  if (AUTHORITATIVE_VOICE_MAP[identifier]) {
    return AUTHORITATIVE_VOICE_MAP[identifier];
  }

  const lowerId = identifier.toLowerCase();

  // Iterate once to find match
  for (const mapping of Object.values(AUTHORITATIVE_VOICE_MAP)) {
    // 2. Check native IDs (fastest for Android)
    if (mapping.nativeIds?.includes(identifier)) {
      // Determine whether this native id is a local or network variant and
      // return a shallow clone with the information (do NOT change quality).
      const lower = identifier.toLowerCase();
      let matchedNativeType: VoiceMapping['matchedNativeType'] = 'unknown';
      if (lower.endsWith('-local')) matchedNativeType = 'local';
      else if (lower.endsWith('-network')) matchedNativeType = 'network';

      const clone: VoiceMapping = { ...mapping, matchedNativeType };
      return clone;
    }

    // 3. Check ID field
    if (mapping.id === lowerId) {
      return mapping;
    }

    // 4. Check alt IDs
    if (mapping.altIds?.some(alt => alt.toLowerCase() === lowerId)) {
      return mapping;
    }

    // 5. Check native IDs case-insensitive (fallback)
    if (mapping.nativeIds?.some(native => native.toLowerCase() === lowerId)) {
      return mapping;
    }
  }

  return undefined;
};
