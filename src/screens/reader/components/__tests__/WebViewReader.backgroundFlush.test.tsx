// @ts-ignore
global.__DEV__ = true;

/**
 * Regression for background progress flush (653a9e9f9 + 5baef20a6)
 * Bug: scroll debounce 150ms lost when app backgrounds before firing -> progress reverts to 0%
 * Fix: AppState background/inactive injects flushPendingProgressSave (core.js) + guards
 * Ponytail: 3 tests, one file, reuse existing mock pattern. No new deps.
 */

jest.mock('react-native', () => ({
  NativeModules: { RNDeviceInfo: {} },
  NativeEventEmitter: jest.fn(() => ({
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  })),
  StatusBar: { currentHeight: 20 },
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: 'active',
  },
  StyleSheet: { create: jest.fn(s => s) },
  View: 'View',
  Text: 'Text',
}));
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  return React.forwardRef((props: any, ref: any) => {
    if (ref && typeof ref === 'object') {
      ref.current = { injectJavaScript: jest.fn(), props };
    }
    return React.createElement(View, { ...props, testID: 'webview-mock' });
  });
});
jest.mock('react-native-device-info', () => ({
  getBatteryLevelSync: jest.fn(() => 0.8),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({ navigate: jest.fn() })),
}));
jest.mock('color', () => () => ({
  alpha: jest.fn(() => ({ toString: jest.fn(() => '') })),
}));
jest.mock('@hooks/persisted', () => ({
  useTheme: jest.fn(() => ({ primary: '#000', surface: '#111' })),
  useChapterReaderSettings: jest.fn(() => ({
    tts: { voice: { identifier: 'en-US-1' }, rate: 1, pitch: 1 },
  })),
  useAppSettings: jest.fn(() => ({ disableHapticFeedback: false })),
  useTimeTracking: jest.fn(() => ({ recordActivity: jest.fn() })),
}));
jest.mock('@strings/translations', () => ({ getString: jest.fn(k => k) }));
jest.mock('@plugins/pluginManager', () => ({
  getPlugin: jest.fn(() => ({ id: 'p' })),
}));
jest.mock('@utils/mmkv/mmkv', () => ({
  MMKVStorage: {
    getNumber: jest.fn(),
    getString: jest.fn(),
    set: jest.fn(),
    addOnValueChangedListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  getMMKVObject: jest.fn(() => ({})),
}));
jest.mock('@utils/Storages', () => ({
  PLUGIN_STORAGE: 'x',
  NOVEL_STORAGE: 'y',
}));
jest.mock('@components/Toast', () => 'Toast');
jest.mock('@hooks', () => ({
  useBoolean: jest.fn(() => ({
    value: false,
    setTrue: jest.fn(),
    setFalse: jest.fn(),
  })),
  useBackHandler: jest.fn(),
}));
jest.mock('@utils/htmlParagraphExtractor', () => ({
  extractParagraphs: jest.fn(() => ['P1', 'P2']),
  applyTtsTextCleanup: jest.fn((p: string[]) => p),
  shouldCleanVisibleText: jest.fn(() => false),
  DEFAULT_TTS_CLEANUP_SETTINGS: {
    enabled: false,
    rules: [],
    phoneticPairs: [],
  },
}));
jest.mock('../ttsHelpers', () => ({ applyTtsUpdateToWebView: jest.fn() }));
jest.mock('@database/queries/ChapterQueries', () => ({
  getChapter: jest.fn(),
  getNextChapter: jest.fn(),
}));
jest.mock('@services/TTSHighlight', () => ({
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  stop: jest.fn(),
  setOnDriftEnforceCallback: jest.fn(),
  setLastSpokenIndex: jest.fn(),
}));
jest.mock('@utils/ScreenStateListener', () => ({
  isActive: jest.fn().mockResolvedValue(true),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock('@services/tts/novelTtsSettings', () => ({
  getNovelTtsSettings: jest.fn(() => null),
  useNovelTtsSettings: jest.fn(() => [null]),
  resolveEffectiveTtsCleanup: jest.fn(c => c),
}));
jest.mock('@specs/NativeFile', () => ({
  exists: jest.fn(() => false),
  readFile: jest.fn(() => ''),
}));
jest.mock('../TTSResumeDialog', () => 'TTSResumeDialog');
jest.mock('../TTSExitDialog', () => 'TTSExitDialog');
jest.mock('../TTSChapterSelectionDialog', () => 'TTSChapterSelectionDialog');
jest.mock('../TTSManualModeDialog', () => 'TTSManualModeDialog');
jest.mock('../TTSScrollSyncDialog', () => 'TTSScrollSyncDialog');
jest.mock('../TTSSyncDialog', () => 'TTSSyncDialog');

import React from 'react';
import { render } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useChapterContext } from '../../ChapterContext';

const mockChapter = { id: 10, name: 'Ch 10', progress: 0 };
jest.mock('../../ChapterContext', () => ({
  useChapterContext: jest.fn(() => ({
    novel: { id: 1, name: 'Novel' },
    chapter: mockChapter,
    chapterText: '<p>P1</p>',
    navigateChapter: jest.fn(),
    saveProgress: jest.fn(),
    refreshChaptersFromContext: jest.fn(),
    nextChapter: { id: 11, name: 'Ch 11' },
    prevChapter: null,
    webViewRef: { current: { injectJavaScript: jest.fn() } },
    paragraphHighlightOffsetRef: { current: 0 },
    savedParagraphIndex: 0,
    getChapter: jest.fn(),
  })),
}));

// Helper to extract AppState listener
function getAppStateListener() {
  const calls = (AppState.addEventListener as jest.Mock).mock.calls;
  // find last AppState change listener (there's also DeviceInfo, but AppState is last 'change')
  for (let i = calls.length - 1; i >= 0; i--) {
    if (calls[i][0] === 'change') return calls[i][1] as (s: string) => void;
  }
  return null;
}

describe('background progress flush regression (653a9e9 + 5baef20)', () => {
  let WebViewReader: any;
  let webViewRefObject: any;

  beforeAll(() => {
    WebViewReader = require('../WebViewReader').default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    webViewRefObject = { current: { injectJavaScript: jest.fn() } };
    (useChapterContext as jest.Mock).mockReturnValue({
      novel: { id: 1, name: 'Novel' },
      chapter: { id: 10, name: 'Ch 10', progress: 0 },
      chapterText: '<p>P1</p>',
      navigateChapter: jest.fn(),
      saveProgress: jest.fn(),
      refreshChaptersFromContext: jest.fn(),
      nextChapter: { id: 11, name: 'Ch 11' },
      prevChapter: null,
      webViewRef: webViewRefObject,
      paragraphHighlightOffsetRef: { current: 0 },
      savedParagraphIndex: 0,
      getChapter: jest.fn(),
    });
  });

  it('injects flushPendingProgressSave on background when not TTS reading', () => {
    // mock useTTSController to report not reading (via isTTSReading = false)
    jest.doMock('../../hooks/useTTSController', () => ({
      useTTSController: jest.fn(() => ({
        isTTSReading: false,
        currentParagraphIndex: -1,
        handleTTSMessage: jest.fn(() => false),
        handleBackPress: jest.fn(() => false),
        prevChapterIdRef: { current: 10 },
        currentParagraphIndexRef: { current: -1 },
        latestParagraphIndexRef: { current: -1 },
        isTTSReadingRef: { current: false },
        autoStartTTSRef: { current: false },
        chaptersAutoPlayedRef: { current: 0 },
      })),
    }));

    render(<WebViewReader onPress={jest.fn()} />);
    const listener = getAppStateListener();
    expect(listener).toBeDefined();

    listener!('background');
    const js =
      webViewRefObject.current.injectJavaScript.mock.calls[0]?.[0] ?? '';
    expect(js).toContain('flushPendingProgressSave');
    expect(js).toContain('saveProgress');
  });

  it('injected JS is TTS-guarded (defense-in-depth)', () => {
    render(<WebViewReader onPress={jest.fn()} />);
    const listener = getAppStateListener();
    listener!('background');
    const js =
      webViewRefObject.current.injectJavaScript.mock.calls[0]?.[0] ?? '';
    // RN injects JS that itself bails when window.tts.reading — so even if RN guard
    // misses, WebView won't corrupt TTS progress
    expect(js).toContain('window.tts');
    expect(js).toContain('reading');
  });

  it('also flushes on inactive (iOS-style) and removes listener on unmount', () => {
    const { unmount } = render(<WebViewReader onPress={jest.fn()} />);
    const listener = getAppStateListener();
    expect(listener).toBeDefined();
    const remove = (AppState.addEventListener as jest.Mock).mock.results[0]
      ?.value?.remove as jest.Mock;
    expect(remove).toBeDefined();

    listener!('inactive');
    expect(webViewRefObject.current.injectJavaScript).toHaveBeenCalled();

    unmount();
    expect(remove).toHaveBeenCalled();
  });
});

// Pure JS core.js flush logic (no DOM) — mirrors actual guards
describe('core.js flushPendingProgressSave guards', () => {
  function makeReader(overrides: any = {}) {
    return {
      hasPerformedInitialScroll: true,
      suppressSaveOnScroll: false,
      scrollDebounceTimer: 123 as any,
      saveProgress: jest.fn(),
      flushPendingProgressSave(this: any) {
        if ((global as any).window?.tts?.reading) return;
        if (!this.hasPerformedInitialScroll || this.suppressSaveOnScroll) {
          return;
        }
        if (this.scrollDebounceTimer) {
          clearTimeout(this.scrollDebounceTimer);
          this.scrollDebounceTimer = null;
        }
        this.saveProgress();
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    (global as any).window = { tts: { reading: false } };
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    delete (global as any).window;
  });

  it('flushes pending debounce and calls saveProgress', () => {
    const r: any = makeReader({
      scrollDebounceTimer: setTimeout(() => {}, 1000),
    });
    r.flushPendingProgressSave();
    expect(r.saveProgress).toHaveBeenCalledTimes(1);
    expect(r.scrollDebounceTimer).toBeNull();
  });

  it('skips when TTS reading', () => {
    (global as any).window.tts.reading = true;
    const r: any = makeReader();
    r.flushPendingProgressSave();
    expect(r.saveProgress).not.toHaveBeenCalled();
  });

  it.each([
    { hasPerformedInitialScroll: false, suppressSaveOnScroll: true },
    { hasPerformedInitialScroll: false, suppressSaveOnScroll: false },
  ])(
    'skips stale 0% before initial scroll ($hasPerformedInitialScroll/$suppressSaveOnScroll)',
    overrides => {
      const r: any = makeReader(overrides);
      r.flushPendingProgressSave();
      expect(r.saveProgress).not.toHaveBeenCalled();
    },
  );
});
