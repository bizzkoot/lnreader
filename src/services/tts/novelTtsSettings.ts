import { Voice } from 'expo-speech';

import { getMMKVObject, setMMKVObject, MMKVStorage } from '@utils/mmkv/mmkv';
import { useMMKVObject } from 'react-native-mmkv';
import { TtsTextCleanupSettings } from '@utils/htmlParagraphExtractor';

export type NovelTtsSettings = {
  enabled: boolean;
  tts: {
    voice?: Voice;
    rate?: number;
    pitch?: number;
    engine?: string;
  };
  /**
   * Per-novel TTS text cleanup. When present (and per-novel mode is
   * enabled), this REPLACES the global cleanup for the novel. Absent for
   * legacy stored objects, in which case the global cleanup applies.
   */
  ttsTextCleanup?: TtsTextCleanupSettings;
};

const keyForNovelTtsSettings = (novelId: number) =>
  `NOVEL_TTS_SETTINGS_${novelId}`;

export const getNovelTtsSettings = (novelId: number) =>
  getMMKVObject<NovelTtsSettings>(keyForNovelTtsSettings(novelId));

export const setNovelTtsSettings = (novelId: number, value: NovelTtsSettings) =>
  setMMKVObject(keyForNovelTtsSettings(novelId), value);

export const deleteNovelTtsSettings = (novelId: number) => {
  MMKVStorage.delete(keyForNovelTtsSettings(novelId));
};

export const useNovelTtsSettings = (novelId?: number) => {
  return useMMKVObject<NovelTtsSettings>(
    novelId ? keyForNovelTtsSettings(novelId) : 'DUMMY_KEY_NEVER_USED',
  );
};

/**
 * Resolve the effective TTS text-cleanup settings for a novel: the
 * per-novel override when per-novel TTS is enabled AND a cleanup override
 * was saved, otherwise the global cleanup. Any MMKV read failure degrades
 * to the global settings.
 */
export function resolveEffectiveTtsCleanup(
  globalCleanup: TtsTextCleanupSettings | null | undefined,
  novelId?: number,
): TtsTextCleanupSettings | null | undefined {
  if (typeof novelId === 'number') {
    try {
      const stored = getNovelTtsSettings(novelId);
      if (stored?.enabled && stored.ttsTextCleanup) {
        return stored.ttsTextCleanup;
      }
    } catch {
      // Fall through to global on any MMKV read failure.
    }
  }
  return globalCleanup;
}
