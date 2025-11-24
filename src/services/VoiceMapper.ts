export interface VoiceMapping {
    label: string;
    gender: 'male' | 'female' | 'neutral';
}

export const GOOGLE_TTS_VOICE_MAP: Record<string, VoiceMapping> = {
    // US English
    'en-us-x-iob-network': { label: 'English (US) - Female voice 1', gender: 'female' },
    'en-us-x-iol-network': { label: 'English (US) - Male voice 2', gender: 'male' }, // High quality
    'en-us-x-iog-network': { label: 'English (US) - Female voice 3', gender: 'female' },
    'en-us-x-iom-network': { label: 'English (US) - Male voice 1', gender: 'male' },
    'en-us-x-tpf-network': { label: 'English (US) - Female voice 4', gender: 'female' },
    'en-us-x-tpd-network': { label: 'English (US) - Male voice 3', gender: 'male' },
    'en-us-x-sfg-network': { label: 'English (US) - Female voice 5', gender: 'female' }, // Normal quality

    // UK English
    'en-gb-x-gba-network': { label: 'English (UK) - Female voice 1', gender: 'female' },
    'en-gb-x-gbc-network': { label: 'English (UK) - Female voice 2', gender: 'female' },
    'en-gb-x-gbg-network': { label: 'English (UK) - Female voice 3', gender: 'female' },
    'en-gb-x-rjs-network': { label: 'English (UK) - Male voice 1', gender: 'male' },
    'en-gb-x-gbb-network': { label: 'English (UK) - Male voice 2', gender: 'male' },
    'en-gb-x-gbd-network': { label: 'English (UK) - Male voice 3', gender: 'male' },

    // Australian English
    'en-au-x-aua-network': { label: 'English (Australia) - Female voice 1', gender: 'female' },
    'en-au-x-auc-network': { label: 'English (Australia) - Female voice 2', gender: 'female' },
    'en-au-x-aub-network': { label: 'English (Australia) - Male voice 1', gender: 'male' },
    'en-au-x-aud-network': { label: 'English (Australia) - Male voice 2', gender: 'male' },

    // Indian English
    'en-in-x-ena-network': { label: 'English (India) - Female voice 1', gender: 'female' },
    'en-in-x-enc-network': { label: 'English (India) - Female voice 2', gender: 'female' },
    'en-in-x-end-network': { label: 'English (India) - Male voice 1', gender: 'male' },
    // Add more as needed
};

export const getVoiceMapping = (identifier: string): VoiceMapping | undefined => {
    return GOOGLE_TTS_VOICE_MAP[identifier];
};
