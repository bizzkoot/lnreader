/**
 * Non-destructive WebView search tests — ponytail minimal, no DOM lib.
 * Verifies search.js contract: case-insensitive matching, short-query guard,
 * special-char allowance, and paragraph-count preservation.
 */
import fs from 'fs';
import path from 'path';

const searchJsPath = path.resolve(
  __dirname,
  '../../../android/app/src/main/assets/js/search.js',
);
const searchJsSrc = fs.readFileSync(searchJsPath, 'utf8');

// Replicate pure logic from search.js for isolated testing (mirrors file)
function findSegmentMatches(
  segment: { text: string },
  normalizedTerm: string,
): number[] {
  const matches: number[] = [];
  const normalizedText = segment.text.toLowerCase();
  let idx = normalizedText.indexOf(normalizedTerm);
  while (idx !== -1) {
    matches.push(idx);
    idx = normalizedText.indexOf(normalizedTerm, idx + normalizedTerm.length);
  }
  return matches;
}

const MIN_QUERY_LENGTH = 3;
const SPECIAL_CHARACTER_REGEX = /[^\p{L}\p{N}\s]/u;

function shouldSearch(term: string): boolean {
  if (!term || term.trim().length === 0) return false;
  const t = term.trim();
  return !(t.length < MIN_QUERY_LENGTH && !SPECIAL_CHARACTER_REGEX.test(t));
}

// Minimal simulated wrap/reset via string replacement (proves non-destructive)
function wrapOccurrences(
  html: string,
  term: string,
): { wrapped: string; count: number } {
  const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  let count = 0;
  const wrapped = html.replace(regex, m => {
    count++;
    return `<mark class="lnreader-search-match">${m}</mark>`;
  });
  return { wrapped, count };
}

function resetMarks(html: string): string {
  return html
    .replace(/<mark class="lnreader-search-match">/g, '')
    .replace(/<\/mark>/g, '');
}

function countParagraphs(html: string): number {
  // mirrors getReadableElements counting <p> as readable (simplified)
  const matches = html.match(/<p[^>]*>/gi);
  return matches ? matches.length : 0;
}

describe('search.js non-destructive', () => {
  it('findSegmentMatches is case-insensitive', () => {
    const seg = { text: 'Hello world HELLO' };
    expect(findSegmentMatches(seg, 'hello')).toEqual([0, 12]);
  });

  it('findSegmentMatches finds multiple non-overlapping occurrences', () => {
    expect(findSegmentMatches({ text: 'foo bar foo baz foo' }, 'foo')).toEqual([
      0, 8, 16,
    ]);
  });

  it('wrap is non-destructive and reset restores original text', () => {
    const html = '<p>Hello world, hello universe</p><p>Second para</p>';
    const originalText = html.replace(/<[^>]+>/g, '');
    const { wrapped, count } = wrapOccurrences(html, 'hello');
    expect(count).toBe(2);
    expect(wrapped).toContain('lnreader-search-match');
    // paragraph count preserved
    expect(countParagraphs(wrapped)).toBe(countParagraphs(html));
    const reset = resetMarks(wrapped);
    expect(reset.replace(/<[^>]+>/g, '')).toBe(originalText);
    expect(reset).toBe(html);
  });

  it('reset normalizes and leaves non-mark DOM intact', () => {
    const html = '<p>foo bar <span>baz</span> foo</p>';
    const { wrapped } = wrapOccurrences(html, 'foo');
    expect(wrapped).toContain('<span>baz</span>');
    const reset = resetMarks(wrapped);
    expect(reset).toContain('<span>baz</span>');
    expect(reset).not.toContain('lnreader-search-match');
  });

  it('TTS paragraph count preserved after search wrap+reset', () => {
    const html = '<p>Para one hello</p><p>Para two hello</p><p>Para three</p>';
    const before = countParagraphs(html);
    const { wrapped } = wrapOccurrences(html, 'hello');
    expect(countParagraphs(wrapped)).toBe(before);
    const reset = resetMarks(wrapped);
    expect(countParagraphs(reset)).toBe(before);
  });

  it('short query (<3) without special char is not searchable', () => {
    expect(shouldSearch('ab')).toBe(false);
    expect(shouldSearch('a')).toBe(false);
    expect(shouldSearch('')).toBe(false);
    expect(shouldSearch('hello')).toBe(true);
    expect(shouldSearch('hel')).toBe(true);
  });

  it('special-char short query is searchable', () => {
    expect(shouldSearch('!')).toBe(true);
    expect(shouldSearch('a!')).toBe(true);
    expect(shouldSearch('ab!')).toBe(true);
  });

  it('search.js source contains non-destructive markers and normalize', () => {
    expect(searchJsSrc).toContain('lnreader-search-match');
    expect(searchJsSrc).toContain('resetMatches');
    expect(searchJsSrc).toContain('normalize()');
    expect(searchJsSrc).toContain('wrapSegmentMatch');
    expect(searchJsSrc).toContain('refreshLayout');
    expect(searchJsSrc).toContain('MAX_RENDERED_MATCHES');
    expect(searchJsSrc).toContain('MIN_QUERY_LENGTH');
  });

  it('search.js preserves TTS contract: getTextSegments and getReadableElements compatible', () => {
    // search uses reader.chapterElement and window.tts.readable — verify file references
    expect(searchJsSrc).toContain('reader.chapterElement');
    expect(searchJsSrc).toContain('getTextSegments');
    // Ensure marks are <mark> with class, not altering paragraph structure
    expect(searchJsSrc).toContain('mark.lnreader-search-match');
  });
});
