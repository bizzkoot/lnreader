import {
  NativeModules,
  NativeEventEmitter,
  EmitterSubscription,
} from 'react-native';
import { getVoiceMapping } from './VoiceMapper';
import TTSAudioManager from './TTSAudioManager';

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

class TTSHighlightService {
  async speak(text: string, params: TTSParams = {}): Promise<string> {
    // Try preferred voice first, retry once if it fails, then fallback to system default
    let attempts = 0;
    let lastError: any = null;
    const maxAttempts = 2;
    const { voice, rate = 1, pitch = 1, utteranceId } = params;
    while (attempts < maxAttempts) {
      try {
        await TTSHighlight.speak(text, { voice, rate, pitch, utteranceId });
        return utteranceId || Date.now().toString();
      } catch (error) {
        lastError = error;
        attempts++;
      }
    }
    // Fallback: try with system default voice
    try {
      await TTSHighlight.speak(text, { rate, pitch, utteranceId });
      // Fallback notification: log warning
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('Preferred TTS voice unavailable, using system default.');
      }
      return utteranceId || Date.now().toString();
    } catch (error) {
      throw lastError || error;
    }
  }

  async speakBatch(
    texts: string[],
    utteranceIds: string[],
    params: TTSParams = {}
  ): Promise<number> {
    return TTSAudioManager.speakBatch(texts, utteranceIds, params);
  }

  /**
   * Add items to the existing TTS queue using QUEUE_ADD mode.
   * This preserves any currently playing or queued utterances.
   * Use this when the first paragraph was already queued via speak().
   */
  async addToBatch(
    texts: string[],
    utteranceIds: string[],
  ): Promise<boolean> {
    return TTSHighlight.addToBatch(texts, utteranceIds);
  }

  stop(): Promise<boolean> {
    return TTSAudioManager.stop();
  }

  pause(): Promise<boolean> {
    return TTSAudioManager.stop();
  }

  getVoices(): Promise<TTSVoice[]> {
    return TTSHighlight.getVoices();
  }

  addListener(
    eventType:
      | 'onWordRange'
      | 'onSpeechStart'
      | 'onSpeechDone'
      | 'onSpeechError'
      | 'onQueueEmpty',
    listener: (event: any) => void,
  ): EmitterSubscription {
    return ttsEmitter.addListener(eventType, listener);
  }

  formatVoiceName(voice: TTSVoice): string {
    // 1. Check explicit mapping
    const mapping = getVoiceMapping(voice.identifier);
    if (mapping) {
      return `${mapping.label} (${mapping.gender === 'male' ? 'Male' : 'Female'
        }) - ${voice.quality === '400' || voice.identifier.includes('network')
          ? 'High Quality'
          : 'Normal'
        }`;
    }

    // 2. Fallback: Parse technical name
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
      };
      return langMap[lang] || lang;
    };

    const prefix = getLanguageName(voice.language);

    let cleanId = voice.identifier;
    cleanId = cleanId.replace(/-x-/g, '-');
    cleanId = cleanId.replace(/-/g, ' ');
    if (cleanId.toLowerCase().startsWith(voice.language.toLowerCase())) {
      cleanId = cleanId.substring(voice.language.length).trim();
    }

    cleanId = cleanId.replace(/\b\w/g, l => l.toUpperCase());

    return `${prefix} - ${cleanId}`;
  }
}

export default new TTSHighlightService();
