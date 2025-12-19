import { renderHook } from '@testing-library/react-hooks';
import { useTTSConfirmationHandler } from '../useTTSConfirmationHandler';
import { getRecentReadingChapters } from '@database/queries/ChapterQueries';
import { MMKVStorage } from '@utils/mmkv/mmkv';

// Mock dependencies
jest.mock('@database/queries/ChapterQueries');
jest.mock('@utils/mmkv/mmkv');

describe('useTTSConfirmationHandler', () => {
  // Common test data
  const mockNovelId = 123;
  const mockChapterId = 456;

  // Refs
  let latestParagraphIndexRef: any;
  let lastTTSPauseTimeRef: any;
  let pendingResumeIndexRef: any;

  // Mocks
  let mockSetConflictingChapters: jest.Mock;
  let mockSetShowChapterSelectionDialog: jest.Mock;
  let mockShowResumeDialog: jest.Mock;
  let mockHandleResumeCancel: jest.Mock;
  let mockUpdateLastTTSChapter: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Initialize refs
    latestParagraphIndexRef = { current: undefined };
    lastTTSPauseTimeRef = { current: undefined };
    pendingResumeIndexRef = { current: 0 };

    // Initialize mocks
    mockSetConflictingChapters = jest.fn();
    mockSetShowChapterSelectionDialog = jest.fn();
    mockShowResumeDialog = jest.fn();
    mockHandleResumeCancel = jest.fn();
    mockUpdateLastTTSChapter = jest.fn();

    // Mock Date.now
    jest.spyOn(Date, 'now').mockReturnValue(10000);

    // Mock ChapterQueries - default to empty conflicts
    (getRecentReadingChapters as jest.Mock).mockResolvedValue([]);

    // Mock MMKVStorage - default to 0
    (MMKVStorage.getNumber as jest.Mock).mockReturnValue(0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const renderTestHook = () => {
    return renderHook(() =>
      useTTSConfirmationHandler({
        novelId: mockNovelId,
        chapterId: mockChapterId,
        latestParagraphIndexRef,
        lastTTSPauseTimeRef,
        pendingResumeIndexRef,
        dialogState: {
          setConflictingChapters: mockSetConflictingChapters,
          setShowChapterSelectionDialog: mockSetShowChapterSelectionDialog,
          showResumeDialog: mockShowResumeDialog,
        },
        handleResumeCancel: mockHandleResumeCancel,
        updateLastTTSChapter: mockUpdateLastTTSChapter,
      }),
    );
  };

  // ========================================
  // Test Group 1: Initial State
  // ========================================
  describe('Initial State', () => {
    it('should return handleRequestTTSConfirmation function', () => {
      const { result } = renderTestHook();
      expect(result.current.handleRequestTTSConfirmation).toBeDefined();
      expect(typeof result.current.handleRequestTTSConfirmation).toBe(
        'function',
      );
    });
  });

  // ========================================
  // Test Group 2: Grace Period Logic (< 3 seconds)
  // ========================================
  describe('Grace Period (< 3 seconds)', () => {
    it('should skip scroll conflict check if within grace period (timeSinceLastPause < 3000ms)', async () => {
      // Grace period: paused 2 seconds ago
      lastTTSPauseTimeRef.current = 8000; // Date.now() is 10000 → diff = 2000ms
      latestParagraphIndexRef.current = 50; // User scrolled far away
      const savedIndex = 10; // Saved position is different

      const { result } = renderTestHook();
      await result.current.handleRequestTTSConfirmation(savedIndex);

      // Should NOT call handleResumeCancel (no scroll conflict detection in grace period)
      expect(mockHandleResumeCancel).not.toHaveBeenCalled();
      // Should proceed to show resume dialog (no conflicts)
      expect(mockShowResumeDialog).toHaveBeenCalledTimes(1);
    });

    it('should proceed even with large gap if in grace period', async () => {
      lastTTSPauseTimeRef.current = 7001; // 2999ms ago (< 3000)
      latestParagraphIndexRef.current = 100;
      const savedIndex = 0; // Gap of 100 paragraphs

      const { result } = renderTestHook();
      await result.current.handleRequestTTSConfirmation(savedIndex);

      expect(mockHandleResumeCancel).not.toHaveBeenCalled();
      expect(mockShowResumeDialog).toHaveBeenCalledTimes(1);
    });

    it('should use lastTTSPauseTimeRef.current || 0 if ref is undefined', async () => {
      lastTTSPauseTimeRef.current = undefined; // Should use 0
      // Date.now() - 0 = 10000ms → not in grace period
      latestParagraphIndexRef.current = 20;
      const savedIndex = 10; // Gap of 10 paragraphs (> 5)

      const { result } = renderTestHook();
      await result.current.handleRequestTTSConfirmation(savedIndex);

      // Should trigger scroll conflict (not in grace period)
      expect(mockHandleResumeCancel).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================
  // Test Group 3: Scroll Conflict Detection (GAP_THRESHOLD = 5)
  // ========================================
  describe('Scroll Conflict Detection', () => {
    it('should detect scroll conflict if gap > 5 paragraphs and NOT in grace period', async () => {
      lastTTSPauseTimeRef.current = 5000; // 5000ms ago (> 3000ms)
      latestParagraphIndexRef.current = 20;
      const savedIndex = 10; // Gap = |20 - 10| = 10 > 5

      const { result } = renderTestHook();
      await result.current.handleRequestTTSConfirmation(savedIndex);

      expect(mockHandleResumeCancel).toHaveBeenCalledTimes(1);
      expect(mockShowResumeDialog).not.toHaveBeenCalled();
    });

    it('should NOT detect conflict if gap <= 5 paragraphs', async () => {
      lastTTSPauseTimeRef.current = 5000; // Not in grace period
      latestParagraphIndexRef.current = 15;
      const savedIndex = 10; // Gap = 5 (threshold)

      const { result } = renderTestHook();
      await result.current.handleRequestTTSConfirmation(savedIndex);

      expect(mockHandleResumeCancel).not.toHaveBeenCalled();
      expect(mockShowResumeDialog).toHaveBeenCalledTimes(1);
    });

    it('should NOT detect conflict if latestParagraphIndexRef is undefined', async () => {
      lastTTSPauseTimeRef.current = 5000; // Not in grace period
      latestParagraphIndexRef.current = undefined;
      const savedIndex = 10;

      const { result } = renderTestHook();
      await result.current.handleRequestTTSConfirmation(savedIndex);

      expect(mockHandleResumeCancel).not.toHaveBeenCalled();
      expect(mockShowResumeDialog).toHaveBeenCalledTimes(1);
    });

    it('should NOT detect conflict if latestParagraphIndexRef is negative', async () => {
      lastTTSPauseTimeRef.current = 5000;
      latestParagraphIndexRef.current = -1;
      const savedIndex = 10;

      const { result } = renderTestHook();
      await result.current.handleRequestTTSConfirmation(savedIndex);

      expect(mockHandleResumeCancel).not.toHaveBeenCalled();
      expect(mockShowResumeDialog).toHaveBeenCalledTimes(1);
    });

    it('should use absolute difference for conflict detection (negative savedIndex)', async () => {
      lastTTSPauseTimeRef.current = 5000;
      latestParagraphIndexRef.current = 20;
      const savedIndex = 14; // Gap = |20 - 14| = 6 > 5

      const { result } = renderTestHook();
      await result.current.handleRequestTTSConfirmation(savedIndex);

      expect(mockHandleResumeCancel).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================
  // Test Group 4: Chapter Conflict Detection (Recent Reading)
  // ========================================
  describe('Chapter Conflict Detection', () => {
    it('should query recent reading chapters (4 chapters, same novel)', async () => {
      const { result } = renderTestHook();
      await result.current.handleRequestTTSConfirmation(10);

      expect(getRecentReadingChapters).toHaveBeenCalledWith(mockNovelId, 4);
    });

    it('should filter out current chapter from conflicts', async () => {
      (getRecentReadingChapters as jest.Mock).mockResolvedValue([
        { id: mockChapterId, name: 'Current Chapter', chapterNumber: 1 },
        { id: 789, name: 'Other Chapter', chapterNumber: 2 },
      ]);

      (MMKVStorage.getNumber as jest.Mock).mockReturnValue(5);

      const { result } = renderTestHook();
      await result.current.handleRequestTTSConfirmation(10);

      // Should only have 1 conflict (filtered current chapter)
      expect(mockSetConflictingChapters).toHaveBeenCalledTimes(1);
      expect(mockSetConflictingChapters).toHaveBeenCalledWith([
        { id: 789, name: 'Other Chapter', paragraph: 5 },
      ]);
    });

    it('should show chapter selection dialog if conflicts exist', async () => {
      (getRecentReadingChapters as jest.Mock).mockResolvedValue([
        { id: 789, name: 'Chapter 2', chapterNumber: 2 },
        { id: 999, name: null, chapterNumber: 3 }, // Missing name
      ]);

      (MMKVStorage.getNumber as jest.Mock)
        .mockReturnValueOnce(10) // chapter_progress_789
        .mockReturnValueOnce(0); // chapter_progress_999 (null → 0)

      const { result } = renderTestHook();
      await result.current.handleRequestTTSConfirmation(15);

      expect(mockSetConflictingChapters).toHaveBeenCalledWith([
        { id: 789, name: 'Chapter 2', paragraph: 10 },
        { id: 999, name: 'Chapter 3', paragraph: 0 },
      ]);
      expect(mockSetShowChapterSelectionDialog).toHaveBeenCalledWith(true);
      expect(pendingResumeIndexRef.current).toBe(15);
      expect(mockShowResumeDialog).not.toHaveBeenCalled();
    });

    it('should use fallback name "Chapter {number}" if name is missing', async () => {
      (getRecentReadingChapters as jest.Mock).mockResolvedValue([
        { id: 789, name: null, chapterNumber: 5 },
      ]);

      (MMKVStorage.getNumber as jest.Mock).mockReturnValue(0);

      const { result } = renderTestHook();
      await result.current.handleRequestTTSConfirmation(10);

      expect(mockSetConflictingChapters).toHaveBeenCalledWith([
        { id: 789, name: 'Chapter 5', paragraph: 0 },
      ]);
    });

    it('should use paragraph progress 0 if MMKV returns null', async () => {
      (getRecentReadingChapters as jest.Mock).mockResolvedValue([
        { id: 789, name: 'Test', chapterNumber: 1 },
      ]);

      (MMKVStorage.getNumber as jest.Mock).mockReturnValue(null); // Null case

      const { result } = renderTestHook();
      await result.current.handleRequestTTSConfirmation(10);

      expect(mockSetConflictingChapters).toHaveBeenCalledWith([
        { id: 789, name: 'Test', paragraph: 0 },
      ]);
    });
  });

  // ========================================
  // Test Group 5: No Conflicts - Auto Resume
  // ========================================
  describe('No Conflicts - Auto Resume', () => {
    it('should show resume dialog if no conflicts found', async () => {
      (getRecentReadingChapters as jest.Mock).mockResolvedValue([]);

      const { result } = renderTestHook();
      await result.current.handleRequestTTSConfirmation(10);

      expect(mockUpdateLastTTSChapter).toHaveBeenCalledWith(mockChapterId);
      expect(pendingResumeIndexRef.current).toBe(10);
      expect(mockShowResumeDialog).toHaveBeenCalledTimes(1);
      expect(mockSetShowChapterSelectionDialog).not.toHaveBeenCalled();
    });

    it('should show resume dialog if only current chapter returned', async () => {
      (getRecentReadingChapters as jest.Mock).mockResolvedValue([
        { id: mockChapterId, name: 'Current', chapterNumber: 1 },
      ]);

      const { result } = renderTestHook();
      await result.current.handleRequestTTSConfirmation(20);

      expect(mockShowResumeDialog).toHaveBeenCalledTimes(1);
      expect(mockSetShowChapterSelectionDialog).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // Test Group 6: Error Handling
  // ========================================
  describe('Error Handling', () => {
    it('should ignore database errors and proceed to show resume dialog', async () => {
      (getRecentReadingChapters as jest.Mock).mockRejectedValue(
        new Error('DB error'),
      );

      const { result } = renderTestHook();
      await result.current.handleRequestTTSConfirmation(10);

      expect(mockUpdateLastTTSChapter).toHaveBeenCalledWith(mockChapterId);
      expect(mockShowResumeDialog).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================
  // Test Group 7: Ref Mutations
  // ========================================
  describe('Ref Mutations', () => {
    it('should update pendingResumeIndexRef when showing chapter selection', async () => {
      (getRecentReadingChapters as jest.Mock).mockResolvedValue([
        { id: 789, name: 'Test', chapterNumber: 1 },
      ]);

      const savedIndex = 42;
      const { result } = renderTestHook();
      await result.current.handleRequestTTSConfirmation(savedIndex);

      expect(pendingResumeIndexRef.current).toBe(savedIndex);
    });

    it('should update pendingResumeIndexRef when showing resume dialog', async () => {
      (getRecentReadingChapters as jest.Mock).mockResolvedValue([]);

      const savedIndex = 25;
      const { result } = renderTestHook();
      await result.current.handleRequestTTSConfirmation(savedIndex);

      expect(pendingResumeIndexRef.current).toBe(savedIndex);
    });
  });
});
