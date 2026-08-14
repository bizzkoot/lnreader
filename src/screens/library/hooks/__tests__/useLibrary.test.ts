import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useFocusEffect } from '@react-navigation/native';

import { getLibraryNovelsFromDb } from '@database/queries/LibraryQueries';
import { getCategoriesFromDb } from '@database/queries/CategoryQueries';
import { NovelInfo } from '@database/types';
import { useLibrary } from '../useLibrary';

jest.mock('@database/queries/LibraryQueries', () => ({
  getLibraryNovelsFromDb: jest.fn(),
}));

jest.mock('@database/queries/CategoryQueries', () => ({
  getCategoriesFromDb: jest.fn(),
}));

jest.mock('@services/ServiceManager', () => ({
  __esModule: true,
  default: {
    manager: {
      STORE_KEY: 'background-tasks',
      addTask: jest.fn(),
    },
  },
}));

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn(() => ({
    set: jest.fn(),
    getString: jest.fn(),
    getNumber: jest.fn(),
    getBoolean: jest.fn(),
    delete: jest.fn(),
    getAllKeys: jest.fn(),
    clearAll: jest.fn(),
    addOnValueChangedListener: jest.fn(() => ({ remove: jest.fn() })),
  })),
  useMMKVObject: jest.fn(() => [undefined, jest.fn()]),
}));

jest.mock('@hooks/persisted', () => ({
  useLibrarySettings: jest.fn(() => mockLibrarySettings),
}));

const mockLibrarySettings = {
  filter: [],
  sortOrder: 0,
  downloadedOnlyMode: false,
};

const mockGetLibraryNovelsFromDb =
  getLibraryNovelsFromDb as jest.MockedFunction<typeof getLibraryNovelsFromDb>;
const mockGetCategoriesFromDb = getCategoriesFromDb as jest.MockedFunction<
  typeof getCategoriesFromDb
>;
const mockUseFocusEffect = useFocusEffect as jest.Mock;

describe('useLibrary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLibraryNovelsFromDb.mockReturnValue([]);
    mockGetCategoriesFromDb.mockReturnValue([]);
    // Default: register the callback without invoking it (mimics navigation focus).
    mockUseFocusEffect.mockImplementation(() => {});
  });

  it('loads the library on focus and stops loading', async () => {
    const novels = [{ id: 1, name: 'Test Novel' } as NovelInfo];
    mockGetLibraryNovelsFromDb.mockReturnValue(novels);
    mockUseFocusEffect.mockImplementationOnce(callback => {
      callback();
    });

    const { result } = renderHook(() => useLibrary());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.library).toEqual(novels);
    expect(result.current.error).toBeUndefined();
  });

  it('stops loading and exposes database errors', async () => {
    const databaseError = new Error('Failed to load library');
    mockGetLibraryNovelsFromDb.mockImplementationOnce(() => {
      throw databaseError;
    });
    mockUseFocusEffect.mockImplementationOnce(callback => {
      callback();
    });

    const { result } = renderHook(() => useLibrary());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe(databaseError);
  });

  it('recovers after an error when refetched', async () => {
    const databaseError = new Error('Transient failure');
    mockGetLibraryNovelsFromDb
      .mockImplementationOnce(() => {
        throw databaseError;
      })
      .mockReturnValueOnce([{ id: 2, name: 'Recovered' } as NovelInfo]);
    mockUseFocusEffect.mockImplementationOnce(callback => {
      callback();
    });

    const { result } = renderHook(() => useLibrary());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe(databaseError);

    act(() => {
      void result.current.refetchLibrary();
    });

    await waitFor(() => expect(result.current.library).toHaveLength(1));
    expect(result.current.error).toBeUndefined();
  });

  it('keeps the focus callback stable across renders', () => {
    const { rerender } = renderHook(() => useLibrary());
    const calls = mockUseFocusEffect.mock.calls;
    const firstFocusCallback = calls[calls.length - 1]?.[0];

    rerender(undefined);

    const callsAfterRerender = mockUseFocusEffect.mock.calls;
    expect(callsAfterRerender[callsAfterRerender.length - 1]?.[0]).toBe(
      firstFocusCallback,
    );
  });
});
