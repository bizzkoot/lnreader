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

  it('auto-pauses manual reading after inactivity timeout (idle excluded)', async () => {
    const { result } = renderHook(() =>
      useTimeTracking({
        novelId: 2,
        chapterId: 20,
        enabled: true,
        inactivityTimeoutMs: 5000,
        isTTSActive: false,
      }),
    );

    // Simulate activity at 2s (e.g., scroll) – lastActivity = 2s
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    act(() => {
      result.current.recordActivity();
    });

    // Advance past inactivity timeout (5s after last activity → fires at ~7s)
    await act(async () => {
      jest.advanceTimersByTime(5001);
    });

    // AUD-TIME-02: idle window (5s) excluded, duration = lastActivity(2s) - start(0) = 2000
    expect(mockRunAsync).toHaveBeenCalledWith(
      'INSERT INTO ReadingSession (novelId, chapterId, startTime, duration) VALUES (?, ?, ?, ?)',
      2,
      20,
      expect.any(Number),
      2000,
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

  it('preserves full background TTS reading time when paused via lockscreen/media button', async () => {
    const isTTSActiveRef = { current: true };
    renderHook(() =>
      useTimeTracking({
        novelId: 10,
        chapterId: 100,
        enabled: true,
        inactivityTimeoutMs: 0,
        isTTSActiveRef,
      }),
    );

    // 10s playback in foreground
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    // App enters background (screen turned off / user locks phone)
    act(() => {
      appStateListener?.('background');
    });

    // User listens for 40 seconds in background
    act(() => {
      jest.advanceTimersByTime(40000);
    });

    // User pauses via lockscreen notification / headset (ref changes, no component re-render)
    isTTSActiveRef.current = false;

    // Advance 700ms for polling interval to detect pause
    await act(async () => {
      jest.advanceTimersByTime(700);
    });

    // Total reading time must include foreground + background (~50s)
    expect(mockRunAsync).toHaveBeenCalledWith(
      'INSERT INTO ReadingSession (novelId, chapterId, startTime, duration) VALUES (?, ?, ?, ?)',
      10,
      100,
      expect.any(Number),
      expect.any(Number),
    );
    const call1 = mockRunAsync.mock.calls[mockRunAsync.mock.calls.length - 1];
    expect(call1[4]).toBeGreaterThanOrEqual(50000);
    expect(call1[4]).toBeLessThanOrEqual(51500);
  });

  it('tracks background TTS playback started while screen is already off', async () => {
    const isTTSActiveRef = { current: false };
    AppState.currentState = 'background';

    renderHook(() =>
      useTimeTracking({
        novelId: 10,
        chapterId: 100,
        enabled: true,
        inactivityTimeoutMs: 0,
        isTTSActiveRef,
      }),
    );

    // Screen has been off in background for 60 seconds
    act(() => {
      appStateListener?.('background');
      jest.advanceTimersByTime(60000);
    });

    // User presses Play on Bluetooth headset while screen is still off
    isTTSActiveRef.current = true;
    await act(async () => {
      jest.advanceTimersByTime(700);
    });

    // Plays for 45 seconds in background
    act(() => {
      jest.advanceTimersByTime(45000);
    });

    // User presses Pause on Bluetooth headset
    isTTSActiveRef.current = false;
    await act(async () => {
      jest.advanceTimersByTime(700);
    });

    // Must record full background session (~45s), NOT 0
    expect(mockRunAsync).toHaveBeenCalledWith(
      'INSERT INTO ReadingSession (novelId, chapterId, startTime, duration) VALUES (?, ?, ?, ?)',
      10,
      100,
      expect.any(Number),
      expect.any(Number),
    );
    const call2 = mockRunAsync.mock.calls[mockRunAsync.mock.calls.length - 1];
    expect(call2[4]).toBeGreaterThanOrEqual(45000);
    expect(call2[4]).toBeLessThanOrEqual(47000);
  });

  it('caps Doze drift if poller is suspended and wakes up hours later', async () => {
    const isTTSActiveRef = { current: true };
    renderHook(() =>
      useTimeTracking({
        novelId: 10,
        chapterId: 100,
        enabled: true,
        inactivityTimeoutMs: 0,
        isTTSActiveRef,
      }),
    );

    // Play for 30s
    act(() => {
      jest.advanceTimersByTime(30000);
    });

    // TTS stops at t = 30s
    isTTSActiveRef.current = false;

    // Simulate extreme Doze suspension: JS timers frozen for 2 hours (7,200,000 ms)
    const originalDateNow = Date.now;
    try {
      let fakeNow = originalDateNow() + 30000;
      jest.spyOn(Date, 'now').mockImplementation(() => fakeNow);

      // 2 hours pass while device is suspended in Doze
      fakeNow += 2 * 3600 * 1000;

      // Device wakes up and poller finally runs
      await act(async () => {
        jest.advanceTimersByTime(700);
      });

      // Duration should be capped to heartbeat (~30s) + grace window, NOT 2 hours!
      expect(mockRunAsync).toHaveBeenCalledWith(
        'INSERT INTO ReadingSession (novelId, chapterId, startTime, duration) VALUES (?, ?, ?, ?)',
        10,
        100,
        expect.any(Number),
        expect.any(Number),
      );
      const call = mockRunAsync.mock.calls[mockRunAsync.mock.calls.length - 1];
      const recordedDuration = call[4];
      expect(recordedDuration).toBeLessThanOrEqual(35000);
      expect(recordedDuration).toBeGreaterThanOrEqual(30000);
    } finally {
      Date.now = originalDateNow;
    }
  });
});
