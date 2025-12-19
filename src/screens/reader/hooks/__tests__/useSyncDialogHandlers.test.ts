import { renderHook, act } from '@testing-library/react-hooks';
import { useSyncDialogHandlers } from '../useSyncDialogHandlers';
import { getChapter as getChapterFromDb } from '@database/queries/ChapterQueries';

// Mock dependencies
jest.mock('@database/queries/ChapterQueries');

describe('useSyncDialogHandlers', () => {
  // Refs
  let syncRetryCountRef: any;
  let wakeChapterIdRef: any;
  let pendingScreenWakeSyncRef: any;

  // Mocks
  let mockGetChapter: jest.Mock;
  let mockSetSyncDialogStatus: jest.Mock;
  let mockSetSyncDialogVisible: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Initialize refs
    syncRetryCountRef = { current: 3 }; // Simulate some retry attempts
    wakeChapterIdRef = { current: null };
    pendingScreenWakeSyncRef = { current: false };

    // Initialize mocks
    mockGetChapter = jest.fn();
    mockSetSyncDialogStatus = jest.fn();
    mockSetSyncDialogVisible = jest.fn();

    // Mock getChapterFromDb - default to successful chapter fetch
    (getChapterFromDb as jest.Mock).mockResolvedValue({
      id: 123,
      name: 'Test Chapter',
      chapterNumber: 10,
    } as any);
  });

  const renderTestHook = () => {
    return renderHook(() =>
      useSyncDialogHandlers({
        getChapter: mockGetChapter,
        refs: {
          syncRetryCountRef,
          wakeChapterIdRef,
          pendingScreenWakeSyncRef,
        },
        callbacks: {
          setSyncDialogStatus: mockSetSyncDialogStatus,
          setSyncDialogVisible: mockSetSyncDialogVisible,
        },
      }),
    );
  };

  // ========================================
  // Test Group 1: Initial State
  // ========================================
  describe('Initial State', () => {
    it('should return handleSyncRetry function', () => {
      const { result } = renderTestHook();
      expect(result.current.handleSyncRetry).toBeDefined();
      expect(typeof result.current.handleSyncRetry).toBe('function');
    });
  });

  // ========================================
  // Test Group 2: Successful Retry
  // ========================================
  describe('Successful Retry', () => {
    it('should reset syncRetryCountRef to 0', async () => {
      wakeChapterIdRef.current = 123;
      syncRetryCountRef.current = 5; // Simulate retries

      const { result } = renderTestHook();

      await act(async () => {
        result.current.handleSyncRetry();
      });

      expect(syncRetryCountRef.current).toBe(0);
    });

    it('should set pendingScreenWakeSyncRef to true', async () => {
      wakeChapterIdRef.current = 123;

      const { result } = renderTestHook();

      await act(async () => {
        result.current.handleSyncRetry();
      });

      expect(pendingScreenWakeSyncRef.current).toBe(true);
    });

    it('should set sync dialog status to "syncing"', async () => {
      wakeChapterIdRef.current = 123;

      const { result } = renderTestHook();

      await act(async () => {
        result.current.handleSyncRetry();
      });

      expect(mockSetSyncDialogStatus).toHaveBeenCalledWith('syncing');
    });

    it('should query database for wake chapter', async () => {
      wakeChapterIdRef.current = 456;

      const { result } = renderTestHook();

      await act(async () => {
        result.current.handleSyncRetry();
      });

      expect(getChapterFromDb).toHaveBeenCalledWith(456);
    });

    it('should call getChapter with fetched chapter on success', async () => {
      wakeChapterIdRef.current = 123;
      const mockChapter = {
        id: 123,
        name: 'Chapter 10',
        chapterNumber: 10,
      } as any;
      (getChapterFromDb as jest.Mock).mockResolvedValue(mockChapter);

      const { result } = renderTestHook();

      await act(async () => {
        result.current.handleSyncRetry();
      });

      expect(mockGetChapter).toHaveBeenCalledWith(mockChapter);
    });

    it('should NOT change dialog status after successful chapter fetch', async () => {
      wakeChapterIdRef.current = 123;
      (getChapterFromDb as jest.Mock).mockResolvedValue({
        id: 123,
        name: 'Test',
      } as any);

      const { result } = renderTestHook();

      await act(async () => {
        result.current.handleSyncRetry();
      });

      // Should only call once (with 'syncing'), not 'success'
      expect(mockSetSyncDialogStatus).toHaveBeenCalledTimes(1);
      expect(mockSetSyncDialogStatus).toHaveBeenCalledWith('syncing');
    });
  });

  // ========================================
  // Test Group 3: Failed Retry (Chapter Not Found)
  // ========================================
  describe('Failed Retry - Chapter Not Found', () => {
    it('should set status to "failed" if chapter not found', async () => {
      wakeChapterIdRef.current = 999;
      (getChapterFromDb as jest.Mock).mockResolvedValue(null); // Chapter doesn't exist

      const { result } = renderTestHook();

      await act(async () => {
        result.current.handleSyncRetry();
      });

      expect(mockSetSyncDialogStatus).toHaveBeenCalledWith('failed');
    });

    it('should NOT call getChapter if chapter not found', async () => {
      wakeChapterIdRef.current = 999;
      (getChapterFromDb as jest.Mock).mockResolvedValue(null);

      const { result } = renderTestHook();

      await act(async () => {
        result.current.handleSyncRetry();
      });

      expect(mockGetChapter).not.toHaveBeenCalled();
    });

    it('should NOT hide dialog when chapter not found', async () => {
      wakeChapterIdRef.current = 999;
      (getChapterFromDb as jest.Mock).mockResolvedValue(null);

      const { result } = renderTestHook();

      await act(async () => {
        result.current.handleSyncRetry();
      });

      expect(mockSetSyncDialogVisible).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // Test Group 4: Failed Retry (Database Error)
  // ========================================
  describe('Failed Retry - Database Error', () => {
    it('should set status to "failed" if database query throws error', async () => {
      wakeChapterIdRef.current = 123;
      (getChapterFromDb as jest.Mock).mockRejectedValue(
        new Error('DB connection error'),
      );

      const { result } = renderTestHook();

      await act(async () => {
        result.current.handleSyncRetry();
      });

      expect(mockSetSyncDialogStatus).toHaveBeenCalledWith('failed');
    });

    it('should NOT call getChapter if database query fails', async () => {
      wakeChapterIdRef.current = 123;
      (getChapterFromDb as jest.Mock).mockRejectedValue(new Error('DB error'));

      const { result } = renderTestHook();

      await act(async () => {
        result.current.handleSyncRetry();
      });

      expect(mockGetChapter).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // Test Group 5: No Wake Chapter
  // ========================================
  describe('No Wake Chapter', () => {
    it('should hide dialog if wakeChapterIdRef is null', async () => {
      wakeChapterIdRef.current = null; // No chapter to sync to

      const { result } = renderTestHook();

      await act(async () => {
        result.current.handleSyncRetry();
      });

      expect(mockSetSyncDialogVisible).toHaveBeenCalledWith(false);
    });

    it('should NOT query database if wakeChapterIdRef is null', async () => {
      wakeChapterIdRef.current = null;

      const { result } = renderTestHook();

      await act(async () => {
        result.current.handleSyncRetry();
      });

      expect(getChapterFromDb).not.toHaveBeenCalled();
    });

    it('should NOT set sync status if wakeChapterIdRef is null', async () => {
      wakeChapterIdRef.current = null;

      const { result } = renderTestHook();

      await act(async () => {
        result.current.handleSyncRetry();
      });

      expect(mockSetSyncDialogStatus).not.toHaveBeenCalled();
    });

    it('should still reset syncRetryCountRef even if wakeChapterIdRef is null', async () => {
      wakeChapterIdRef.current = null;
      syncRetryCountRef.current = 10;

      const { result } = renderTestHook();

      await act(async () => {
        result.current.handleSyncRetry();
      });

      expect(syncRetryCountRef.current).toBe(0);
    });
  });

  // ========================================
  // Test Group 6: Ref Mutations
  // ========================================
  describe('Ref Mutations', () => {
    it('should always reset syncRetryCountRef regardless of outcome', async () => {
      // Test with success
      wakeChapterIdRef.current = 123;
      syncRetryCountRef.current = 3;

      const { result } = renderTestHook();

      await act(async () => {
        result.current.handleSyncRetry();
      });

      expect(syncRetryCountRef.current).toBe(0);

      // Test with failure
      syncRetryCountRef.current = 5;
      (getChapterFromDb as jest.Mock).mockRejectedValue(new Error('Fail'));

      await act(async () => {
        result.current.handleSyncRetry();
      });

      expect(syncRetryCountRef.current).toBe(0);
    });

    it('should set pendingScreenWakeSyncRef to true only when wakeChapterId exists', async () => {
      // With wakeChapterId
      wakeChapterIdRef.current = 123;
      pendingScreenWakeSyncRef.current = false;

      const { result, rerender } = renderTestHook();

      await act(async () => {
        result.current.handleSyncRetry();
      });

      expect(pendingScreenWakeSyncRef.current).toBe(true);

      // Reset and test without wakeChapterId
      pendingScreenWakeSyncRef.current = false;
      wakeChapterIdRef.current = null;

      rerender();

      await act(async () => {
        result.current.handleSyncRetry();
      });

      expect(pendingScreenWakeSyncRef.current).toBe(false);
    });
  });
});
