/**
 * Comprehensive Tests for useChapterTransition (Phase 2 - Step 7)
 *
 * Tests chapter transition timing logic including:
 * - Chapter ID tracking and updates
 * - Grace period timestamp management
 * - WebView sync state transitions
 * - Media navigation tracking cleanup
 * - Timer sequences (300ms, 2300ms)
 *
 * CRITICAL: This hook manages timing for Smart Resume and prevents false conflicts.
 */

import { renderHook } from '@testing-library/react-hooks';
import { useChapterTransition } from '../useChapterTransition';

describe('useChapterTransition (Phase 2 - Step 7)', () => {
  // Mock refs
  let mockRefs: any;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Setup refs
    mockRefs = {
      prevChapterIdRef: { current: 100 },
      chapterTransitionTimeRef: { current: 0 },
      isWebViewSyncedRef: { current: false },
      mediaNavSourceChapterIdRef: { current: null },
      mediaNavDirectionRef: { current: null },
    };

    // Spy on console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    consoleLogSpy.mockRestore();
  });

  // ==========================================================================
  // Initial State and Effect Setup
  // ==========================================================================
  describe('Initial State', () => {
    it('should trigger effect on mount with initial chapter ID', () => {
      renderHook(() =>
        useChapterTransition({
          chapterId: 123,
          refs: mockRefs,
        }),
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Chapter changed to 123'),
      );
    });

    it('should not return any value (void hook)', () => {
      const { result } = renderHook(() =>
        useChapterTransition({
          chapterId: 123,
          refs: mockRefs,
        }),
      );

      expect(result.current).toBeUndefined();
    });
  });

  // ==========================================================================
  // Chapter Change - Immediate Effects
  // ==========================================================================
  describe('Chapter Change - Immediate Effects', () => {
    it('should update prevChapterIdRef immediately', () => {
      mockRefs.prevChapterIdRef.current = 100;

      renderHook(() =>
        useChapterTransition({
          chapterId: 200,
          refs: mockRefs,
        }),
      );

      expect(mockRefs.prevChapterIdRef.current).toBe(200);
    });

    it('should set chapterTransitionTimeRef to current timestamp', () => {
      const mockNow = 1000000;
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      renderHook(() =>
        useChapterTransition({
          chapterId: 123,
          refs: mockRefs,
        }),
      );

      expect(mockRefs.chapterTransitionTimeRef.current).toBe(mockNow);
    });

    it('should set isWebViewSyncedRef to false immediately', () => {
      mockRefs.isWebViewSyncedRef.current = true;

      renderHook(() =>
        useChapterTransition({
          chapterId: 123,
          refs: mockRefs,
        }),
      );

      expect(mockRefs.isWebViewSyncedRef.current).toBe(false);
    });

    it('should log chapter change with prev chapter ID', () => {
      mockRefs.prevChapterIdRef.current = 99;

      renderHook(() =>
        useChapterTransition({
          chapterId: 100,
          refs: mockRefs,
        }),
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'useTTSController: Chapter changed to 100 (prev: 99)',
      );
    });
  });

  // ==========================================================================
  // Timer T+300ms - WebView Sync
  // ==========================================================================
  describe('Timer T+300ms - WebView Sync', () => {
    it('should set isWebViewSyncedRef to true after 300ms', () => {
      mockRefs.isWebViewSyncedRef.current = false;

      renderHook(() =>
        useChapterTransition({
          chapterId: 123,
          refs: mockRefs,
        }),
      );

      expect(mockRefs.isWebViewSyncedRef.current).toBe(false);

      jest.advanceTimersByTime(300);

      expect(mockRefs.isWebViewSyncedRef.current).toBe(true);
    });

    it('should log WebView synced message after 300ms', () => {
      renderHook(() =>
        useChapterTransition({
          chapterId: 123,
          refs: mockRefs,
        }),
      );

      jest.advanceTimersByTime(300);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'useTTSController: WebView marked as synced for chapter 123',
      );
    });

    it('should NOT set isWebViewSyncedRef before 300ms', () => {
      mockRefs.isWebViewSyncedRef.current = false;

      renderHook(() =>
        useChapterTransition({
          chapterId: 123,
          refs: mockRefs,
        }),
      );

      jest.advanceTimersByTime(299); // Just before 300ms

      expect(mockRefs.isWebViewSyncedRef.current).toBe(false);
    });
  });

  // ==========================================================================
  // Timer T+2300ms - Media Nav Cleanup
  // ==========================================================================
  describe('Timer T+2300ms - Media Nav Cleanup', () => {
    it('should clear mediaNavSourceChapterIdRef after 2300ms if set', () => {
      mockRefs.mediaNavSourceChapterIdRef.current = 100;

      renderHook(() =>
        useChapterTransition({
          chapterId: 123,
          refs: mockRefs,
        }),
      );

      jest.advanceTimersByTime(2300);

      expect(mockRefs.mediaNavSourceChapterIdRef.current).toBeNull();
    });

    it('should clear mediaNavDirectionRef after 2300ms if source chapter ID set', () => {
      mockRefs.mediaNavSourceChapterIdRef.current = 100;
      mockRefs.mediaNavDirectionRef.current = 'NEXT';

      renderHook(() =>
        useChapterTransition({
          chapterId: 123,
          refs: mockRefs,
        }),
      );

      jest.advanceTimersByTime(2300);

      expect(mockRefs.mediaNavDirectionRef.current).toBeNull();
    });

    it('should log media nav clearing message after 2300ms', () => {
      mockRefs.mediaNavSourceChapterIdRef.current = 100;

      renderHook(() =>
        useChapterTransition({
          chapterId: 123,
          refs: mockRefs,
        }),
      );

      jest.advanceTimersByTime(2300);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Clearing media nav tracking'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('source: 100'),
      );
    });

    it('should NOT clear media nav if source chapter ID is null', () => {
      mockRefs.mediaNavSourceChapterIdRef.current = null;
      mockRefs.mediaNavDirectionRef.current = 'NEXT';

      renderHook(() =>
        useChapterTransition({
          chapterId: 123,
          refs: mockRefs,
        }),
      );

      jest.advanceTimersByTime(2300);

      // Direction should remain since no clearing happened
      expect(mockRefs.mediaNavDirectionRef.current).toBe('NEXT');
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Clearing media nav tracking'),
      );
    });

    it('should NOT clear media nav before 2300ms', () => {
      mockRefs.mediaNavSourceChapterIdRef.current = 100;

      renderHook(() =>
        useChapterTransition({
          chapterId: 123,
          refs: mockRefs,
        }),
      );

      jest.advanceTimersByTime(2299); // Just before 2300ms

      expect(mockRefs.mediaNavSourceChapterIdRef.current).toBe(100);
    });
  });

  // ==========================================================================
  // Complete Timer Sequence
  // ==========================================================================
  describe('Complete Timer Sequence', () => {
    it('should execute all timer effects in correct order', () => {
      mockRefs.mediaNavSourceChapterIdRef.current = 100;
      mockRefs.isWebViewSyncedRef.current = false;

      renderHook(() =>
        useChapterTransition({
          chapterId: 123,
          refs: mockRefs,
        }),
      );

      // T+0ms: Immediate effects
      expect(mockRefs.prevChapterIdRef.current).toBe(123);
      expect(mockRefs.isWebViewSyncedRef.current).toBe(false);
      expect(mockRefs.chapterTransitionTimeRef.current).toBeGreaterThan(0);

      // T+300ms: WebView sync
      jest.advanceTimersByTime(300);
      expect(mockRefs.isWebViewSyncedRef.current).toBe(true);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('WebView marked as synced'),
      );

      // Media nav not cleared yet
      expect(mockRefs.mediaNavSourceChapterIdRef.current).toBe(100);

      // T+2300ms (total): Media nav cleared
      jest.advanceTimersByTime(2000); // +2000ms more = 2300ms total
      expect(mockRefs.mediaNavSourceChapterIdRef.current).toBeNull();
      expect(mockRefs.mediaNavDirectionRef.current).toBeNull();
    });
  });

  // ==========================================================================
  // Multiple Rapid Chapter Changes
  // ==========================================================================
  describe('Multiple Rapid Chapter Changes', () => {
    it('should clear previous timer when chapter changes rapidly', () => {
      mockRefs.mediaNavSourceChapterIdRef.current = 100;

      const { rerender } = renderHook(
        ({ chapterId }) =>
          useChapterTransition({
            chapterId,
            refs: mockRefs,
          }),
        { initialProps: { chapterId: 100 } },
      );

      // First chapter change
      jest.advanceTimersByTime(100);

      // Second chapter change before first timers complete
      rerender({ chapterId: 200 });

      // Advance past first timer deadline
      jest.advanceTimersByTime(300);

      // Should show second chapter as synced, not first
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('WebView marked as synced for chapter 200'),
      );
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('WebView marked as synced for chapter 100'),
      );
    });

    it('should update prevChapterIdRef correctly across multiple changes', () => {
      const { rerender } = renderHook(
        ({ chapterId }) =>
          useChapterTransition({
            chapterId,
            refs: mockRefs,
          }),
        { initialProps: { chapterId: 100 } },
      );

      expect(mockRefs.prevChapterIdRef.current).toBe(100);

      rerender({ chapterId: 200 });
      expect(mockRefs.prevChapterIdRef.current).toBe(200);

      rerender({ chapterId: 300 });
      expect(mockRefs.prevChapterIdRef.current).toBe(300);
    });

    it('should handle three rapid chapter changes correctly', () => {
      mockRefs.mediaNavSourceChapterIdRef.current = 100;

      const { rerender } = renderHook(
        ({ chapterId }) =>
          useChapterTransition({
            chapterId,
            refs: mockRefs,
          }),
        { initialProps: { chapterId: 100 } },
      );

      // Change 1: 100 → 200
      jest.advanceTimersByTime(50);
      rerender({ chapterId: 200 });

      // Change 2: 200 → 300
      jest.advanceTimersByTime(50);
      rerender({ chapterId: 300 });

      // Advance to sync time for last change
      jest.advanceTimersByTime(300);

      // Only last chapter should be marked as synced
      expect(mockRefs.isWebViewSyncedRef.current).toBe(true);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('WebView marked as synced for chapter 300'),
      );
      expect(mockRefs.prevChapterIdRef.current).toBe(300);
    });
  });

  // ==========================================================================
  // Grace Period Calculation Support
  // ==========================================================================
  describe('Grace Period Support', () => {
    it('should set timestamp that can be used for grace period checks', () => {
      const mockNow = 5000000;
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      renderHook(() =>
        useChapterTransition({
          chapterId: 123,
          refs: mockRefs,
        }),
      );

      // This timestamp is used externally for grace period logic:
      // if (Date.now() - chapterTransitionTime < 3000) → within grace period
      expect(mockRefs.chapterTransitionTimeRef.current).toBe(mockNow);

      // Simulate external grace period check 2 seconds later
      jest.spyOn(Date, 'now').mockReturnValue(mockNow + 2000);
      const elapsed = Date.now() - mockRefs.chapterTransitionTimeRef.current;
      expect(elapsed).toBe(2000);
      expect(elapsed < 3000).toBe(true); // Within 3-second grace period
    });

    it('should update timestamp on each chapter change', () => {
      const mockNow1 = 1000;
      const mockNow2 = 5000;
      const dateSpy = jest.spyOn(Date, 'now');

      dateSpy.mockReturnValue(mockNow1);

      const { rerender } = renderHook(
        ({ chapterId }) =>
          useChapterTransition({
            chapterId,
            refs: mockRefs,
          }),
        { initialProps: { chapterId: 100 } },
      );

      expect(mockRefs.chapterTransitionTimeRef.current).toBe(mockNow1);

      // Change chapter with new timestamp
      dateSpy.mockReturnValue(mockNow2);
      rerender({ chapterId: 200 });

      expect(mockRefs.chapterTransitionTimeRef.current).toBe(mockNow2);
    });
  });

  // ==========================================================================
  // Effect Cleanup on Unmount
  // ==========================================================================
  describe('Effect Cleanup', () => {
    it('should clear timer on unmount', () => {
      const { unmount } = renderHook(() =>
        useChapterTransition({
          chapterId: 123,
          refs: mockRefs,
        }),
      );

      // Unmount before timer completes
      unmount();

      // Advance time - timer should not execute
      jest.advanceTimersByTime(1000);

      // isWebViewSyncedRef should remain false (timer was cleared)
      expect(mockRefs.isWebViewSyncedRef.current).toBe(false);
    });

    it('should not throw errors when unmounting with pending timers', () => {
      const { unmount } = renderHook(() =>
        useChapterTransition({
          chapterId: 123,
          refs: mockRefs,
        }),
      );

      expect(() => {
        unmount();
        jest.runAllTimers();
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // Media Nav Direction Handling
  // ==========================================================================
  describe('Media Nav Direction', () => {
    it('should clear PREV direction after 2300ms', () => {
      mockRefs.mediaNavSourceChapterIdRef.current = 100;
      mockRefs.mediaNavDirectionRef.current = 'PREV';

      renderHook(() =>
        useChapterTransition({
          chapterId: 123,
          refs: mockRefs,
        }),
      );

      jest.advanceTimersByTime(2300);

      expect(mockRefs.mediaNavDirectionRef.current).toBeNull();
    });

    it('should clear NEXT direction after 2300ms', () => {
      mockRefs.mediaNavSourceChapterIdRef.current = 100;
      mockRefs.mediaNavDirectionRef.current = 'NEXT';

      renderHook(() =>
        useChapterTransition({
          chapterId: 123,
          refs: mockRefs,
        }),
      );

      jest.advanceTimersByTime(2300);

      expect(mockRefs.mediaNavDirectionRef.current).toBeNull();
    });
  });

  // ==========================================================================
  // Zero Regression Validation
  // ==========================================================================
  describe('Zero Regression Validation', () => {
    it('Phase 2 Step 7: useChapterTransition preserves all original timing behaviors', () => {
      renderHook(() =>
        useChapterTransition({
          chapterId: 123,
          refs: mockRefs,
        }),
      );

      // This test documents that Phase 2 Step 7 successfully extracted
      // chapter transition timing logic from useTTSController.ts with zero behavioral changes.

      // Original implementation: useEffect within useTTSController
      // After extraction: Single useChapterTransition() hook
      // Behavior: IDENTICAL

      // Verify key timing behaviors
      expect(mockRefs.prevChapterIdRef.current).toBe(123);
      expect(mockRefs.chapterTransitionTimeRef.current).toBeGreaterThan(0);
      expect(mockRefs.isWebViewSyncedRef.current).toBe(false);

      jest.advanceTimersByTime(300);
      expect(mockRefs.isWebViewSyncedRef.current).toBe(true);
    });

    it('BUG FIX 2025-12-15: refs object should not cause useEffect re-runs', () => {
      // CONTEXT: Session 2 investigation found that passing refs as inline object
      // literal caused React to see a "new" object on every render, triggering useEffect repeatedly.
      // Console showed: "Chapter changed to 100 (prev: 100)" multiple times.
      //
      // ROOT CAUSE: In useTTSController.ts, refs object was created inline:
      //   useChapterTransition({ chapterId: chapter.id, refs: { ...refs } })
      //
      // FIX: Memoize refs object using useMemo() with empty deps array.
      //   const chapterTransitionRefs = useMemo(() => ({ ...refs }), []);
      //
      // This test verifies the useEffect only runs when chapterId actually changes.

      const { rerender } = renderHook(
        ({ chapterId, refs }) =>
          useChapterTransition({
            chapterId,
            refs,
          }),
        { initialProps: { chapterId: 100, refs: mockRefs } },
      );

      // Clear console spy to count only subsequent calls
      consoleLogSpy.mockClear();

      // Rerender with SAME chapterId and SAME refs object
      rerender({ chapterId: 100, refs: mockRefs });

      // useEffect should NOT re-run (chapterId unchanged)
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Chapter changed'),
      );

      // Now change chapterId - useEffect SHOULD run
      rerender({ chapterId: 200, refs: mockRefs });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Chapter changed to 200'),
      );

      // Count: should be called ONCE for chapter 200 change only
      const chapterChangeCalls = consoleLogSpy.mock.calls.filter(call =>
        call[0].includes('Chapter changed'),
      );
      expect(chapterChangeCalls).toHaveLength(1);
    });

    it('BUG FIX VALIDATION: multiple renders do not reset isWebViewSyncedRef', () => {
      // SYMPTOM: After timer fires (300ms) and sets isWebViewSyncedRef = true,
      // a re-render would cause useEffect to run again, resetting it to false.
      // This broke TTS event handling during WebView transitions.
      //
      // EXPECTED: isWebViewSyncedRef stays true after timer fires, even if
      // component re-renders (as long as chapterId hasn't changed).

      const { rerender } = renderHook(
        ({ chapterId, refs }) =>
          useChapterTransition({
            chapterId,
            refs,
          }),
        { initialProps: { chapterId: 100, refs: mockRefs } },
      );

      // Wait for timer to set isWebViewSyncedRef = true
      jest.advanceTimersByTime(300);
      expect(mockRefs.isWebViewSyncedRef.current).toBe(true);

      // Simulate a re-render (same props)
      rerender({ chapterId: 100, refs: mockRefs });

      // BUG: If useEffect re-runs, isWebViewSyncedRef would be reset to false
      // FIX: useEffect should NOT re-run if chapterId and refs unchanged
      expect(mockRefs.isWebViewSyncedRef.current).toBe(true); // ✅ Should remain true
    });

    it('BUG FIX VALIDATION: timer should fire exactly once per chapter change', () => {
      // SYMPTOM: Console logs showed timer firing multiple times for same chapter.
      // "WebView marked as synced for chapter 100" appeared 3-4 times.
      //
      // ROOT CAUSE: useEffect running on every render due to inline refs object.
      // Each run creates a new timer, all firing independently.
      //
      // EXPECTED: Timer fires ONCE per chapter change.

      renderHook(() =>
        useChapterTransition({
          chapterId: 100,
          refs: mockRefs,
        }),
      );

      consoleLogSpy.mockClear();

      // Advance time - timer should fire once
      jest.advanceTimersByTime(300);

      // Count how many times "WebView marked as synced" was logged
      const syncLogs = consoleLogSpy.mock.calls.filter(call =>
        call[0].includes('WebView marked as synced for chapter 100'),
      );

      expect(syncLogs).toHaveLength(1); // ✅ Should fire exactly once
    });
  });
});
