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

export type TTSMediaState = {
  novelName: string;
  chapterLabel: string;
  chapterId: number | null;
  paragraphIndex: number;
  totalParagraphs: number;
  isPlaying: boolean;
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
    params: TTSParams = {},
  ): Promise<number> {
    return TTSAudioManager.speakBatch(texts, utteranceIds, params);
  }

  /**
   * Add items to the existing TTS queue using QUEUE_ADD mode.
   * This preserves any currently playing or queued utterances.
   * Use this when the first paragraph was already queued via speak().
   */
  async addToBatch(texts: string[], utteranceIds: string[]): Promise<boolean> {
    return TTSHighlight.addToBatch(texts, utteranceIds);
  }

  stop(): Promise<boolean> {
    return TTSAudioManager.stop();
  }

  /**
   * Stop playback AND clear the restart flag.
   * Use this for user-initiated stops (not for restart operations).
   */
  fullStop(): Promise<boolean> {
    return TTSAudioManager.fullStop();
  }

  /**
   * Mark that a restart operation is beginning.
   * This prevents onQueueEmpty from firing during intentional stop/restart cycles.
   */
  setRestartInProgress(value: boolean) {
    TTSAudioManager.setRestartInProgress(value);
  }

  /**
   * Check if a restart operation is in progress.
   */
  isRestartInProgress(): boolean {
    return TTSAudioManager.isRestartInProgress();
  }

  /**
   * Mark that a refill operation is beginning.
   * This prevents onQueueEmpty from firing during async refill operations.
   */
  setRefillInProgress(value: boolean) {
    TTSAudioManager.setRefillInProgress(value);
  }

  /**
   * Check if a refill operation is in progress.
   */
  isRefillInProgress(): boolean {
    return TTSAudioManager.isRefillInProgress();
  }

  /**
   * Check if TTSAudioManager still has items remaining to queue.
   * Used to prevent premature onQueueEmpty from triggering chapter navigation.
   */
  hasRemainingItems(): boolean {
    return TTSAudioManager.hasRemainingItems();
  }

  hasQueuedNativeInCurrentSession(): boolean {
    return TTSAudioManager.hasQueuedNativeInCurrentSession();
  }

  pause(): Promise<boolean> {
    return TTSHighlight.pause();
  }

  updateMediaState(state: TTSMediaState): Promise<boolean> {
    return TTSHighlight.updateMediaState(state);
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
      | 'onQueueEmpty'
      | 'onVoiceFallback' // FIX Case 7.2: Voice fallback notification
      | 'onMediaAction',
    listener: (event: any) => void,
  ): EmitterSubscription {
    return ttsEmitter.addListener(eventType, listener);
  }

  formatVoiceName(voice: TTSVoice): string {
    // Language display map (compact)
    const getLanguageShort = (lang: string): string => {
      const langMap: Record<string, string> = {
        'en-US': 'English (US)',
        'en-GB': 'English (UK)',
        'en-AU': 'English (AU)',
        'en-IN': 'English (IN)',
        'es-ES': 'Spanish (ES)',
        'es-US': 'Spanish (US)',
        'es-MX': 'Spanish (MX)',
        'fr-FR': 'French (FR)',
        'fr-CA': 'French (CA)',
        'de-DE': 'German',
        'it-IT': 'Italian',
        'ja-JP': 'Japanese',
        'ko-KR': 'Korean',
        'zh-CN': 'Chinese (CN)',
        'zh-TW': 'Chinese (TW)',
        'pt-BR': 'Portuguese (BR)',
        'pt-PT': 'Portuguese (PT)',
        'ru-RU': 'Russian',
        'hi-IN': 'Hindi',
        'ar-XA': 'Arabic',
      };
      return langMap[lang] || lang || 'Unknown';
    };

    // Determine if high quality (fallback) — but prefer explicit native match type
    const isHQ =
      (voice.quality && Number(voice.quality) >= 400) ||
      /network|wavenet|neural|enhanced/i.test(voice.identifier);
    const hqMarker = isHQ ? ' • HQ' : '';

    // 1. Check explicit mapping (curated voices with real names)
    const mapping = getVoiceMapping(voice.identifier);
    if (mapping) {
      const lang = getLanguageShort(voice.language);
      // Simplify name: remove duplicate region info like "(US)" if already in lang
      let simpleName = mapping.name || 'Voice';
      simpleName = simpleName.replace(/\s*\([A-Z]{2,}\)$/i, '').trim();
      // Abbreviate "voice" in generic names: "Female voice 2" -> "Female 2"
      simpleName = simpleName.replace(/\bvoice\s*/i, '').trim();

      const styleInfo = mapping.style ? ` — ${mapping.style}` : '';
      // Prefer explicit native type tag over generic HQ marker
      const nativeTag =
        mapping.matchedNativeType === 'local'
          ? ' — LOCAL'
          : mapping.matchedNativeType === 'network'
            ? ' — NETWORK'
            : '';

      // Format: "English (UK) — Male 1 — Clear — LOCAL"
      return `${lang} — ${simpleName}${styleInfo}${nativeTag || hqMarker}`;
    }

    // 2. Fallback: Parse technical identifier into readable format
    const lang = getLanguageShort(voice.language);

    let id = voice.identifier || '';
    // Clean up common noise
    id = id.replace(/-x-/g, '-');
    id = id.replace(
      /com\.apple\.(ttsbundle|voice)\.(compact|enhanced)\./gi,
      '',
    );
    id = id.replace(/com\.apple\.ttsbundle\./gi, '');
    id = id.replace(/-network|-local|\.compact|_compact/gi, '');
    id = id.replace(/[._]+/g, ' ');

    // Extract meaningful tokens
    const tokens = id.split(/[-\s]+/).filter(Boolean);

    // Try to find a name-like token (skip language codes)
    let friendly = '';
    const langCodePattern =
      /^(en|es|fr|de|it|ja|ko|zh|pt|ru|hi|ar)[-_]?[a-z]{0,2}$/i;

    if (/wavenet/i.test(id)) {
      const idx = tokens.findIndex(t => /wavenet/i.test(t));
      friendly = tokens.slice(idx, idx + 2).join(' ');
    } else if (/standard/i.test(id)) {
      const idx = tokens.findIndex(t => /standard/i.test(t));
      friendly = tokens.slice(idx, idx + 2).join(' ');
    } else if (/neural/i.test(id)) {
      // Azure neural: extract name before Neural
      const idx = tokens.findIndex(t => /neural/i.test(t));
      if (idx > 0) {
        friendly = tokens[idx - 1];
      } else {
        friendly = tokens.slice(idx, idx + 2).join(' ');
      }
    } else {
      // Take last meaningful token(s), skip language codes
      const meaningfulTokens = tokens.filter(
        t => !langCodePattern.test(t) && t.length > 1,
      );
      friendly =
        meaningfulTokens.slice(-2).join(' ') ||
        tokens[tokens.length - 1] ||
        'Voice';
    }

    // Title case
    friendly = friendly
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
      .trim();

    if (!friendly) friendly = 'Voice';

    // Format: "English (US) — Sfg — HQ" (fallback, no gender/style info)
    return `${lang} — ${friendly}${hqMarker}`;
  }
}

export default new TTSHighlightService();
