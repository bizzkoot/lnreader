import { transformThemeId } from '../useTheme';
import { DYNAMIC_THEME_ID } from '@theme/dynamic';

/**
 * Pins the legacy theme-ID migration map (1-21 -> 100-108) exactly as
 * implemented in `transformThemeId`. Any change to the mapping that is not
 * accompanied by a migration for persisted values will break these tests.
 */

// Exact maps from the implementation (do not guess — keep in sync with useTheme.ts).
const LIGHT_ID_MAP: Record<number, number> = {
  1: 100,
  8: 102,
  9: 108,
  10: 101,
  12: 103,
  14: 104,
  16: 105,
  18: 106,
  20: 107,
};

const DARK_ID_MAP: Record<number, number> = {
  2: 100,
  9: 102,
  10: 108,
  11: 101,
  13: 103,
  15: 104,
  17: 105,
  19: 106,
  21: 107,
};

describe('transformThemeId (legacy theme-ID migration map)', () => {
  test.each(Array.from({ length: 21 }, (_, i) => i + 1))(
    'legacy id %i -> light target',
    id => {
      expect(transformThemeId(id, false)).toBe(LIGHT_ID_MAP[id] ?? id);
    },
  );

  test.each(Array.from({ length: 21 }, (_, i) => i + 1))(
    'legacy id %i -> dark target',
    id => {
      expect(transformThemeId(id, true)).toBe(DARK_ID_MAP[id] ?? id);
    },
  );

  test.each([
    [1, 100],
    [8, 102],
    [9, 108],
    [10, 101],
    [12, 103],
    [14, 104],
    [16, 105],
    [18, 106],
    [20, 107],
  ])('light mapping %i -> %i (explicit)', (id, expected) => {
    expect(transformThemeId(id, false)).toBe(expected);
  });

  test.each([
    [2, 100],
    [9, 102],
    [10, 108],
    [11, 101],
    [13, 103],
    [15, 104],
    [17, 105],
    [19, 106],
    [21, 107],
  ])('dark mapping %i -> %i (explicit)', (id, expected) => {
    expect(transformThemeId(id, true)).toBe(expected);
  });

  test('modern ids (>= 100) pass through unchanged in both modes', () => {
    for (const id of [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 150]) {
      expect(transformThemeId(id, false)).toBe(id);
      expect(transformThemeId(id, true)).toBe(id);
    }
  });

  test('legacy ids not in the map pass through unchanged', () => {
    // Light mode: every legacy id except 1,8,9,10,12,14,16,18,20
    for (const id of [2, 3, 4, 5, 6, 7, 11, 13, 15, 17, 19, 21]) {
      expect(transformThemeId(id, false)).toBe(id);
    }
    // Dark mode: every legacy id except 2,9,10,11,13,15,17,19,21
    for (const id of [1, 3, 4, 5, 6, 7, 8, 12, 14, 16, 18, 20]) {
      expect(transformThemeId(id, true)).toBe(id);
    }
  });

  test('id 99 passes through unchanged (not > 99, not in map)', () => {
    expect(transformThemeId(99, false)).toBe(99);
    expect(transformThemeId(99, true)).toBe(99);
  });

  test('DYNAMIC_THEME_ID and other special/negative ids pass through unchanged', () => {
    expect(transformThemeId(DYNAMIC_THEME_ID, false)).toBe(DYNAMIC_THEME_ID);
    expect(transformThemeId(DYNAMIC_THEME_ID, true)).toBe(DYNAMIC_THEME_ID);
    expect(transformThemeId(0, false)).toBe(0);
    expect(transformThemeId(-5, true)).toBe(-5);
  });
});
