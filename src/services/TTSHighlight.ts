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
  speak(text: string, params: TTSParams = {}): Promise<string> {
    // For single text, use direct speak
    return TTSHighlight.speak(text, params);
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
