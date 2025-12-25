/**
 * Tests for useRefSync hook
 *
 * Focus: Test ref synchronization with props to avoid stale closures
 * Coverage targets:
 * - useRefSync() - Syncs progress, saveProgress, nextChapter, navigateChapter refs
 * - Multiple useEffect hooks for different refs
 * - Proper dependency arrays
 */

import { renderHook } from '@testing-library/react-hooks';
import { useRefSync, RefSyncParams } from '../useRefSync';
import type { ChapterInfo } from '@database/types';

// Mock React hooks
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useEffect: jest.fn((fn, deps) => {
    // Immediately execute the effect for testing
    if (deps && deps.length > 0) {
      fn();
    }
  }),
  useRef: jest.fn(initialValue => ({ current: initialValue })),
}));

const { useRef: originalUseRef } = require('react');

describe('useRefSync Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to original useRef for proper ref behavior
    jest.spyOn(require('react'), 'useRef').mockImplementation(originalUseRef);
  });

  const createMockParams = (
    overrides?: Partial<RefSyncParams>,
  ): RefSyncParams => ({
    progress: 50,
    saveProgress: jest.fn(),
    nextChapter: null,
    navigateChapter: jest.fn(),
    refs: {
      progressRef: { current: 0 },
      saveProgressRef: { current: jest.fn() },
      nextChapterRef: { current: null },
      navigateChapterRef: { current: jest.fn() },
    },
    ...overrides,
  });

  describe('Basic functionality', () => {
    it('should sync progress ref with progress prop', () => {
      const progressRef = { current: 0 };
      const params = createMockParams({
        progress: 75,
        refs: {
          progressRef,
          saveProgressRef: { current: jest.fn() },
          nextChapterRef: { current: null },
          navigateChapterRef: { current: jest.fn() },
        },
      });

      renderHook(() => useRefSync(params));

      expect(progressRef.current).toBe(75);
    });

    it('should sync saveProgress ref with saveProgress prop', () => {
      const mockSaveProgress = jest.fn();
      const saveProgressRef = {
        current: null,
      } as unknown as React.RefObject<
        (progress: number, paragraphIndex?: number, ttsState?: string) => void
      >;
      const params = createMockParams({
        saveProgress: mockSaveProgress,
        refs: {
          progressRef: { current: 50 },
          saveProgressRef,
          nextChapterRef: { current: null },
          navigateChapterRef: { current: jest.fn() },
        },
      });

      renderHook(() => useRefSync(params));

      expect(saveProgressRef.current).toBe(mockSaveProgress);
    });

    it('should sync nextChapter ref with nextChapter prop', () => {
      const mockNextChapter: ChapterInfo = {
        id: 100,
        novelId: 10,
        name: 'Chapter 100',
        path: '/test/chapter-100',
        releaseTime: undefined,
        readTime: null,
        bookmark: false,
        unread: true,
        isDownloaded: false,
        updatedTime: null,
        page: '1',
        progress: null,
      };
      const nextChapterRef = { current: null as ChapterInfo | null };
      const params = createMockParams({
        nextChapter: mockNextChapter,
        refs: {
          progressRef: { current: 50 },
          saveProgressRef: { current: jest.fn() },
          nextChapterRef,
          navigateChapterRef: { current: jest.fn() },
        },
      });

      renderHook(() => useRefSync(params));

      expect(nextChapterRef.current).toEqual(mockNextChapter);
    });

    it('should sync navigateChapter ref with navigateChapter prop', () => {
      const mockNavigateChapter = jest.fn();
      const navigateChapterRef = {
        current: null,
      } as unknown as React.RefObject<(direction: 'NEXT' | 'PREV') => void>;
      const params = createMockParams({
        navigateChapter: mockNavigateChapter,
        refs: {
          progressRef: { current: 50 },
          saveProgressRef: { current: jest.fn() },
          nextChapterRef: { current: null as ChapterInfo | null },
          navigateChapterRef,
        },
      });

      renderHook(() => useRefSync(params));

      expect(navigateChapterRef.current).toBe(mockNavigateChapter);
    });
  });

  describe('Effect dependencies', () => {
    it('should update progress ref when progress changes', () => {
      const progressRef = { current: 0 };
      const params = createMockParams({
        refs: {
          progressRef,
          saveProgressRef: { current: jest.fn() },
          nextChapterRef: { current: null },
          navigateChapterRef: { current: jest.fn() },
        },
      });

      const { rerender } = renderHook(
        ({ progress }) => useRefSync({ ...params, progress }),
        { initialProps: { progress: 50 } as { progress: number } },
      );

      expect(progressRef.current).toBe(50);

      // Update progress
      rerender({ progress: 80 });
      expect(progressRef.current).toBe(80);
    });

    it('should update saveProgress ref when callback changes', () => {
      const saveProgressRef = { current: jest.fn() };
      const mockCallback1 = jest.fn();
      const mockCallback2 = jest.fn();

      const params = createMockParams({
        saveProgress: mockCallback1,
        refs: {
          progressRef: { current: 50 },
          saveProgressRef,
          nextChapterRef: { current: null },
          navigateChapterRef: { current: jest.fn() },
        },
      });

      const { rerender } = renderHook(
        ({ saveProgress }) => useRefSync({ ...params, saveProgress }),
        { initialProps: { saveProgress: mockCallback1 } },
      );

      expect(saveProgressRef.current).toBe(mockCallback1);

      // Update callback
      rerender({ saveProgress: mockCallback2 });
      expect(saveProgressRef.current).toBe(mockCallback2);
    });

    it('should update nextChapter ref when chapter changes', () => {
      const nextChapterRef = { current: null as ChapterInfo | null };
      const chapter1: ChapterInfo = {
        id: 1,
        novelId: 10,
        name: 'Chapter 1',
        path: '/test/ch1',
        releaseTime: undefined,
        readTime: null,
        bookmark: false,
        unread: true,
        isDownloaded: false,
        updatedTime: null,
        page: '1',
        progress: null,
      };
      const chapter2: ChapterInfo = {
        id: 2,
        novelId: 10,
        name: 'Chapter 2',
        path: '/test/ch2',
        releaseTime: undefined,
        readTime: null,
        bookmark: false,
        unread: true,
        isDownloaded: false,
        updatedTime: null,
        page: '2',
        progress: null,
      };

      const params = createMockParams({
        nextChapter: chapter1,
        refs: {
          progressRef: { current: 50 },
          saveProgressRef: { current: jest.fn() },
          nextChapterRef,
          navigateChapterRef: { current: jest.fn() },
        },
      });

      const { rerender } = renderHook(
        ({ nextChapter }) => useRefSync({ ...params, nextChapter }),
        { initialProps: { nextChapter: chapter1 } },
      );

      expect(nextChapterRef.current).toBe(chapter1);

      // Update chapter
      rerender({ nextChapter: chapter2 });
      expect(nextChapterRef.current).toBe(chapter2);
    });

    it('should update navigateChapter ref when callback changes', () => {
      const navigateChapterRef = { current: jest.fn() };
      const mockNav1 = jest.fn();
      const mockNav2 = jest.fn();

      const params = createMockParams({
        navigateChapter: mockNav1,
        refs: {
          progressRef: { current: 50 },
          saveProgressRef: { current: jest.fn() },
          nextChapterRef: { current: null },
          navigateChapterRef,
        },
      });

      const { rerender } = renderHook(
        ({ navigateChapter }) => useRefSync({ ...params, navigateChapter }),
        { initialProps: { navigateChapter: mockNav1 } },
      );

      expect(navigateChapterRef.current).toBe(mockNav1);

      // Update callback
      rerender({ navigateChapter: mockNav2 });
      expect(navigateChapterRef.current).toBe(mockNav2);
    });
  });

  describe('Edge cases', () => {
    it('should handle null nextChapter', () => {
      const nextChapterRef = {
        current: {
          id: 1,
          novelId: 10,
          path: '/test',
          name: 'Test',
          releaseTime: undefined,
          readTime: null,
          bookmark: false,
          unread: true,
          isDownloaded: false,
          updatedTime: null,
          page: '1',
          progress: null,
        } as ChapterInfo,
      };
      const params = createMockParams({
        nextChapter: null,
        refs: {
          progressRef: { current: 50 },
          saveProgressRef: { current: jest.fn() },
          nextChapterRef,
          navigateChapterRef: { current: jest.fn() },
        },
      });

      renderHook(() => useRefSync(params));

      expect(nextChapterRef.current).toBeNull();
    });

    it('should handle undefined nextChapter', () => {
      const nextChapterRef = {
        current: {
          id: 1,
          novelId: 10,
          path: '/test',
          name: 'Test',
          releaseTime: undefined,
          readTime: null,
          bookmark: false,
          unread: true,
          isDownloaded: false,
          updatedTime: null,
          page: '1',
          progress: null,
        } as ChapterInfo,
      };
      const params = createMockParams({
        nextChapter: undefined,
        refs: {
          progressRef: { current: 50 },
          saveProgressRef: { current: jest.fn() },
          nextChapterRef,
          navigateChapterRef: { current: jest.fn() },
        },
      });

      renderHook(() => useRefSync(params));

      expect(nextChapterRef.current).toBeUndefined();
    });

    it('should handle zero progress', () => {
      const progressRef = { current: 50 };
      const params = createMockParams({
        progress: 0,
        refs: {
          progressRef,
          saveProgressRef: { current: jest.fn() },
          nextChapterRef: { current: null },
          navigateChapterRef: { current: jest.fn() },
        },
      });

      renderHook(() => useRefSync(params));

      expect(progressRef.current).toBe(0);
    });

    it('should handle 100% progress', () => {
      const progressRef = { current: 50 };
      const params = createMockParams({
        progress: 100,
        refs: {
          progressRef,
          saveProgressRef: { current: jest.fn() },
          nextChapterRef: { current: null },
          navigateChapterRef: { current: jest.fn() },
        },
      });

      renderHook(() => useRefSync(params));

      expect(progressRef.current).toBe(100);
    });

    it('should handle negative progress (edge case)', () => {
      const progressRef = { current: 50 };
      const params = createMockParams({
        progress: -1,
        refs: {
          progressRef,
          saveProgressRef: { current: jest.fn() },
          nextChapterRef: { current: null },
          navigateChapterRef: { current: jest.fn() },
        },
      });

      renderHook(() => useRefSync(params));

      expect(progressRef.current).toBe(-1);
    });
  });

  describe('Integration scenarios', () => {
    it('should sync all refs on initial render', () => {
      const progressRef = { current: 0 };
      const saveProgressRefLocal = {
        current: null,
      } as unknown as React.RefObject<
        (progress: number, paragraphIndex?: number, ttsState?: string) => void
      >;
      const nextChapterRef = { current: null as ChapterInfo | null };
      const navigateChapterRefLocal = {
        current: null,
      } as unknown as React.RefObject<(direction: 'NEXT' | 'PREV') => void>;

      const mockSaveProgress = jest.fn();
      const mockNavigateChapter = jest.fn();
      const mockNextChapter: ChapterInfo = {
        id: 1,
        novelId: 10,
        name: 'Test',
        path: '/test',
        releaseTime: undefined,
        readTime: null,
        bookmark: false,
        unread: true,
        isDownloaded: false,
        updatedTime: null,
        page: '1',
        progress: null,
      };

      const params: RefSyncParams = {
        progress: 25,
        saveProgress: mockSaveProgress,
        nextChapter: mockNextChapter,
        navigateChapter: mockNavigateChapter,
        refs: {
          progressRef,
          saveProgressRef: saveProgressRefLocal,
          nextChapterRef,
          navigateChapterRef: navigateChapterRefLocal,
        },
      };

      renderHook(() => useRefSync(params));

      expect(progressRef.current).toBe(25);
      expect(saveProgressRefLocal.current).toBe(mockSaveProgress);
      expect(nextChapterRef.current).toBe(mockNextChapter);
      expect(navigateChapterRefLocal.current).toBe(mockNavigateChapter);
    });

    it('should handle rapid prop changes', () => {
      const progressRef = { current: 0 };
      const params = createMockParams({
        refs: {
          progressRef,
          saveProgressRef: { current: jest.fn() },
          nextChapterRef: { current: null },
          navigateChapterRef: { current: jest.fn() },
        },
      });

      const { rerender } = renderHook(
        ({ progress }) => useRefSync({ ...params, progress }),
        { initialProps: { progress: 0 } },
      );

      // Rapid progress changes
      rerender({ progress: 10 });
      expect(progressRef.current).toBe(10);

      rerender({ progress: 25 });
      expect(progressRef.current).toBe(25);

      rerender({ progress: 50 });
      expect(progressRef.current).toBe(50);

      rerender({ progress: 75 });
      expect(progressRef.current).toBe(75);

      rerender({ progress: 100 });
      expect(progressRef.current).toBe(100);
    });

    it('should maintain ref stability across re-renders', () => {
      const originalRef = { current: 0 };
      const params = createMockParams({
        refs: {
          progressRef: originalRef,
          saveProgressRef: { current: jest.fn() },
          nextChapterRef: { current: null },
          navigateChapterRef: { current: jest.fn() },
        },
      });

      const { rerender } = renderHook(
        ({ progress }) => useRefSync({ ...params, progress }),
        { initialProps: { progress: 10 } },
      );

      expect(params.refs.progressRef).toBe(originalRef);

      rerender({ progress: 50 });
      expect(params.refs.progressRef).toBe(originalRef);

      rerender({ progress: 90 });
      expect(params.refs.progressRef).toBe(originalRef);
    });
  });
});
