import { NativeModules, NativeEventEmitter, EmitterSubscription } from 'react-native';

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
}

export default new TTSHighlightService();
