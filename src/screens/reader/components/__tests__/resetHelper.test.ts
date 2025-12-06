jest.mock('@database/queries/ChapterQueries', () => ({
  getMaxChapterPosition: jest.fn(),
}));

import { computeToPosition } from '../resetHelper';
import * as chapterQueries from '@database/queries/ChapterQueries';

describe('resetHelper.computeToPosition', () => {
  test('uses max position when reset-all', async () => {
    jest.spyOn(chapterQueries, 'getMaxChapterPosition').mockResolvedValue(99 as any);
    const to = await computeToPosition(2, 10, 'reset-all', 1);
    expect(to).toBe(99);
  });

  test('falls back when getMaxChapterPosition rejects', async () => {
    jest.spyOn(chapterQueries, 'getMaxChapterPosition').mockRejectedValue(new Error('boom'));
    const to = await computeToPosition(2, 10, 'reset-all', 1);
    expect(to).toBe(10);
  });

  test('returns savedPosition when mode not reset-all', async () => {
    const to = await computeToPosition(2, 10, 'reset-unread', 1);
    expect(to).toBe(10);
  });
});
