import { Voice } from 'expo-speech';

import { getMMKVObject, setMMKVObject, MMKVStorage } from '@utils/mmkv/mmkv';

export type NovelTtsSettings = {
  enabled: boolean;
  tts: {
    voice?: Voice;
    rate?: number;
    pitch?: number;
  };
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
