import { parseGenres } from '../genres';

describe('parseGenres', () => {
  it('splits comma separated genres and trims whitespace', () => {
    expect(parseGenres('Action, Fantasy,  Romance ')).toEqual([
      'Action',
      'Fantasy',
      'Romance',
    ]);
  });

  it('filters empty entries', () => {
    expect(parseGenres('Action,,,Drama')).toEqual(['Action', 'Drama']);
  });

  it('returns an empty array for null/undefined', () => {
    expect(parseGenres(null)).toEqual([]);
    expect(parseGenres(undefined)).toEqual([]);
  });

  it('returns an empty array for non-string values', () => {
    expect(parseGenres(42)).toEqual([]);
  });

  it('returns an empty array for empty string', () => {
    expect(parseGenres('')).toEqual([]);
  });
});
