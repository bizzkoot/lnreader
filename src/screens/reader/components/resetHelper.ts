import { getMaxChapterPosition } from '@database/queries/ChapterQueries';

export async function computeToPosition(currentPosition: number, savedPosition: number, resetMode: 'reset-all'|'reset-unread'|'keep', novelId: number) {
  if (resetMode === 'reset-all') {
    try {
      const maxPos = await getMaxChapterPosition(novelId);
      return Math.max(savedPosition, maxPos);
    } catch (e) {
      // fallback to savedPosition if DB helper fails
      return savedPosition;
    }
  }
  return savedPosition;
}
