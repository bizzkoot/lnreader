import { NativeModules, NativeEventEmitter, EmitterSubscription } from 'react-native';
import { getVoiceMapping } from './VoiceMapper';

const { TTSHighlight } = NativeModules;

const ttsEmitter = new NativeEventEmitter(TTSHighlight);

export type TTSVoice = {
  identifier: string;
  name: string;
  language: string;
  quality: string;
};

export type TTSParams = {
  rate?: number;
  pitch?: number;
  voice?: string;
  utteranceId?: string;
};

export type WordRangeEvent = {
  utteranceId: string;
  start: number;
  end: number;
  frame: number;
};

class TTSHighlightService {
  speak(text: string, params: TTSParams = {}): Promise<string> {
    return TTSHighlight.speak(text, params);
  }

  stop(): Promise<boolean> {
    return TTSHighlight.stop();
  }

  pause(): Promise<boolean> {
    return TTSHighlight.pause();
  }

  getVoices(): Promise<TTSVoice[]> {
    return TTSHighlight.getVoices();
  }

  addListener(
    eventType: 'onWordRange' | 'onSpeechStart' | 'onSpeechDone' | 'onSpeechError',
    listener: (event: any) => void
  ): EmitterSubscription {
    return ttsEmitter.addListener(eventType, listener);
  }

  formatVoiceName(voice: TTSVoice): string {
    // 1. Check explicit mapping
    const mapping = getVoiceMapping(voice.identifier);
    if (mapping) {
      return `${mapping.label} (${mapping.gender === 'male' ? 'Male' : 'Female'}) - ${voice.quality === '400' || voice.identifier.includes('network') ? 'High Quality' : 'Normal'}`;
    }

    // 2. Fallback: Parse technical name
    // Try to derive a readable name from the identifier and language

    // Helper to get language name (basic implementation)
    const getLanguageName = (lang: string) => {
      const langMap: Record<string, string> = {
        'en-US': 'English (US)',
        'en-GB': 'English (UK)',
        'en-AU': 'English (Australia)',
        'en-IN': 'English (India)',
        'es-ES': 'Spanish (Spain)',
        'es-US': 'Spanish (US)',
        'fr-FR': 'French (France)',
        'de-DE': 'German (Germany)',
        'it-IT': 'Italian (Italy)',
        'ja-JP': 'Japanese (Japan)',
        'ko-KR': 'Korean (South Korea)',
        'zh-CN': 'Chinese (China)',
        'zh-TW': 'Chinese (Taiwan)',
        // Add more as needed or fallback to code
      };
      return langMap[lang] || lang;
    };

    const prefix = getLanguageName(voice.language);

    // Clean up identifier
    let cleanId = voice.identifier;
    cleanId = cleanId.replace(/-x-/g, '-');
    cleanId = cleanId.replace(/-/g, ' ');
    // Remove language code from start if present to avoid redundancy
    if (cleanId.toLowerCase().startsWith(voice.language.toLowerCase())) {
      cleanId = cleanId.substring(voice.language.length).trim();
    }

    // Capitalize words
    cleanId = cleanId.replace(/\b\w/g, l => l.toUpperCase());

    return `${prefix} - ${cleanId}`;
  }
}

export default new TTSHighlightService();
