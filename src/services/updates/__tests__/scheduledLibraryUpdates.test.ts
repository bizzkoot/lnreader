import dayjs from 'dayjs';
import {
  isSupportedLibraryUpdateIntervalHours,
  normalizeLibraryUpdateIntervalHours,
  isScheduledLibraryUpdateDue,
  shouldDispatchScheduledLibraryUpdate,
  dispatchScheduledLibraryUpdateIfDue,
  SUPPORTED_LIBRARY_UPDATE_INTERVAL_HOURS,
} from '../scheduledLibraryUpdates';

const mockGetTaskList = jest.fn(() => [] as any[]);
const mockAddTask = jest.fn();
const mockManager = {
  getTaskList: mockGetTaskList,
  addTask: mockAddTask,
};
jest.mock('@utils/mmkv/mmkv', () => ({
  MMKVStorage: { getString: jest.fn(), set: jest.fn() },
  getMMKVObject: jest.fn(),
  setMMKVObject: jest.fn(),
}));
jest.mock('@services/ServiceManager', () => ({
  __esModule: true,
  default: {
    manager: {
      getTaskList: mockGetTaskList,
      addTask: mockAddTask,
    },
  },
}));

import { getMMKVObject, MMKVStorage } from '@utils/mmkv/mmkv';

const mockedGetMMKVObject = getMMKVObject as jest.MockedFunction<
  typeof getMMKVObject
>;
const mockedGetString = MMKVStorage.getString as jest.MockedFunction<
  typeof MMKVStorage.getString
>;

describe('supported intervals', () => {
  it('accepts only 0,12,24,48,72,168', () => {
    expect(SUPPORTED_LIBRARY_UPDATE_INTERVAL_HOURS).toEqual([
      0, 12, 24, 48, 72, 168,
    ]);
    [0, 12, 24, 48, 72, 168].forEach(v => {
      expect(isSupportedLibraryUpdateIntervalHours(v)).toBe(true);
    });
  });

  it('rejects unsupported values', () => {
    [1, 6, 11, 13, 48.5, 100, -1, NaN, null, undefined, '24'].forEach(v => {
      expect(isSupportedLibraryUpdateIntervalHours(v)).toBe(false);
    });
  });

  it('normalizes to 0 for unsupported', () => {
    expect(normalizeLibraryUpdateIntervalHours(24)).toBe(24);
    expect(normalizeLibraryUpdateIntervalHours(13)).toBe(0);
    expect(normalizeLibraryUpdateIntervalHours(undefined)).toBe(0);
    expect(normalizeLibraryUpdateIntervalHours(null)).toBe(0);
  });
});

describe('isScheduledLibraryUpdateDue', () => {
  const base = dayjs('2026-08-18 12:00:00', 'YYYY-MM-DD HH:mm:ss').valueOf();

  it('returns false when interval is 0 (off)', () => {
    expect(isScheduledLibraryUpdateDue('2026-08-10 12:00:00', 0, base)).toBe(
      false,
    );
  });

  it('returns true when no lastUpdateTime', () => {
    expect(isScheduledLibraryUpdateDue(undefined, 24, base)).toBe(true);
    expect(isScheduledLibraryUpdateDue(null, 24, base)).toBe(true);
    expect(isScheduledLibraryUpdateDue('', 24, base)).toBe(true);
  });

  it('returns true when interval elapsed (strict format)', () => {
    const last = dayjs(base).subtract(24, 'hour').format('YYYY-MM-DD HH:mm:ss');
    expect(isScheduledLibraryUpdateDue(last, 24, base)).toBe(true);
  });

  it('returns false when interval not yet elapsed', () => {
    const last = dayjs(base).subtract(12, 'hour').format('YYYY-MM-DD HH:mm:ss');
    expect(isScheduledLibraryUpdateDue(last, 24, base)).toBe(false);
  });

  it('handles generic dayjs parse fallback', () => {
    const last = '2026-08-17T12:00:00.000Z';
    const now = dayjs(last).add(25, 'hour').valueOf();
    expect(isScheduledLibraryUpdateDue(last, 24, now)).toBe(true);
  });

  it('returns true on invalid lastUpdateTime (treat as due)', () => {
    expect(isScheduledLibraryUpdateDue('not-a-date', 24, base)).toBe(true);
  });

  it('returns false on future lastUpdateTime (clock skew)', () => {
    const future = dayjs(base).add(1, 'hour').format('YYYY-MM-DD HH:mm:ss');
    expect(isScheduledLibraryUpdateDue(future, 24, base)).toBe(false);
  });

  it('respects exact threshold boundary', () => {
    const last = dayjs(base)
      .subtract(12, 'hour')
      .subtract(1, 'second')
      .format('YYYY-MM-DD HH:mm:ss');
    // 12h +1s elapsed -> due for 12h interval
    expect(isScheduledLibraryUpdateDue(last, 12, base)).toBe(true);
  });
});

describe('shouldDispatchScheduledLibraryUpdate', () => {
  it('dedups when pending task exists', () => {
    expect(
      shouldDispatchScheduledLibraryUpdate({
        intervalHours: 24,
        lastUpdateTime: undefined,
        hasPendingUpdateTask: true,
      }),
    ).toBe(false);
  });

  it('dispatches when due and no pending', () => {
    expect(
      shouldDispatchScheduledLibraryUpdate({
        intervalHours: 24,
        lastUpdateTime: undefined,
        hasPendingUpdateTask: false,
      }),
    ).toBe(true);
  });

  it('does not dispatch when not due', () => {
    const now = dayjs('2026-08-18 12:00:00', 'YYYY-MM-DD HH:mm:ss').valueOf();
    const recent = dayjs(now).subtract(1, 'hour').format('YYYY-MM-DD HH:mm:ss');
    expect(
      shouldDispatchScheduledLibraryUpdate({
        intervalHours: 24,
        lastUpdateTime: recent,
        nowMs: now,
        hasPendingUpdateTask: false,
      }),
    ).toBe(false);
  });
});

describe('dispatchScheduledLibraryUpdateIfDue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTaskList.mockReturnValue([]);
  });

  it('dispatches via ServiceManager when due', () => {
    mockedGetMMKVObject.mockReturnValue({
      automaticLibraryUpdateIntervalHours: 24,
    } as any);
    mockedGetString.mockReturnValue(undefined as any);
    const result = dispatchScheduledLibraryUpdateIfDue({
      nowMs: Date.now(),
      manager: mockManager,
    });
    expect(result).toBe(true);
    expect(mockAddTask).toHaveBeenCalledWith({
      name: 'UPDATE_LIBRARY',
    });
  });

  it('does not dispatch when off', () => {
    mockedGetMMKVObject.mockReturnValue({
      automaticLibraryUpdateIntervalHours: 0,
    } as any);
    mockedGetString.mockReturnValue(undefined as any);
    const result = dispatchScheduledLibraryUpdateIfDue();
    expect(result).toBe(false);
    expect(mockAddTask).not.toHaveBeenCalled();
  });

  it('does not dispatch when not due', () => {
    mockedGetMMKVObject.mockReturnValue({
      automaticLibraryUpdateIntervalHours: 24,
    } as any);
    const now = Date.now();
    const recent = dayjs(now).format('YYYY-MM-DD HH:mm:ss');
    mockedGetString.mockReturnValue(recent as any);
    const result = dispatchScheduledLibraryUpdateIfDue({
      nowMs: now,
      manager: mockManager,
    });
    expect(result).toBe(false);
    expect(mockAddTask).not.toHaveBeenCalled();
  });

  it('dedups: does not dispatch when UPDATE_LIBRARY already queued', () => {
    mockedGetMMKVObject.mockReturnValue({
      automaticLibraryUpdateIntervalHours: 24,
    } as any);
    mockedGetString.mockReturnValue(undefined as any);
    mockGetTaskList.mockReturnValue([
      { task: { name: 'UPDATE_LIBRARY' }, meta: {} } as any,
    ]);
    const result = dispatchScheduledLibraryUpdateIfDue({
      manager: mockManager,
    });
    expect(result).toBe(false);
    expect(mockAddTask).not.toHaveBeenCalled();
  });

  it('normalizes unsupported interval to off', () => {
    mockedGetMMKVObject.mockReturnValue({
      automaticLibraryUpdateIntervalHours: 13,
    } as any);
    mockedGetString.mockReturnValue(undefined as any);
    const result = dispatchScheduledLibraryUpdateIfDue();
    expect(result).toBe(false);
    expect(mockAddTask).not.toHaveBeenCalled();
  });

  it('treats missing settings as off', () => {
    mockedGetMMKVObject.mockReturnValue(undefined as any);
    mockedGetString.mockReturnValue(undefined as any);
    const result = dispatchScheduledLibraryUpdateIfDue();
    expect(result).toBe(false);
  });
});
