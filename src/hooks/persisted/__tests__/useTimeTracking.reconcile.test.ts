import { renderHook, act } from '@testing-library/react-native';
import { AppState, NativeModules } from 'react-native';
import { useTimeTracking } from '../useTimeTracking';

const mockRunAsync = jest.fn().mockResolvedValue(undefined);
const mockGetClock = jest.fn();

jest.mock('@database/db', () => ({
  db: {
    runAsync: (...args: any[]) => mockRunAsync(...args),
  },
}));

// The hook resolves NativeModules.TTSHighlight at call time, so a plain test
// double suffices — no react-native module mock needed.
const installTtsBridge = () => {
  (NativeModules as any).TTSHighlight = {
    getTtsPlaybackClock: (...args: any[]) => mockGetClock(...args),
  };
};
const removeTtsBridge = () => {
  delete (NativeModules as any).TTSHighlight;
};

const totalRecordedMs = (): number =>
  mockRunAsync.mock.calls.reduce((sum, c) => sum + (c[4] as number), 0);

describe('useTimeTracking background TTS reconciliation (native clock)', () => {
  let appStateListener: ((state: string) => void) | null = null;
  // Mutable native speaking-time stand-in (ms of utterance-active audio).
  let nativeMs = 0;
  let nativeSpeaking = true;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    nativeMs = 0;
    nativeSpeaking = true;
    mockGetClock.mockImplementation(() =>
      Promise.resolve({ spokenMs: nativeMs, speaking: nativeSpeaking }),
    );
    installTtsBridge();
    AppState.currentState = 'active';
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_, handler: any) => {
        appStateListener = handler;
        return { remove: jest.fn() } as any;
      });
  });

  afterEach(() => {
    removeTtsBridge();
    jest.useRealTimers();
  });

  it('does not double-count when JS timers stay alive in background', async () => {
    const isTTSActiveRef = { current: true };
    const { unmount } = renderHook(() =>
      useTimeTracking({
        novelId: 20,
        chapterId: 200,
        enabled: true,
        inactivityTimeoutMs: 0,
        isTTSActiveRef,
      }),
    );

    // 60s foreground (one checkpoint row)
    act(() => {
      jest.advanceTimersByTime(60000);
    });
    expect(totalRecordedMs()).toBe(60000);

    // Background entry snapshots the native clock
    nativeMs = 60000;
    await act(async () => {
      appStateListener?.('background');
    });

    // Repeat background event (background -> inactive -> background) must
    // settle, not reset, the running stretch: still no double-count.
    await act(async () => {
      appStateListener?.('background');
    });

    // 120s background with JS alive: two checkpoint rows, no top-up yet
    nativeMs = 120000;
    act(() => {
      jest.advanceTimersByTime(60000);
    });
    nativeMs = 180000;
    act(() => {
      jest.advanceTimersByTime(60000);
    });

    // Foreground: flush + ~zero top-up, session resumes
    await act(async () => {
      appStateListener?.('active');
    });

    await act(async () => {
      unmount();
    });

    // Exactly the 180s actually listened (60 fg + 120 bg) — no double count.
    expect(mockRunAsync).toHaveBeenCalledTimes(3);
    expect(totalRecordedMs()).toBe(180000);
  });

  it('recovers background time when TTS stopped while JS timers were frozen', async () => {
    const isTTSActiveRef = { current: true };
    renderHook(() =>
      useTimeTracking({
        novelId: 21,
        chapterId: 210,
        enabled: true,
        inactivityTimeoutMs: 0,
        isTTSActiveRef,
      }),
    );

    // 60s foreground, then background with native clock snapshotted
    act(() => {
      jest.advanceTimersByTime(60000);
    });
    nativeMs = 60000;
    await act(async () => {
      appStateListener?.('background');
    });

    // JS frozen for 300s (Doze): no checkpoints, no polls, stale heartbeat.
    // Native kept speaking the whole stretch, then TTS stopped.
    nativeMs = 360000;
    nativeSpeaking = false;
    jest.setSystemTime(Date.now() + 300000);

    // First timer tick after revive: stop detected, heartbeat stale so the
    // JS flush is capped to ~nothing (and dropped under MIN_SESSION_MS).
    isTTSActiveRef.current = false;
    await act(async () => {
      jest.advanceTimersByTime(800);
    });

    // Foreground: top-up recovers the 300s background stretch.
    await act(async () => {
      appStateListener?.('active');
    });

    expect(mockRunAsync).toHaveBeenCalledTimes(2);
    expect(totalRecordedMs()).toBe(360000);
  });

  it('does not start a phantom TTS session after a background stop', async () => {
    const isTTSActiveRef = { current: true };
    renderHook(() =>
      useTimeTracking({
        novelId: 22,
        chapterId: 220,
        enabled: true,
        inactivityTimeoutMs: 0,
        isTTSActiveRef,
      }),
    );

    act(() => {
      jest.advanceTimersByTime(60000);
    });
    nativeMs = 60000;
    await act(async () => {
      appStateListener?.('background');
    });

    nativeMs = 120000;
    nativeSpeaking = false;
    jest.setSystemTime(Date.now() + 60000);
    isTTSActiveRef.current = false;
    await act(async () => {
      jest.advanceTimersByTime(800);
    });
    await act(async () => {
      appStateListener?.('active');
    });
    const afterReconcile = totalRecordedMs();

    // 60s of (manual) foreground: only manual time accrues, no phantom TTS.
    // (59200 not 60000: the manual session starts mid checkpoint-phase after
    // the 800ms poll tick; a phantom TTS session would add ~59s more.)
    act(() => {
      jest.advanceTimersByTime(60000);
    });

    const manualOnly = totalRecordedMs() - afterReconcile;
    expect(manualOnly).toBeGreaterThanOrEqual(59000);
    expect(manualOnly).toBeLessThan(90000);
  });

  it('fails open to legacy accounting when the native clock is unavailable', async () => {
    mockGetClock.mockResolvedValue({ spokenMs: null, speaking: false });
    const isTTSActiveRef = { current: true };
    const { unmount } = renderHook(() =>
      useTimeTracking({
        novelId: 23,
        chapterId: 230,
        enabled: true,
        inactivityTimeoutMs: 0,
        isTTSActiveRef,
      }),
    );

    act(() => {
      jest.advanceTimersByTime(60000);
    });
    await act(async () => {
      appStateListener?.('background');
    });

    jest.setSystemTime(Date.now() + 300000);
    isTTSActiveRef.current = false;
    await act(async () => {
      jest.advanceTimersByTime(800);
    });
    await act(async () => {
      appStateListener?.('active');
    });
    await act(async () => {
      unmount();
    });

    // Only the foreground-attested time survives — same as before the fix.
    expect(totalRecordedMs()).toBe(60000);
  });
});
