import {
  getLibraryWithCategory,
  getLibraryNovelsFromDb,
} from '@database/queries/LibraryQueries';
import type { BackgroundTaskMetadata } from '@services/ServiceManager';
import type { LibraryNovelInfo } from '@database/types';
import { updateNovel } from '../LibraryUpdateQueries';
import { updateLibrary } from '../index';

jest.mock('@database/queries/LibraryQueries', () => ({
  getLibraryNovelsFromDb: jest.fn(),
  getLibraryWithCategory: jest.fn(),
}));
jest.mock('../LibraryUpdateQueries', () => ({
  updateNovel: jest.fn(),
}));
jest.mock('@utils/sleep', () => ({
  sleep: jest.fn(() => Promise.resolve()),
}));
jest.mock('@utils/showToast', () => ({
  showToast: jest.fn(),
}));
jest.mock('@utils/mmkv/mmkv', () => ({
  MMKVStorage: { set: jest.fn() },
  getMMKVObject: jest.fn(() => ({})),
}));
jest.mock('@hooks/persisted/useUpdates', () => ({
  LAST_UPDATE_TIME: 'LAST_UPDATE_TIME',
}));
jest.mock('@hooks/persisted/useSettings', () => ({
  APP_SETTINGS: 'APP_SETTINGS',
}));

const mockedGetLibraryNovels = jest.mocked(getLibraryNovelsFromDb);
const mockedGetLibraryWithCategory = jest.mocked(getLibraryWithCategory);
const mockedUpdateNovel = jest.mocked(updateNovel);

const novel = (id: number, pluginId: string, name: string): LibraryNovelInfo =>
  ({
    id,
    pluginId,
    name,
    path: `/${name}`,
  }) as LibraryNovelInfo;

const flushPromises = () => new Promise(resolve => setImmediate(resolve));

describe('updateLibrary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates at most three different sources while keeping each source sequential', async () => {
    const novels = [
      novel(1, 'source-a', 'A One'),
      novel(2, 'source-a', 'A Two'),
      novel(3, 'source-b', 'B One'),
      novel(4, 'source-c', 'C One'),
      novel(5, 'source-d', 'D One'),
    ];
    mockedGetLibraryNovels.mockReturnValue(novels);

    const completions = new Map<number, () => void>();
    mockedUpdateNovel.mockImplementation(
      (_pluginId, _path, novelId) =>
        new Promise<void>(resolve => completions.set(novelId, resolve)),
    );

    let metadata: BackgroundTaskMetadata = {
      name: 'Update library',
      isRunning: false,
      progress: undefined,
      progressText: undefined,
    };
    const progressSnapshots: BackgroundTaskMetadata[] = [];
    const setMeta = (
      transform: (meta: BackgroundTaskMetadata) => BackgroundTaskMetadata,
    ) => {
      metadata = transform(metadata);
      progressSnapshots.push(metadata);
    };

    const updatePromise = updateLibrary({}, setMeta);
    await flushPromises();

    expect(mockedUpdateNovel.mock.calls.map(([pluginId]) => pluginId)).toEqual([
      'source-a',
      'source-b',
      'source-c',
    ]);
    expect(progressSnapshots[progressSnapshots.length - 1]?.progressText).toBe(
      ['A One', 'B One', 'C One'].join('\n'),
    );

    completions.get(3)?.();
    await flushPromises();
    expect(mockedUpdateNovel).toHaveBeenCalledTimes(4);
    expect(mockedUpdateNovel.mock.calls[3][0]).toBe('source-d');

    completions.get(1)?.();
    await flushPromises();
    expect(mockedUpdateNovel).toHaveBeenCalledTimes(5);
    expect(mockedUpdateNovel.mock.calls[4][0]).toBe('source-a');

    completions.get(2)?.();
    completions.get(4)?.();
    completions.get(5)?.();
    await updatePromise;

    expect(metadata).toMatchObject({
      isRunning: false,
      progress: 1,
      progressText: undefined,
    });
  });

  it('uses the category query when an update is category-scoped', async () => {
    mockedGetLibraryWithCategory.mockReturnValue([]);

    await updateLibrary({ categoryId: 4 }, jest.fn());

    expect(mockedGetLibraryWithCategory).toHaveBeenCalledWith(
      4,
      undefined,
      true,
    );
    expect(mockedGetLibraryNovels).not.toHaveBeenCalled();
  });
});
