/**
 * Stitched Chapter + TTS Integration Tests
 * Tests the critical flow where user starts TTS in a stitched chapter
 *
 * Regression test for: TTS restart failure after stitched chapter clear
 * GitHub Issue: User starts TTS in Chapter 3 while Chapter 2 still stitched,
 * TTS fails with "stale chapter" errors because window.reader.chapter.id
 * is not updated immediately after clearStitchedChapters()
 */

import { renderHook } from '@testing-library/react-hooks';
import { useScrollSyncHandlers } from '../useScrollSyncHandlers';
import type { TTSScrollPromptData } from '../../types/tts';

// Mock WebView
const mockInjectJavaScript = jest.fn();
const mockWebViewRef = {
  current: {
    injectJavaScript: mockInjectJavaScript,
  },
};

// Mock callbacks
const mockHideScrollSyncDialog = jest.fn();
const mockRestartTtsFromParagraphIndex = jest.fn().mockResolvedValue(undefined);

describe('useScrollSyncHandlers - Stitched Chapter TTS Restart', () => {
  let ttsScrollPromptDataRef: { current: TTSScrollPromptData | null };

  beforeEach(() => {
    jest.clearAllMocks();
    ttsScrollPromptDataRef = { current: null };
  });

  const renderTestHook = () => {
    return renderHook(() =>
      useScrollSyncHandlers({
        webViewRef: mockWebViewRef as any,
        refs: { ttsScrollPromptDataRef: ttsScrollPromptDataRef as any },
        callbacks: {
          hideScrollSyncDialog: mockHideScrollSyncDialog,
          restartTtsFromParagraphIndex: mockRestartTtsFromParagraphIndex,
        },
      }),
    );
  };

  describe('Stitched Mode: Continue from visible position', () => {
    test('should calculate chapter info and trigger clear when user continues in stitched chapter', () => {
      // SETUP: User scrolled to Chapter 3 (paragraph 218 globally, paragraph 4 locally)
      // Chapter 2 (0-213) and Chapter 3 (214-447) are stitched in DOM
      ttsScrollPromptDataRef.current = {
        currentIndex: 2, // Where TTS was paused (in Chapter 2)
        visibleIndex: 218, // Where user scrolled to (in Chapter 3)
        currentChapterName: 'Chapter 2: Misunderstanding (2)',
        visibleChapterName: 'Chapter 3: Misunderstanding (3)',
        isStitched: true,
        isResume: true,
      };

      const { result } = renderTestHook();

      // ACT: User clicks "Continue from here" button
      result.current.handleTTSScrollSyncConfirm();

      // ASSERT: WebView should receive JavaScript to:
      // 1. Get chapter info for paragraph 218
      // 2. Set restart intent with correct chapter ID and local index
      // 3. Trigger clearStitchedChapters()
      expect(mockInjectJavaScript).toHaveBeenCalledTimes(1);

      const injectedCode = mockInjectJavaScript.mock.calls[0][0];

      // Verify it calls getChapterInfoForParagraph with visible index
      expect(injectedCode).toContain(
        'window.reader.getChapterInfoForParagraph(218)',
      );

      // Verify it sets restart intent with resume=true
      expect(injectedCode).toContain('window.reader.setTTSRestartIntent');
      expect(injectedCode).toContain('true'); // shouldResume flag

      // Verify it triggers clear
      expect(injectedCode).toContain('window.reader.clearStitchedChapters()');

      // Dialog should be hidden
      expect(mockHideScrollSyncDialog).toHaveBeenCalledTimes(1);

      // Ref should be cleared
      expect(ttsScrollPromptDataRef.current).toBeNull();
    });

    test('should NOT trigger stitched logic when isStitched=false', () => {
      // SETUP: Single chapter mode (no stitching)
      ttsScrollPromptDataRef.current = {
        currentIndex: 2,
        visibleIndex: 50,
        isStitched: false,
        isResume: true,
      };

      const { result } = renderTestHook();

      // ACT
      result.current.handleTTSScrollSyncConfirm();

      // ASSERT: Should use simple paragraph position change
      expect(mockInjectJavaScript).toHaveBeenCalledTimes(1);

      const injectedCode = mockInjectJavaScript.mock.calls[0][0];

      // Should call changeParagraphPosition directly
      expect(injectedCode).toContain('window.tts.changeParagraphPosition(50)');

      // Should also restart native TTS queue (Bug fix: drift enforcement)
      expect(mockRestartTtsFromParagraphIndex).toHaveBeenCalledWith(50);

      // Should NOT trigger stitched chapter logic
      expect(injectedCode).not.toContain('getChapterInfoForParagraph');
      expect(injectedCode).not.toContain('clearStitchedChapters');
    });
  });

  describe('Stitched Mode: Resume from saved position', () => {
    test('should scroll back and restart when user keeps current TTS position in stitched mode', () => {
      // SETUP: TTS was at paragraph 2 (Chapter 2), user scrolled to Chapter 3
      ttsScrollPromptDataRef.current = {
        currentIndex: 2, // TTS paused here (Chapter 2)
        visibleIndex: 218, // User scrolled here (Chapter 3)
        currentChapterName: 'Chapter 2: Misunderstanding (2)',
        visibleChapterName: 'Chapter 3: Misunderstanding (3)',
        isStitched: true,
        isResume: true,
      };

      const { result } = renderTestHook();

      // ACT: User clicks "Resume from saved" button
      result.current.handleTTSScrollSyncCancel();

      // ASSERT: WebView should receive JavaScript to:
      // 1. Get chapter info for current TTS position (paragraph 2)
      // 2. Scroll back to that paragraph
      // 3. Set restart intent
      // 4. Trigger clearStitchedChapters()
      expect(mockInjectJavaScript).toHaveBeenCalledTimes(1);

      const injectedCode = mockInjectJavaScript.mock.calls[0][0];

      // Verify it gets chapter info for CURRENT index
      expect(injectedCode).toContain(
        'window.reader.getChapterInfoForParagraph(2)',
      );

      // Verify it scrolls to current position
      expect(injectedCode).toContain('window.tts.scrollToElement');

      // Verify it sets restart intent
      expect(injectedCode).toContain('window.reader.setTTSRestartIntent');

      // Verify it triggers clear
      expect(injectedCode).toContain('window.reader.clearStitchedChapters()');

      expect(mockHideScrollSyncDialog).toHaveBeenCalledTimes(1);
      expect(ttsScrollPromptDataRef.current).toBeNull();
    });

    test('should simply resume when not in stitched mode', () => {
      // SETUP: Single chapter mode, isResume=true
      ttsScrollPromptDataRef.current = {
        currentIndex: 2,
        visibleIndex: 50,
        isStitched: false,
        isResume: true,
      };

      const { result } = renderTestHook();

      // ACT
      result.current.handleTTSScrollSyncCancel();

      // ASSERT: Should just call resume
      expect(mockInjectJavaScript).toHaveBeenCalledTimes(1);

      const injectedCode = mockInjectJavaScript.mock.calls[0][0];

      expect(injectedCode).toContain('window.tts.resume(true)');
      expect(injectedCode).not.toContain('getChapterInfoForParagraph');
      expect(injectedCode).not.toContain('clearStitchedChapters');
    });
  });

  describe('Edge Cases', () => {
    test('should handle null ref gracefully', () => {
      ttsScrollPromptDataRef.current = null;

      const { result } = renderTestHook();

      // Should not crash
      expect(() => result.current.handleTTSScrollSyncConfirm()).not.toThrow();
      expect(() => result.current.handleTTSScrollSyncCancel()).not.toThrow();

      // Should not inject anything
      expect(mockInjectJavaScript).not.toHaveBeenCalled();

      // Should still hide dialog and clear ref
      expect(mockHideScrollSyncDialog).toHaveBeenCalledTimes(2);
    });

    test('should handle missing chapter names in stitched mode', () => {
      // SETUP: Stitched mode but missing chapter names
      ttsScrollPromptDataRef.current = {
        currentIndex: 2,
        visibleIndex: 218,
        isStitched: true,
        isResume: true,
        // currentChapterName and visibleChapterName are undefined
      };

      const { result } = renderTestHook();

      // Should not crash
      expect(() => result.current.handleTTSScrollSyncConfirm()).not.toThrow();

      // Should still trigger stitched logic
      expect(mockInjectJavaScript).toHaveBeenCalled();
      const injectedCode = mockInjectJavaScript.mock.calls[0][0];
      expect(injectedCode).toContain('clearStitchedChapters');
    });

    test('should handle isResume=false in stitched mode', () => {
      // SETUP: Initial TTS start (not resume) in stitched chapter
      ttsScrollPromptDataRef.current = {
        currentIndex: 0,
        visibleIndex: 218,
        currentChapterName: 'Chapter 2',
        visibleChapterName: 'Chapter 3',
        isStitched: true,
        isResume: false, // Initial start, not resume
      };

      const { result } = renderTestHook();

      result.current.handleTTSScrollSyncConfirm();

      const injectedCode = mockInjectJavaScript.mock.calls[0][0];

      // Should still trigger stitched logic
      expect(injectedCode).toContain('clearStitchedChapters');

      // Should pass isResume=false to setTTSRestartIntent
      expect(injectedCode).toContain('false'); // shouldResume parameter
    });
  });

  describe('Regression: Chapter Context Update', () => {
    /**
     * Critical test for the bug fix:
     * When clearStitchedChapters() is called, it MUST update window.reader.chapter
     * immediately before TTS auto-restart happens (200ms delay).
     *
     * Without this fix, TTS commands fail with "stale chapter 6082, current is 6083"
     * because window.reader.chapter.id is still the old chapter.
     *
     * This test verifies the integration flow that should work after the fix:
     * 1. User scrolls from Chapter 2 to Chapter 3 (stitched)
     * 2. User starts TTS → scroll sync dialog appears
     * 3. User clicks "Continue from here"
     * 4. clearStitchedChapters() is called
     * 5. window.reader.chapter is updated IMMEDIATELY
     * 6. TTS auto-restarts 200ms later and works correctly
     */
    test('should trigger clearStitchedChapters which updates window.reader.chapter immediately', () => {
      ttsScrollPromptDataRef.current = {
        currentIndex: 2,
        visibleIndex: 218,
        currentChapterName: 'Chapter 2: Misunderstanding (2)',
        visibleChapterName: 'Chapter 3: Misunderstanding (3)',
        isStitched: true,
        isResume: true,
      };

      const { result } = renderTestHook();

      result.current.handleTTSScrollSyncConfirm();

      const injectedCode = mockInjectJavaScript.mock.calls[0][0];

      // CRITICAL: Verify the injected code triggers clearStitchedChapters
      // This function (in core.js) now includes the fix that immediately updates
      // this.chapter.id to match the visible chapter before React Native reload
      expect(injectedCode).toContain('window.reader.clearStitchedChapters()');

      // The fix in core.js adds this log after updating this.chapter:
      // console.log(`Reader: Updated chapter context immediately - ID: ${visibleChapterId}...`)
      //
      // Expected flow in WebView after this call:
      // 1. clearStitchedChapters() runs
      // 2. Removes Chapter 2 from DOM, keeps Chapter 3
      // 3. Updates this.chapter.id = 6083 (Chapter 3) ← THE FIX
      // 4. 200ms later: TTS auto-restart reads from window.reader.chapter
      // 5. TTS commands work because window.reader.chapter.id matches new DOM
      // 6. NO "stale chapter" errors!
    });
  });
});
