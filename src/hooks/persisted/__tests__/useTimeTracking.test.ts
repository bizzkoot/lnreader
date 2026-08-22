import { renderHook, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useTimeTracking } from '../useTimeTracking';

const mockRunAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('@database/db', () => ({
  db: {
    runAsync: (...args: any[]) => mockRunAsync(...args),
  },
}));

describe('useTimeTracking (Dual-Mode: Manual + TTS)', () => {
  let appStateListener: ((state: string) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    AppState.currentState = 'active';
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_, handler: any) => {
        appStateListener = handler;
        return { remove: jest.fn() } as any;
      });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('tracks manual reading in foreground and flushes on unmount', async () => {
    const { unmount } = renderHook(() =>
      useTimeTracking({
        novelId: 1,
        chapterId: 10,
        enabled: true,
        inactivityTimeoutMs: 0,
        isTTSActive: false,
      }),
    );

    // Advance 5 seconds
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    await act(async () => {
      unmount();
    });

    expect(mockRunAsync).toHaveBeenCalledWith(
      'INSERT INTO ReadingSession (novelId, chapterId, startTime, duration) VALUES (?, ?, ?, ?)',
      1,
      10,
      expect.any(Number),
      5000,
    );
  });

  it('pauses manual reading and flushes when app goes into background', async () => {
    renderHook(() =>
      useTimeTracking({
        novelId: 1,
        chapterId: 10,
        enabled: true,
        inactivityTimeoutMs: 0,
        isTTSActive: false,
      }),
    );

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    await act(async () => {
      appStateListener?.('background');
    });

    expect(mockRunAsync).toHaveBeenCalledWith(
      'INSERT INTO ReadingSession (novelId, chapterId, startTime, duration) VALUES (?, ?, ?, ?)',
      1,
      10,
      expect.any(Number),
      3000,
    );
  });

  it('auto-pauses manual reading after inactivity timeout', async () => {
    renderHook(() =>
      useTimeTracking({
        novelId: 2,
        chapterId: 20,
        enabled: true,
        inactivityTimeoutMs: 5000,
        isTTSActive: false,
      }),
    );

    // Advance past inactivity timeout (5s)
    await act(async () => {
      jest.advanceTimersByTime(5001);
    });

    expect(mockRunAsync).toHaveBeenCalledWith(
      'INSERT INTO ReadingSession (novelId, chapterId, startTime, duration) VALUES (?, ?, ?, ?)',
      2,
      20,
      expect.any(Number),
      5000,
    );
  });

  it('tracks TTS reading in foreground and background without inactivity timeout', async () => {
    const isTTSActiveRef = { current: true };
    const { unmount } = renderHook(() =>
      useTimeTracking({
        novelId: 3,
        chapterId: 30,
        enabled: true,
        inactivityTimeoutMs: 5000,
        isTTSActive: true,
        isTTSActiveRef,
      }),
    );

    // Advance 4s in foreground
    act(() => {
      jest.advanceTimersByTime(4000);
    });

    // App goes to background while TTS is playing
    act(() => {
      appStateListener?.('background');
    });

    // Advance 6s in background (past the 5s inactivity limit)
    act(() => {
      jest.advanceTimersByTime(6000);
    });

    // TTS tracking continues uninterrupted in background!
    await act(async () => {
      unmount();
    });

    expect(mockRunAsync).toHaveBeenCalledTimes(1);
    expect(mockRunAsync).toHaveBeenCalledWith(
      'INSERT INTO ReadingSession (novelId, chapterId, startTime, duration) VALUES (?, ?, ?, ?)',
      3,
      30,
      expect.any(Number),
      10000,
    );
  });

  it('switches seamlessly from manual to TTS without double-counting', async () => {
    const isTTSActiveRef = { current: false };
    const { rerender } = renderHook<
      ReturnType<typeof useTimeTracking>,
      { isTTS: boolean }
    >(
      ({ isTTS }) =>
        useTimeTracking({
          novelId: 4,
          chapterId: 40,
          enabled: true,
          inactivityTimeoutMs: 0,
          isTTSActive: isTTS,
          isTTSActiveRef,
        }),
      { initialProps: { isTTS: false } },
    );

    // 3s of manual reading
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    // User starts TTS
    isTTSActiveRef.current = true;
    await act(async () => {
      rerender({ isTTS: true });
    });

    // Manual session should be flushed
    expect(mockRunAsync).toHaveBeenCalledWith(
      'INSERT INTO ReadingSession (novelId, chapterId, startTime, duration) VALUES (?, ?, ?, ?)',
      4,
      40,
      expect.any(Number),
      3000,
    );
    mockRunAsync.mockClear();

    // 4s of TTS playback
    act(() => {
      jest.advanceTimersByTime(4000);
    });

    // User pauses TTS
    isTTSActiveRef.current = false;
    await act(async () => {
      rerender({ isTTS: false });
    });

    // TTS session should be flushed
    expect(mockRunAsync).toHaveBeenCalledWith(
      'INSERT INTO ReadingSession (novelId, chapterId, startTime, duration) VALUES (?, ?, ?, ?)',
      4,
      40,
      expect.any(Number),
      4000,
    );
  });
});
