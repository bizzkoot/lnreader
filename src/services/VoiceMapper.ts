export interface VoiceMapping {
  /** Short friendly name (e.g. "Josephine", "Grace") */
  name: string;
  gender: 'male' | 'female' | 'neutral';
  /** Brief style descriptor (e.g. "Warm", "Clear", "Deep") */
  style?: string;
}

/**
 * Curated voice mappings based on research from multiple Android TTS implementations.
 * Names are community-assigned based on voice characteristics.
 * All -network voices are high quality (quality: 400).
 */
export const GOOGLE_TTS_VOICE_MAP: Record<string, VoiceMapping> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // US English (en-US)
  // ═══════════════════════════════════════════════════════════════════════════
  'en-us-x-iob-network': { name: 'Josephine', gender: 'female', style: 'Warm' },
  'en-us-x-iol-network': { name: 'Joe', gender: 'male', style: 'Clear' },
  'en-us-x-iog-network': { name: 'Gloria', gender: 'female', style: 'Expressive' },
  'en-us-x-iom-network': { name: 'Paul', gender: 'male', style: 'Deep' },
  'en-us-x-tpf-network': { name: 'Cathy', gender: 'female', style: 'Natural' },
  'en-us-x-tpd-network': { name: 'James', gender: 'male', style: 'Professional' },
  'en-us-x-sfg-network': { name: 'Mary', gender: 'female', style: 'Standard' },
  // Local (offline) variants
  'en-us-x-iob-local': { name: 'Josephine', gender: 'female', style: 'Warm' },
  'en-us-x-iol-local': { name: 'Joe', gender: 'male', style: 'Clear' },
  'en-us-x-iog-local': { name: 'Gloria', gender: 'female', style: 'Expressive' },
  'en-us-x-iom-local': { name: 'Paul', gender: 'male', style: 'Deep' },
  'en-us-x-tpf-local': { name: 'Cathy', gender: 'female', style: 'Natural' },
  'en-us-x-tpd-local': { name: 'James', gender: 'male', style: 'Professional' },
  'en-us-x-sfg-local': { name: 'Mary', gender: 'female', style: 'Standard' },

  // ═══════════════════════════════════════════════════════════════════════════
  // UK English (en-GB)
  // ═══════════════════════════════════════════════════════════════════════════
  'en-gb-x-gba-network': { name: 'Grace', gender: 'female', style: 'Warm' },
  'en-gb-x-gbc-network': { name: 'Lauren', gender: 'female', style: 'Clear' },
  'en-gb-x-gbg-network': { name: 'Libby', gender: 'female', style: 'Friendly' },
  'en-gb-x-rjs-network': { name: 'Peter', gender: 'male', style: 'Authoritative' },
  'en-gb-x-gbb-network': { name: 'Taylor', gender: 'male', style: 'Conversational' },
  'en-gb-x-gbd-network': { name: 'Nicholas', gender: 'male', style: 'Formal' },
  // Local variants
  'en-gb-x-gba-local': { name: 'Grace', gender: 'female', style: 'Warm' },
  'en-gb-x-gbc-local': { name: 'Lauren', gender: 'female', style: 'Clear' },
  'en-gb-x-gbg-local': { name: 'Libby', gender: 'female', style: 'Friendly' },
  'en-gb-x-rjs-local': { name: 'Peter', gender: 'male', style: 'Authoritative' },
  'en-gb-x-gbb-local': { name: 'Taylor', gender: 'male', style: 'Conversational' },
  'en-gb-x-gbd-local': { name: 'Nicholas', gender: 'male', style: 'Formal' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Australian English (en-AU)
  // ═══════════════════════════════════════════════════════════════════════════
  'en-au-x-aua-network': { name: 'Abigail', gender: 'female', style: 'Warm' },
  'en-au-x-auc-network': { name: 'Kayla', gender: 'female', style: 'Casual' },
  'en-au-x-aub-network': { name: 'Braith', gender: 'male', style: 'Friendly' },
  'en-au-x-aud-network': { name: 'Lachlan', gender: 'male', style: 'Deep' },
  // Local variants
  'en-au-x-aua-local': { name: 'Abigail', gender: 'female', style: 'Warm' },
  'en-au-x-auc-local': { name: 'Kayla', gender: 'female', style: 'Casual' },
  'en-au-x-aub-local': { name: 'Braith', gender: 'male', style: 'Friendly' },
  'en-au-x-aud-local': { name: 'Lachlan', gender: 'male', style: 'Deep' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Indian English (en-IN)
  // ═══════════════════════════════════════════════════════════════════════════
  'en-in-x-ena-network': { name: 'Farah', gender: 'female', style: 'Clear' },
  'en-in-x-enc-network': { name: 'Atika', gender: 'female', style: 'Warm' },
  'en-in-x-end-network': { name: 'Husam', gender: 'male', style: 'Professional' },
  'en-in-x-ene-network': { name: 'Salah', gender: 'male', style: 'Clear' },
  // Local variants
  'en-in-x-ena-local': { name: 'Farah', gender: 'female', style: 'Clear' },
  'en-in-x-enc-local': { name: 'Atika', gender: 'female', style: 'Warm' },
  'en-in-x-end-local': { name: 'Husam', gender: 'male', style: 'Professional' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Google Cloud TTS (Wavenet/Standard)
  // ═══════════════════════════════════════════════════════════════════════════
  'en-US-Wavenet-A': { name: 'Wavenet A', gender: 'male', style: 'Standard' },
  'en-US-Wavenet-B': { name: 'Wavenet B', gender: 'male', style: 'Deep' },
  'en-US-Wavenet-C': { name: 'Wavenet C', gender: 'female', style: 'Warm' },
  'en-US-Wavenet-D': { name: 'Wavenet D', gender: 'male', style: 'Clear' },
  'en-US-Wavenet-E': { name: 'Wavenet E', gender: 'female', style: 'Bright' },
  'en-US-Wavenet-F': { name: 'Wavenet F', gender: 'female', style: 'Soft' },
  'en-GB-Wavenet-A': { name: 'Wavenet A', gender: 'female', style: 'Elegant' },
  'en-GB-Wavenet-B': { name: 'Wavenet B', gender: 'male', style: 'Deep' },
  'en-GB-Standard-A': { name: 'Standard A', gender: 'female', style: 'Clear' },
  'en-GB-Standard-B': { name: 'Standard B', gender: 'male', style: 'Clear' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Apple iOS voices
  // ═══════════════════════════════════════════════════════════════════════════
  'com.apple.ttsbundle.Samantha-compact': { name: 'Samantha', gender: 'female', style: 'Friendly' },
  'com.apple.ttsbundle.Daniel-compact': { name: 'Daniel', gender: 'male', style: 'Clear' },
  'com.apple.ttsbundle.Karen-compact': { name: 'Karen', gender: 'female', style: 'Warm' },
  'com.apple.voice.compact.en-US.Samantha': { name: 'Samantha', gender: 'female', style: 'Friendly' },
  'com.apple.voice.enhanced.en-US.Samantha': { name: 'Samantha', gender: 'female', style: 'Enhanced' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Amazon Polly voices
  // ═══════════════════════════════════════════════════════════════════════════
  Joanna: { name: 'Joanna', gender: 'female', style: 'Conversational' },
  Matthew: { name: 'Matthew', gender: 'male', style: 'Conversational' },
  Ivy: { name: 'Ivy', gender: 'female', style: 'Child' },
  Kendra: { name: 'Kendra', gender: 'female', style: 'Professional' },
  Joey: { name: 'Joey', gender: 'male', style: 'Casual' },
  Salli: { name: 'Salli', gender: 'female', style: 'Warm' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Microsoft Azure Neural voices
  // ═══════════════════════════════════════════════════════════════════════════
  'en-US-JennyNeural': { name: 'Jenny', gender: 'female', style: 'Friendly' },
  'en-US-GuyNeural': { name: 'Guy', gender: 'male', style: 'Casual' },
  'en-US-AriaNeural': { name: 'Aria', gender: 'female', style: 'Professional' },
  'en-GB-SoniaNeural': { name: 'Sonia', gender: 'female', style: 'Warm' },
  'en-GB-RyanNeural': { name: 'Ryan', gender: 'male', style: 'Professional' },
};

export const getVoiceMapping = (
  identifier: string,
): VoiceMapping | undefined => {
  // Try exact match first
  if (GOOGLE_TTS_VOICE_MAP[identifier]) {
    return GOOGLE_TTS_VOICE_MAP[identifier];
  }
  // Try lowercase match (some devices report different casing)
  const lowerKey = identifier.toLowerCase();
  for (const [key, value] of Object.entries(GOOGLE_TTS_VOICE_MAP)) {
    if (key.toLowerCase() === lowerKey) {
      return value;
    }
  }
  return undefined;
};
