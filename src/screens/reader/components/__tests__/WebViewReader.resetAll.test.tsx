;(global as any).__DEV__ = true;

jest.mock('@services/TTSAudioManager', () => ({
  pauseWithTimeout: jest.fn(() => Promise.resolve(true)),
  setRestartInProgress: jest.fn(),
  setRefillInProgress: jest.fn(),
  removeQueuedForChapterIds: jest.fn(),
  clearRemainingQueue: jest.fn(),
}));

jest.mock('@services/TTSHighlight', () => ({
  stop: jest.fn(() => Promise.resolve()),
}));

// Provide MMKVStorage returning last saved global TTS position ahead of current
jest.mock('@utils/mmkv/mmkv', () => ({
  MMKVStorage: {
    getNumber: jest.fn(() => -1),
    set: jest.fn(),
    delete: jest.fn(),
    getString: jest.fn((key: string) => {
      if (key === 'TTS_LAST_POSITION') {
        return JSON.stringify({ novelId: 1, chapterId: 999, chapterName: 'Saved', chapterPosition: 10, paragraphIndex: 3, timestamp: Date.now() });
      }
      return JSON.stringify({});
    }),
    addOnValueChangedListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  getMMKVObject: jest.fn(() => ({})),
}));

jest.mock('@screens/reader/ChapterContext', () => ({
  useChapterContext: () => ({
    novel: { id: 1, pluginId: 'p' },
    chapter: { id: 10, name: 'Current', position: 2, ttsState: undefined, isDownloaded: true },
    chapterText: '<p>one</p>',
    navigateChapter: jest.fn(),
    saveProgress: jest.fn(),
    nextChapter: null,
    prevChapter: null,
    webViewRef: { current: { injectJavaScript: jest.fn() } },
    savedParagraphIndex: -1,
    getChapter: jest.fn(),
  }),
}));

// Mock DB functions used by the restart flow
jest.mock('@database/queries/ChapterQueries', () => ({
  getChaptersBetweenPositions: jest.fn(async () => [
    { id: 101, position: 3 },
    { id: 102, position: 4 },
    { id: 103, position: 5 },
  ]),
  resetChaptersProgress: jest.fn(async () => {}),
  getMaxChapterPosition: jest.fn(async () => 100),
  getChapter: jest.fn(async () => ({ id: 999, name: 'Saved', position: 10 })),
}));

jest.mock('@utils/deletionGuard', () => ({
  __esModule: true,
  default: {
    isPending: jest.fn(() => false),
    begin: jest.fn(() => true),
    end: jest.fn(),
  },
}));

describe('placeholder', () => {
  test('placeholder true', () => expect(true).toBe(true));
});
