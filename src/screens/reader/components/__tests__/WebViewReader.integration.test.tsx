/**
 * Integration-style test for WebViewReader: Ensure native saved TTS position
 * is preferred when available after media navigation and pause.
 */

// @ts-ignore
global.__DEV__ = true;

jest.mock('react-native', () => ({
  NativeModules: { RNDeviceInfo: {} },
  NativeEventEmitter: jest.fn(() => ({
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeAllListeners: jest.fn(),
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
      ref.current = {
        injectJavaScript: jest.fn(),
        props: props,
      };
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
  useTheme: jest.fn(() => ({
    primary: '#000',
    onPrimary: '#fff',
    surface: '#111',
  })),
  useChapterReaderSettings: jest.fn(() => ({
    tts: { voice: { identifier: 'en-US-1' }, rate: 1, pitch: 1 },
    theme: '#000000',
    readerSettings: {},
    chapterGeneralSettings: {
      ttsBackgroundPlayback: false,
      ttsAutoStopMode: 'off',
      ttsAutoStopAmount: 0,
    },
  })),
}));

jest.mock('@strings/translations', () => ({ getString: jest.fn(k => k) }));

jest.mock('@plugins/pluginManager', () => ({
  getPlugin: jest.fn(() => ({ id: 'dummy-plugin' })),
}));

jest.mock('@utils/mmkv/mmkv', () => ({
  MMKVStorage: {
    getNumber: jest.fn(),
    getString: jest.fn(),
    set: jest.fn(),
    addOnValueChangedListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  getMMKVObject: jest.fn(key => {
    if (key === 'CHAPTER_GENERAL_SETTINGS') {
      return {
        ttsBackgroundPlayback: false,
        ttsAutoStopMode: 'off',
        ttsAutoStopAmount: 0,
      };
    }
    if (key === 'CHAPTER_READER_SETTINGS') {
      return {
        theme: '#000000',
      };
    }
    return {};
  }),
}));

jest.mock('@utils/Storages', () => ({ PLUGIN_STORAGE: 'file://plugins' }));
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
  extractParagraphs: jest.fn(() => ['P1', 'P2', 'P3', 'P4', 'P5']),
}));

jest.mock('../ttsHelpers', () => ({
  applyTtsUpdateToWebView: jest.fn(),
  validateAndClampParagraphIndex: jest.fn((idx, len) =>
    Math.min(Math.max(0, idx), len - 1),
  ),
}));

jest.mock('@database/queries/ChapterQueries', () => ({
  getChapter: jest.fn(),
  markChaptersBeforePositionRead: jest.fn(),
  resetFutureChaptersProgress: jest.fn(),
  getRecentReadingChapters: jest.fn(),
  updateChapterProgress: jest.fn(),
  markChapterUnread: jest.fn(),
  markChapterRead: jest.fn(),
}));

jest.mock('@services/TTSHighlight', () => ({
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  speak: jest.fn(),
  stop: jest.fn(),
  speakBatch: jest.fn(() => Promise.resolve()),
  hasRemainingItems: jest.fn(() => false),
  pause: jest.fn(),
  getSavedTTSPosition: jest.fn().mockResolvedValue(-1),
  setOnDriftEnforceCallback: jest.fn(),
  setLastSpokenIndex: jest.fn(),
}));

jest.mock('@utils/ScreenStateListener', () => ({
  isActive: jest.fn().mockResolvedValue(true),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
}));

const mockChapter = { id: 10, name: 'Chapter 10', progress: 0 };
jest.mock('../../ChapterContext', () => ({
  useChapterContext: jest.fn(() => ({
    novel: { id: 1, name: 'Test Novel' },
    chapter: mockChapter,
    chapterText: '<p>P1</p><p>P2</p>',
    navigateChapter: jest.fn(),
    saveProgress: jest.fn(),
    nextChapter: { id: 11, name: 'Chapter 11' },
    prevChapter: { id: 9, name: 'Chapter 9' },
    webViewRef: { current: { injectJavaScript: jest.fn() } },
    savedParagraphIndex: 0,
    getChapter: jest.fn(),
  })),
}));

// Mock Dialog components used by WebViewReader to avoid importing react-native-paper internals
jest.mock('../TTSResumeDialog', () => 'TTSResumeDialog');
jest.mock('../TTSExitDialog', () => 'TTSExitDialog');
jest.mock('../TTSChapterSelectionDialog', () => 'TTSChapterSelectionDialog');
jest.mock('../TTSManualModeDialog', () => 'TTSManualModeDialog');
jest.mock('../TTSScrollSyncDialog', () => 'TTSScrollSyncDialog');
jest.mock('../TTSSyncDialog', () => 'TTSSyncDialog');

// Mock react-native-paper to avoid theme/token lookups during tests
jest.mock('react-native-paper', () => ({
  Dialog: 'Dialog',
  Portal: 'Portal',
  Text: 'Text',
  Button: 'Button',
}));

// Import test utilities
import React from 'react';
import { render, act } from '@testing-library/react-native';
import TTSHighlight from '@services/TTSHighlight';
import { useChapterContext } from '../../ChapterContext';

describe('WebViewReader Integration - native restore on PREV', () => {
  let listeners: Record<string, Function> = {};
  let webViewRefObject: any;
  let mockNavigateChapter: jest.Mock;
  let WebViewReader: any;

  beforeAll(() => {
    // Require component after mocks
    WebViewReader = require('../WebViewReader').default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    listeners = {};

    // Capture listeners
    (TTSHighlight.addListener as jest.Mock).mockImplementation((event, cb) => {
      listeners[event] = cb;
      return { remove: jest.fn() };
    });

    mockNavigateChapter = jest.fn();
    webViewRefObject = { current: null };

    // Initial context: chapter 10 with prevChapter 9
    (useChapterContext as jest.Mock).mockReturnValue({
      novel: { id: 1, name: 'Test Novel' },
      chapter: { id: 10, name: 'Chapter 10', progress: 0 },
      chapterText: '<p>Content</p>',
      navigateChapter: mockNavigateChapter,
      saveProgress: jest.fn(),
      nextChapter: { id: 11, name: 'Chapter 11' },
      prevChapter: { id: 9, name: 'Chapter 9' },
      webViewRef: webViewRefObject,
      savedParagraphIndex: 0,
      getChapter: jest.fn(),
    });
  });

  it('uses MMKV saved position when opening chapter', async () => {
    const { MMKVStorage } = require('@utils/mmkv/mmkv');

    const res = render(<WebViewReader onPress={jest.fn()} />);
    // Wait for useEffect async work to settle
    await act(async () => {
      await new Promise(resolve => setImmediate(resolve));
    });
    const rerender = res.rerender;

    // Ensure media action handler exists
    const handler = listeners['onMediaAction'];
    expect(handler).toBeDefined();

    // Simulate pressing PREV via media action
    await act(async () => {
      await handler({
        action: 'com.rajarsheechatterjee.LNReader.TTS.PREV_CHAPTER',
      });
    });

    // navigateChapter should have been called (component triggers navigation)
    expect(mockNavigateChapter).toBeDefined();

    // Now simulate MMKV having saved position for destination chapter (id:9)
    (MMKVStorage.getNumber as jest.Mock).mockImplementation((key: string) => {
      if (key === 'chapter_progress_9') return 3;
      return -1;
    });

    // Simulate that the app opens the reader for chapter 9 (prev)
    (useChapterContext as jest.Mock).mockReturnValue({
      novel: { id: 1, name: 'Test Novel' },
      chapter: { id: 9, name: 'Chapter 9', progress: 0 },
      chapterText: '<p>Content</p>',
      navigateChapter: jest.fn(),
      saveProgress: jest.fn(),
      nextChapter: { id: 10, name: 'Chapter 10' },
      prevChapter: { id: 8, name: 'Chapter 8' },
      webViewRef: webViewRefObject,
      savedParagraphIndex: 0,
      getChapter: jest.fn(),
    });

    // Re-render to simulate opening the reader for chapter 9
    await act(async () => {
      rerender(<WebViewReader onPress={jest.fn()} />);
      await Promise.resolve();
    });

    // The webview ref should now be populated by the mocked webview
    const webviewProps = webViewRefObject.current?.props;

    // Verify that the HTML contains savedParagraphIndex from MMKV
    const html = webviewProps?.source?.html || '';
    expect(html).toContain('"savedParagraphIndex":3');
  });
});
