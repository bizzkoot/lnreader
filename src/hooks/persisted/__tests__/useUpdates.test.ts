import { act, renderHook } from '@testing-library/react-native';

import {
  getDetailedUpdatesFromDb,
  getUpdatedOverviewFromDb,
} from '@database/queries/ChapterQueries';
import { UpdateOverview } from '@database/types';
import { useUpdates, LAST_UPDATE_TIME } from '../useUpdates';

// Module-level mock state (prefixed with `mock` so the jest.mock factory may
// reference it).
const mockHookValues: Record<string, unknown> = {};
const mockHookSetters: Record<string, (value: unknown) => void> = {};

jest.mock('react-native-mmkv', () => ({
  useMMKVBoolean: jest.fn((key: string) => {
    const setter = (value: unknown) => {
      mockHookValues[key] = value;
    };
    mockHookSetters[key] = setter;
    return [mockHookValues[key] ?? true, setter];
  }),
  useMMKVString: jest.fn((key: string) => {
    const setter = (value: unknown) => {
      mockHookValues[key] = value;
    };
    mockHookSetters[key] = setter;
    return [mockHookValues[key], setter];
  }),
}));

jest.mock('@database/queries/ChapterQueries', () => ({
  getDetailedUpdatesFromDb: jest.fn(),
  getUpdatedOverviewFromDb: jest.fn(),
}));

const mockGetUpdatedOverviewFromDb =
  getUpdatedOverviewFromDb as jest.MockedFunction<
    typeof getUpdatedOverviewFromDb
  >;
const mockGetDetailedUpdatesFromDb =
  getDetailedUpdatesFromDb as jest.MockedFunction<
    typeof getDetailedUpdatesFromDb
  >;

const makeOverview = (overrides: Partial<UpdateOverview>): UpdateOverview => ({
  inLibrary: true,
  novelId: 1,
  novelName: 'Novel',
  updateDate: '2026-08-14',
  updatesPerDay: 1,
  novelCover: 'cover.png',
  ...overrides,
});

describe('useUpdates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockHookValues).forEach(k => delete mockHookValues[k]);
    Object.keys(mockHookSetters).forEach(k => delete mockHookSetters[k]);
    mockGetUpdatedOverviewFromDb.mockResolvedValue([]);
    mockGetDetailedUpdatesFromDb.mockResolvedValue([]);
  });

  it('discards a stale overview result when a newer fetch resolves first', async () => {
    let resolveStale!: (value: UpdateOverview[]) => void;
    mockGetUpdatedOverviewFromDb
      .mockImplementationOnce(
        () =>
          new Promise<UpdateOverview[]>(resolve => {
            resolveStale = resolve;
          }),
      )
      .mockResolvedValueOnce([makeOverview({ novelId: 1 })]);

    const { result } = renderHook(() => useUpdates());

    // Slow focus-triggered fetch (request 1), then a delete-refetch (request 2).
    let calls!: { stale: Promise<void>; fresh: Promise<void> };
    act(() => {
      calls = {
        stale: result.current.getUpdates(),
        fresh: result.current.getUpdates(),
      };
    });
    await act(async () => {
      await calls.fresh;
    });
    // The slow fetch resolves afterwards with pre-delete rows.
    await act(async () => {
      resolveStale([makeOverview({ novelId: 99 })]);
      await calls.stale;
    });

    expect(result.current.updatesOverview).toEqual([
      makeOverview({ novelId: 1 }),
    ]);
  });

  it('does not surface errors from a superseded request', async () => {
    let rejectStale!: (err: Error) => void;
    mockGetUpdatedOverviewFromDb
      .mockImplementationOnce(
        () =>
          new Promise<UpdateOverview[]>((_resolve, reject) => {
            rejectStale = reject;
          }),
      )
      .mockResolvedValueOnce([makeOverview({ novelId: 2 })]);

    const { result } = renderHook(() => useUpdates());

    let calls!: { stale: Promise<void>; fresh: Promise<void> };
    act(() => {
      calls = {
        stale: result.current.getUpdates(),
        fresh: result.current.getUpdates(),
      };
    });
    await act(async () => {
      await calls.fresh;
    });
    await act(async () => {
      rejectStale(new Error('stale failure'));
      await calls.stale;
    });

    expect(result.current.error).toBe('');
    expect(result.current.updatesOverview).toEqual([
      makeOverview({ novelId: 2 }),
    ]);
  });

  it('surfaces errors from the latest request', async () => {
    mockGetUpdatedOverviewFromDb.mockRejectedValueOnce(new Error('db down'));

    const { result } = renderHook(() => useUpdates());

    await act(async () => {
      await result.current.getUpdates();
    });

    expect(result.current.error).toBe('db down');
    expect(result.current.updatesOverview).toEqual([]);
  });

  it('updates LAST_UPDATE_TIME when the newest update date is newer', async () => {
    mockHookValues[LAST_UPDATE_TIME] = '2026-08-01';
    mockGetUpdatedOverviewFromDb.mockResolvedValueOnce([
      makeOverview({ updateDate: '2026-08-14' }),
    ]);

    const { result } = renderHook(() => useUpdates());

    await act(async () => {
      await result.current.getUpdates();
    });

    expect(mockHookValues[LAST_UPDATE_TIME]).toBe('2026-08-14');
  });

  it('does not update LAST_UPDATE_TIME when the result is older', async () => {
    mockHookValues[LAST_UPDATE_TIME] = '2026-08-20';
    mockGetUpdatedOverviewFromDb.mockResolvedValueOnce([
      makeOverview({ updateDate: '2026-08-14' }),
    ]);

    const { result } = renderHook(() => useUpdates());

    await act(async () => {
      await result.current.getUpdates();
    });

    expect(mockHookValues[LAST_UPDATE_TIME]).toBe('2026-08-20');
  });
});
