/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderHook, act } from '@testing-library/react-hooks';
import { useChapterSelectionHandler } from '../useChapterSelectionHandler';
import {
  getChapter as getChapterFromDb,
  markChaptersBeforePositionRead,
  resetFutureChaptersProgress,
} from '@database/queries/ChapterQueries';

// Mock dependencies
jest.mock('@database/queries/ChapterQueries');

describe('useChapterSelectionHandler', () => {
  // Common test data
  const mockNovel = { id: 100 } as any;
  const mockChapter = { id: 10, position: 5 } as any;

  // Refs
  let chapterGeneralSettingsRef: any;
  let pendingResumeIndexRef: any;

  // Mocks
  let mockSetShowChapterSelectionDialog: jest.Mock;
  let mockShowResumeDialog: jest.Mock;
  let mockShowToastMessage: jest.Mock;
  let mockUpdateLastTTSChapter: jest.Mock;
  let mockGetChapter: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Initialize refs
    chapterGeneralSettingsRef = { current: { ttsForwardChapterReset: 'none' } };
    pendingResumeIndexRef = { current: -1 };

    // Initialize mocks
    mockSetShowChapterSelectionDialog = jest.fn();
    mockShowResumeDialog = jest.fn();
    mockShowToastMessage = jest.fn();
    mockUpdateLastTTSChapter = jest.fn();
    mockGetChapter = jest.fn();

    // Mock database functions - default to success
    (getChapterFromDb as jest.Mock).mockResolvedValue({
      id: 20,
      name: 'Target Chapter',
      position: 10,
    } as any);
    (markChaptersBeforePositionRead as jest.Mock).mockResolvedValue(undefined);
    (resetFutureChaptersProgress as jest.Mock).mockResolvedValue(undefined);
  });

  const renderTestHook = (
    novel: any = mockNovel,
    chapter: any = mockChapter,
  ) => {
    return renderHook(() =>
      useChapterSelectionHandler({
        novel,
        chapter,
        chapterGeneralSettingsRef,
        pendingResumeIndexRef,
        dialogState: {
          setShowChapterSelectionDialog: mockSetShowChapterSelectionDialog,
          showResumeDialog: mockShowResumeDialog,
        },
        showToastMessage: mockShowToastMessage,
        updateLastTTSChapter: mockUpdateLastTTSChapter,
        getChapter: mockGetChapter,
      }),
    );
  };

  // ========================================
  // Test Group 1: Initial State
  // ========================================
  describe('Initial State', () => {
    it('should return handleSelectChapter function', () => {
      const { result } = renderTestHook();
      expect(result.current.handleSelectChapter).toBeDefined();
      expect(typeof result.current.handleSelectChapter).toBe('function');
    });
  });

  // ========================================
  // Test Group 2: Same Chapter Selection
  // ========================================
  describe('Same Chapter Selection', () => {
    it('should hide chapter selection dialog', async () => {
      const { result } = renderTestHook();

      await act(async () => {
        await result.current.handleSelectChapter(mockChapter.id);
      });

      expect(mockSetShowChapterSelectionDialog).toHaveBeenCalledWith(false);
    });

    it('should mark chapters before position as read', async () => {
      const { result } = renderTestHook();

      await act(async () => {
        await result.current.handleSelectChapter(mockChapter.id);
      });

      expect(markChaptersBeforePositionRead).toHaveBeenCalledWith(
        mockNovel.id,
        mockChapter.position,
      );
    });

    it('should update last TTS chapter', async () => {
      const { result } = renderTestHook();

      await act(async () => {
        await result.current.handleSelectChapter(mockChapter.id);
      });

      expect(mockUpdateLastTTSChapter).toHaveBeenCalledWith(mockChapter.id);
    });

    it('should show resume dialog if pendingResumeIndex >= 0', async () => {
      pendingResumeIndexRef.current = 10; // Valid resume index

      const { result } = renderTestHook();

      await act(async () => {
        await result.current.handleSelectChapter(mockChapter.id);
      });

      expect(mockShowResumeDialog).toHaveBeenCalledTimes(1);
    });

    it('should NOT show resume dialog if pendingResumeIndex < 0', async () => {
      pendingResumeIndexRef.current = -1; // Invalid resume index

      const { result } = renderTestHook();

      await act(async () => {
        await result.current.handleSelectChapter(mockChapter.id);
      });

      expect(mockShowResumeDialog).not.toHaveBeenCalled();
    });

    it('should NOT call getChapter (already on this chapter)', async () => {
      const { result } = renderTestHook();

      await act(async () => {
        await result.current.handleSelectChapter(mockChapter.id);
      });

      expect(mockGetChapter).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // Test Group 3: Different Chapter Selection
  // ========================================
  describe('Different Chapter Selection', () => {
    it('should hide chapter selection dialog', async () => {
      const { result } = renderTestHook();

      await act(async () => {
        await result.current.handleSelectChapter(20);
      });

      expect(mockSetShowChapterSelectionDialog).toHaveBeenCalledWith(false);
    });

    it('should fetch target chapter from database', async () => {
      const { result } = renderTestHook();

      await act(async () => {
        await result.current.handleSelectChapter(20);
      });

      expect(getChapterFromDb).toHaveBeenCalledWith(20);
    });

    it('should mark target chapter before position as read', async () => {
      const targetChapter = { id: 20, position: 10 } as any;
      (getChapterFromDb as jest.Mock).mockResolvedValue(targetChapter);

      const { result } = renderTestHook();

      await act(async () => {
        await result.current.handleSelectChapter(20);
      });

      expect(markChaptersBeforePositionRead).toHaveBeenCalledWith(
        mockNovel.id,
        targetChapter.position,
      );
    });

    it('should update last TTS chapter to target chapter', async () => {
      const targetChapter = { id: 20, position: 10 } as any;
      (getChapterFromDb as jest.Mock).mockResolvedValue(targetChapter);

      const { result } = renderTestHook();

      await act(async () => {
        await result.current.handleSelectChapter(20);
      });

      expect(mockUpdateLastTTSChapter).toHaveBeenCalledWith(20);
    });

    it('should call getChapter to navigate to target chapter', async () => {
      const targetChapter = { id: 20, name: 'Target' } as any;
      (getChapterFromDb as jest.Mock).mockResolvedValue(targetChapter);

      const { result } = renderTestHook();

      await act(async () => {
        await result.current.handleSelectChapter(20);
      });

      expect(mockGetChapter).toHaveBeenCalledWith(targetChapter);
    });

    it('should NOT show resume dialog for different chapter', async () => {
      pendingResumeIndexRef.current = 10; // Valid resume index

      const { result } = renderTestHook();

      await act(async () => {
        await result.current.handleSelectChapter(20);
      });

      expect(mockShowResumeDialog).not.toHaveBeenCalled();
    });

    it('should handle target chapter not found gracefully', async () => {
      (getChapterFromDb as jest.Mock).mockResolvedValue(null); // Chapter doesn't exist

      const { result } = renderTestHook();

      await act(async () => {
        await result.current.handleSelectChapter(999);
      });

      expect(mockGetChapter).not.toHaveBeenCalled();
      expect(mockUpdateLastTTSChapter).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // Test Group 4: Progress Reset Logic
  // ========================================
  describe('Progress Reset Logic', () => {
    it('should NOT reset future progress if mode is "none" (same chapter)', async () => {
      chapterGeneralSettingsRef.current.ttsForwardChapterReset = 'none';

      const { result } = renderTestHook();

      await act(async () => {
        await result.current.handleSelectChapter(mockChapter.id);
      });

      expect(resetFutureChaptersProgress).not.toHaveBeenCalled();
      expect(mockShowToastMessage).not.toHaveBeenCalled();
    });

    it('should reset future progress if mode is "position" (same chapter)', async () => {
      chapterGeneralSettingsRef.current.ttsForwardChapterReset = 'position';

      const { result } = renderTestHook();

      await act(async () => {
        await result.current.handleSelectChapter(mockChapter.id);
      });

      expect(resetFutureChaptersProgress).toHaveBeenCalledWith(
        mockNovel.id,
        mockChapter.id,
        'position',
      );
      expect(mockShowToastMessage).toHaveBeenCalledWith(
        'Future progress reset: position',
      );
    });

    it('should reset future progress if mode is "unread" (same chapter)', async () => {
      chapterGeneralSettingsRef.current.ttsForwardChapterReset = 'unread';

      const { result } = renderTestHook();

      await act(async () => {
        await result.current.handleSelectChapter(mockChapter.id);
      });

      expect(resetFutureChaptersProgress).toHaveBeenCalledWith(
        mockNovel.id,
        mockChapter.id,
        'unread',
      );
      expect(mockShowToastMessage).toHaveBeenCalledWith(
        'Future progress reset: unread',
      );
    });

    it('should reset future progress for different chapter if mode is "position"', async () => {
      chapterGeneralSettingsRef.current.ttsForwardChapterReset = 'position';
      const targetChapter = { id: 20, position: 10 } as any;
      (getChapterFromDb as jest.Mock).mockResolvedValue(targetChapter);

      const { result } = renderTestHook();

      await act(async () => {
        await result.current.handleSelectChapter(20);
      });

      expect(resetFutureChaptersProgress).toHaveBeenCalledWith(
        mockNovel.id,
        20,
        'position',
      );
      // No toast for different chapter
      expect(mockShowToastMessage).not.toHaveBeenCalled();
    });

    it('should NOT reset future progress for different chapter if mode is "none"', async () => {
      chapterGeneralSettingsRef.current.ttsForwardChapterReset = 'none';
      const targetChapter = { id: 20, position: 10 } as any;
      (getChapterFromDb as jest.Mock).mockResolvedValue(targetChapter);

      const { result } = renderTestHook();

      await act(async () => {
        await result.current.handleSelectChapter(20);
      });

      expect(resetFutureChaptersProgress).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // Test Group 5: Edge Cases
  // ========================================
  describe('Edge Cases', () => {
    it('should handle chapter without position (same chapter)', async () => {
      const chapterWithoutPosition = { id: 10, position: undefined } as any;

      const { result } = renderTestHook(mockNovel, chapterWithoutPosition);

      await act(async () => {
        await result.current.handleSelectChapter(10);
      });

      expect(markChaptersBeforePositionRead).not.toHaveBeenCalled();
      expect(mockUpdateLastTTSChapter).toHaveBeenCalledWith(10);
    });

    it('should handle target chapter without position (different chapter)', async () => {
      const targetChapter = { id: 20, position: undefined } as any;
      (getChapterFromDb as jest.Mock).mockResolvedValue(targetChapter);

      const { result } = renderTestHook();

      await act(async () => {
        await result.current.handleSelectChapter(20);
      });

      expect(markChaptersBeforePositionRead).not.toHaveBeenCalled();
      expect(mockGetChapter).toHaveBeenCalledWith(targetChapter);
    });

    it('should handle database errors gracefully', async () => {
      (getChapterFromDb as jest.Mock).mockRejectedValue(new Error('DB error'));

      const { result } = renderTestHook();

      await expect(
        act(async () => {
          await result.current.handleSelectChapter(20);
        }),
      ).rejects.toThrow('DB error');
    });
  });
});
