// Mock out RN-native and platform dependent imports used by queries
jest.mock('@utils/showToast', () => ({ showToast: jest.fn() }));
jest.mock('@strings/translations', () => ({ getString: jest.fn(() => 'str') }));
jest.mock('@specs/NativeFile', () => ({ unlink: jest.fn() }));
jest.mock('@utils/Storages', () => ({ NOVEL_STORAGE: '/tmp' }));
jest.mock('../../db', () => ({
  db: {
    runAsync: jest.fn(),
  },
}));

const { db } = require('../../db');
const { resetChaptersProgress } = require('../ChapterQueries');

describe('resetChaptersProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("'keep' does nothing", async () => {
    await resetChaptersProgress(1, 2, 4, 'keep');
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  test("'reset-all' resets progress and marks unread=1", async () => {
    await resetChaptersProgress(10, 3, 6, 'reset-all');
    expect(db.runAsync).toHaveBeenCalledTimes(1);
    const sql = db.runAsync.mock.calls[0][0];
    expect(sql).toMatch(/UPDATE Chapter SET progress = 0, unread = 1/);
    expect(db.runAsync.mock.calls[0].slice(1)).toEqual([10, 3, 6]);
  });

  test("'reset-unread' resets only unread chapters' progress", async () => {
    await resetChaptersProgress(5, 1, 3, 'reset-unread');
    expect(db.runAsync).toHaveBeenCalledTimes(1);
    const callSql = db.runAsync.mock.calls[0][0];
    expect(callSql).toMatch(/AND unread = 1/);
  });

  test('getMaxChapterPosition returns maxPos', async () => {
    db.getFirstAsync = jest.fn().mockResolvedValue({ maxPos: 42 });
    const { getMaxChapterPosition } = require('../ChapterQueries');
    const v = await getMaxChapterPosition(7);
    expect(db.getFirstAsync).toHaveBeenCalledWith('SELECT MAX(position) as maxPos FROM Chapter WHERE novelId = ?', 7);
    expect(v).toBe(42);
  });
});
