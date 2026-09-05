/**
 * Reading-time simulation: manual scroll vs TTS read → Statistics (Time tab).
 *
 * Bridges the mocked seam between useTimeTracking.test.ts (hook → db mock)
 * and StatsQueries.readingTime.test.ts (query → helper mock): here the mocked
 * db actually accumulates ReadingSession rows, and the real StatsScreen
 * formatters assert what the user would see.
 *
 * Reproduces the user report: a short in-reader test shows 0 total time.
 */
import { renderHook, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useTimeTracking } from '../useTimeTracking';
import {
  formatTimeSpent,
  formatTotalTimeParts,
} from '@screens/StatsScreen/utils';

interface SessionRow {
  novelId: number;
  chapterId: number;
  startTime: number;
  duration: number;
}

// In-memory ReadingSession stand-in: collects what the hook INSERTs.
const sessionRows: SessionRow[] = [];

jest.mock('@database/db', () => ({
  db: {
    runAsync: jest.fn((sql: string, ...params: number[]) => {
      const [novelId, chapterId, startTime, duration] = params;
      sessionRows.push({ novelId, chapterId, startTime, duration });
      return Promise.resolve(undefined);
    }),
  },
}));

// Mirrors getTotalReadingTime: SELECT COALESCE(SUM(duration), 0)
const simulatedTotalReadingTime = () =>
  sessionRows.reduce((sum, r) => sum + r.duration, 0);

describe('reading-time simulation (scroll vs TTS → Statistics)', () => {
  let appStateListener: ((state: string) => void) | null = null;

  beforeEach(() => {
    sessionRows.length = 0;
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

  it('(a) manual scroll: 20s session only lands in Statistics after exiting the reader', async () => {
    const { result, unmount } = renderHook(() =>
      useTimeTracking({
        novelId: 1,
        chapterId: 10,
        enabled: true,
        inactivityTimeoutMs: 0, // app default: never auto-pause
        isTTSActive: false,
      }),
    );

    // Simulate core.js scroll posts (~every 2s) for 20s of manual reading
    for (let i = 0; i < 10; i++) {
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      act(() => {
        result.current.recordActivity();
      });
    }

    // Gotcha #1: stats queried while still in the reader see NOTHING —
    // the session only INSERTs on flush (unmount / chapter change / background)
    expect(simulatedTotalReadingTime()).toBe(0);

    // Exit the reader → unmount flush
    await act(async () => {
      unmount();
    });

    expect(sessionRows).toHaveLength(1);
    expect(sessionRows[0]).toMatchObject({
      novelId: 1,
      chapterId: 10,
      duration: 20000,
    });

    // 20s is recorded AND visible: the Time tab shows seconds precision
    const total = simulatedTotalReadingTime();
    expect(formatTotalTimeParts(total)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 20,
    });
    expect(formatTimeSpent(total)).toBe('20s');
  });

  it('(b) TTS read: 45s session (incl. background) lands after TTS stops', async () => {
    const isTTSActiveRef = { current: true };
    const { rerender } = renderHook(
      ({ isTTS }: { isTTS: boolean }) =>
        useTimeTracking({
          novelId: 2,
          chapterId: 20,
          enabled: true,
          inactivityTimeoutMs: 5000,
          isTTSActive: isTTS,
          isTTSActiveRef,
        }),
      { initialProps: { isTTS: true } },
    );

    act(() => {
      jest.advanceTimersByTime(15000);
    });
    // Screen off mid-playback: TTS tracking continues (manual would flush here)
    act(() => {
      appStateListener?.('background');
    });
    act(() => {
      jest.advanceTimersByTime(30000);
    });

    // User stops TTS → session flushes
    isTTSActiveRef.current = false;
    await act(async () => {
      rerender({ isTTS: false });
    });

    expect(sessionRows).toHaveLength(1);
    expect(sessionRows[0]).toMatchObject({
      novelId: 2,
      chapterId: 20,
      duration: 45000,
    });

    // Same seconds precision as manual mode
    expect(formatTimeSpent(simulatedTotalReadingTime())).toBe('45s');
  });

  it('sessions accumulate across checkpoints: 5min manual read shows 5m', async () => {
    const { result, unmount } = renderHook(() =>
      useTimeTracking({
        novelId: 3,
        chapterId: 30,
        enabled: true,
        inactivityTimeoutMs: 0,
        isTTSActive: false,
      }),
    );

    // 5 minutes of scrolling (60s checkpoint splits it into multiple rows)
    for (let i = 0; i < 150; i++) {
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      act(() => {
        result.current.recordActivity();
      });
    }
    await act(async () => {
      unmount();
    });

    // SUM(duration) is what Statistics displays — row split is irrelevant
    expect(simulatedTotalReadingTime()).toBe(300000);
    expect(formatTotalTimeParts(simulatedTotalReadingTime())).toEqual({
      days: 0,
      hours: 0,
      minutes: 5,
      seconds: 0,
    });
    expect(formatTimeSpent(simulatedTotalReadingTime())).toBe('5m');
  });

  it('(d) combined manual reading + TTS: statistics shows the sum of both', async () => {
    const isTTSActiveRef = { current: false };
    const { result, unmount, rerender } = renderHook(
      ({ isTTS }: { isTTS: boolean }) =>
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

    // 1. Manual reading for 20 seconds with user activity (e.g. scrolling)
    for (let i = 0; i < 10; i++) {
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      act(() => {
        result.current.recordActivity();
      });
    }

    // 2. User starts TTS: manual session flushes, TTS starts
    isTTSActiveRef.current = true;
    await act(async () => {
      rerender({ isTTS: true });
    });

    // 3. TTS plays for 40 seconds (including 30s in background)
    act(() => {
      jest.advanceTimersByTime(10000);
    });
    act(() => {
      appStateListener?.('background');
    });
    act(() => {
      jest.advanceTimersByTime(30000);
    });

    // 4. Return to foreground and stop TTS
    act(() => {
      appStateListener?.('active');
    });
    isTTSActiveRef.current = false;
    await act(async () => {
      rerender({ isTTS: false });
    });

    // 5. Exit reader
    await act(async () => {
      unmount();
    });

    // Both manual session (20s) and TTS session (40s) are recorded in ReadingSession
    expect(sessionRows).toHaveLength(2);
    expect(sessionRows[0]).toMatchObject({
      novelId: 4,
      chapterId: 40,
      duration: 20000,
    });
    expect(sessionRows[1]).toMatchObject({
      novelId: 4,
      chapterId: 40,
      duration: 40000,
    });

    // Total reading time in Statistics reflects the exact sum of both (20s + 40s = 60s)
    const total = simulatedTotalReadingTime();
    expect(total).toBe(60000);
    expect(formatTotalTimeParts(total)).toEqual({
      days: 0,
      hours: 0,
      minutes: 1,
      seconds: 0,
    });
    expect(formatTimeSpent(total)).toBe('1m');
  });
});
