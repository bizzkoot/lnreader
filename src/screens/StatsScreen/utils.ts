import Color from 'color';

export const formatTimeSpent = (ms: number): string => {
  if (!Number.isFinite(ms) || ms <= 0) return '0m';
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(' ');
};

export const formatTotalTimeParts = (
  ms: number,
): { days: number; hours: number; minutes: number; seconds: number } => {
  if (!Number.isFinite(ms) || ms <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const totalSeconds = Math.floor(ms / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
};

export const getDonutPalette = (
  keys: string[],
  theme: { primary: string },
): Record<string, string> => {
  const base = Color(theme.primary);
  const palette: Record<string, string> = {};
  if (!keys.length) return palette;
  keys.forEach((k, i) => {
    const hueShift = (i * 47) % 360;
    const rotated = base.rotate(hueShift);
    const lightAdjust = i % 2 === 0 ? 0 : 0.12;
    const c = lightAdjust
      ? rotated.lighten(lightAdjust).saturate(0.08)
      : rotated;
    palette[k] = c.hex();
  });
  return palette;
};

// Genre taxonomy helpers
// Unicode-aware: preserves CJK, Cyrillic, accented letters via \p{L}\p{N}
export const normalizeGenre = (genre: string): string => {
  const trimmed = genre.trim();
  if (!trimmed) return '';
  let lower: string;
  try {
    lower = trimmed.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  } catch {
    // Fallback for engines without Unicode property escapes
    lower = trimmed.toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
  }
  if (!lower) return '';
  // Uppercase first codepoint (handles single-char CJK correctly as no-op)
  const first = lower.charAt(0).toLocaleUpperCase();
  return first + lower.slice(1);
};

export interface TaxonomyNode {
  name: string;
  children?: string[];
}

export interface GenreTreeNode {
  genre: string;
  displayName: string;
  count: number;
  novelIds: Set<number>;
  children?: GenreTreeNode[];
}

export const buildGenreTree = (
  novels: Array<{ id: number; genres?: string | null }>,
  taxonomy: TaxonomyNode[] = [],
): GenreTreeNode[] => {
  const genreMap = new Map<string, Set<number>>();
  const displayNameMap = new Map<string, string>();

  novels.forEach(novel => {
    if (!novel.genres) return;
    const parts = novel.genres.split(/\s*,\s*/);
    parts.forEach(raw => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      const normalized = normalizeGenre(trimmed);
      if (!normalized) return;
      if (!genreMap.has(normalized)) genreMap.set(normalized, new Set());
      genreMap.get(normalized)!.add(novel.id);
      if (!displayNameMap.has(normalized)) {
        displayNameMap.set(normalized, trimmed);
      }
    });
  });

  const used = new Set<string>();
  const result: GenreTreeNode[] = [];

  taxonomy.forEach(node => {
    const parentNorm = normalizeGenre(node.name);
    if (!parentNorm) return;
    const childNorms = (node.children ?? [])
      .map(c => normalizeGenre(c))
      .filter(Boolean) as string[];
    const union = new Set<number>();
    const parentIds = genreMap.get(parentNorm);
    if (parentIds) parentIds.forEach(id => union.add(id));
    childNorms.forEach(cn => {
      const s = genreMap.get(cn);
      if (s) s.forEach(id => union.add(id));
    });
    if (union.size === 0) return;
    [parentNorm, ...childNorms].forEach(k => used.add(k));
    const children: GenreTreeNode[] = [];
    childNorms.forEach(cn => {
      const s = genreMap.get(cn);
      if (!s || s.size === 0) return;
      children.push({
        genre: cn,
        displayName: displayNameMap.get(cn) ?? cn,
        count: s.size,
        novelIds: new Set(s),
      });
    });
    children.sort((a, b) => b.count - a.count);
    result.push({
      genre: parentNorm,
      displayName: node.name,
      count: union.size,
      novelIds: union,
      children: children.length ? children : undefined,
    });
  });

  genreMap.forEach((ids, norm) => {
    if (used.has(norm)) return;
    result.push({
      genre: norm,
      displayName: displayNameMap.get(norm) ?? norm,
      count: ids.size,
      novelIds: new Set(ids),
    });
  });

  result.sort((a, b) => b.count - a.count);
  return result;
};
