import {
  buildGenreTree,
  formatTimeSpent,
  formatTotalTimeParts,
  getDonutPalette,
  normalizeGenre,
} from '../utils';

describe('stats utils', () => {
  describe('formatTimeSpent', () => {
    it('formats 0 and negative', () => {
      expect(formatTimeSpent(0)).toBe('0m');
      expect(formatTimeSpent(-100)).toBe('0m');
    });
    it('formats <1m', () => {
      expect(formatTimeSpent(30000)).toBe('<1m');
    });
    it('formats minutes', () => {
      expect(formatTimeSpent(90_000)).toBe('1m');
      expect(formatTimeSpent(5 * 60000)).toBe('5m');
    });
    it('formats hours and days', () => {
      expect(formatTimeSpent(90 * 60000)).toBe('1h 30m');
      expect(formatTimeSpent(1440 * 60000)).toBe('1d');
      expect(formatTimeSpent(1500 * 60000)).toBe('1d 1h');
      expect(formatTimeSpent((1440 + 90) * 60000)).toBe('1d 1h 30m');
    });
    it('handles NaN', () => {
      expect(formatTimeSpent(NaN)).toBe('0m');
    });
  });

  describe('formatTotalTimeParts', () => {
    it('splits days/hours/minutes', () => {
      expect(formatTotalTimeParts(0)).toEqual({
        days: 0,
        hours: 0,
        minutes: 0,
      });
      expect(formatTotalTimeParts(90 * 60000)).toEqual({
        days: 0,
        hours: 1,
        minutes: 30,
      });
      expect(formatTotalTimeParts(1500 * 60000)).toEqual({
        days: 1,
        hours: 1,
        minutes: 0,
      });
    });
  });

  describe('getDonutPalette', () => {
    it('returns deterministic hex per key', () => {
      const p1 = getDonutPalette(['a', 'b'], { primary: '#6750A4' });
      const p2 = getDonutPalette(['a', 'b'], { primary: '#6750A4' });
      expect(p1).toEqual(p2);
      expect(p1.a).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(p1.b).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(p1.a).not.toBe(p1.b);
    });
    it('returns empty for no keys', () => {
      expect(getDonutPalette([], { primary: '#000' })).toEqual({});
    });
  });

  describe('normalizeGenre', () => {
    it('capitalizes stripped form', () => {
      expect(normalizeGenre(' Fantasy ')).toBe('Fantasy');
      expect(normalizeGenre('sci-fi')).toBe('Scifi');
      expect(normalizeGenre('High Fantasy')).toBe('Highfantasy');
    });
    it('handles empty and symbols', () => {
      expect(normalizeGenre('')).toBe('');
      expect(normalizeGenre('  ')).toBe('');
      expect(normalizeGenre('---')).toBe('');
    });
  });

  describe('buildGenreTree', () => {
    it('groups flat genres by count desc', () => {
      const novels = [
        { id: 1, genres: 'Action, Fantasy' },
        { id: 2, genres: 'Action' },
        { id: 3, genres: 'Fantasy, Romance' },
      ];
      const tree = buildGenreTree(novels);
      expect(tree[0].genre).toBe('Action');
      expect(tree[0].count).toBe(2);
      expect(tree[1].count).toBe(2);
    });

    it('unions taxonomy parent + children', () => {
      const novels = [
        { id: 1, genres: 'High Fantasy' },
        { id: 2, genres: 'Urban Fantasy' },
        { id: 3, genres: 'Fantasy' },
      ];
      const tree = buildGenreTree(novels, [
        { name: 'Fantasy', children: ['High Fantasy', 'Urban Fantasy'] },
      ]);
      const fantasy = tree.find(n => n.displayName === 'Fantasy')!;
      expect(fantasy.count).toBe(3);
      expect(fantasy.children).toBeDefined();
      expect(fantasy.children!.length).toBe(2);
    });

    it('handles null genres', () => {
      const tree = buildGenreTree([{ id: 1, genres: null }]);
      expect(tree).toEqual([]);
    });

    it('deduplicates normalized forms (sci-fi vs Sci Fi)', () => {
      const novels = [
        { id: 1, genres: 'sci-fi' },
        { id: 2, genres: 'Sci Fi' },
      ];
      const tree = buildGenreTree(novels);
      expect(tree).toHaveLength(1);
      expect(tree[0].count).toBe(2);
    });
  });
});
