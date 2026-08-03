/**
 * Extracts readable paragraphs from HTML text for TTS playback.
 * This is used when WebView JavaScript is suspended (screen off).
 *
 * NOTE: Uses a "Flattening Strategy" to capture text across all nesting levels.
 * It replaces block tags with delimiters and strips inline tags, ensuring
 * no content is skipped due to complex nesting.
 */

// List of block tags that signify a paragraph break
const BLOCK_TAGS = [
  'address',
  'article',
  'aside',
  'blockquote',
  'canvas',
  'dd',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'noscript',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'tfoot',
  'ul',
  'video',
];

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
      String.fromCharCode(parseInt(code, 16)),
    );
}

/**
 * Extract readable paragraphs from HTML content
 */
export function extractParagraphs(
  html: string,
  chapterName?: string,
): string[] {
  if (!html) {
    return [];
  }

  // 1. Remove script and style tags completely
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // 2. Insert delimiters at block boundaries
  // We use a pipe delimiter that is unlikely to be in text
  const DELIMITER = '|||';

  // Replace <br> with delimiter
  text = text.replace(/<br\s*\/?>/gi, `\n${DELIMITER}\n`);

  // Replace block tags with delimiter
  // Matches <tag> or </tag> or <tag attr="...">
  const blockPattern = new RegExp(
    `</?(${BLOCK_TAGS.join('|')})(\\s[^>]*)?>`,
    'gi',
  );
  text = text.replace(blockPattern, `\n${DELIMITER}\n`);

  // 3. Remove all remaining tags (inline tags like span, b, i, a)
  // Replace with space to prevent concatenating words
  text = text.replace(/<[^>]+>/g, ' ');

  // 4. Decode HTML entities
  text = decodeHtmlEntities(text);

  // 5. Split, trim, and filter
  const paragraphs = text
    .split(DELIMITER)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line.length > 0);

  // 6. Enhance chapter title to match WebView core.js logic
  if (chapterName && paragraphs.length > 0) {
    let hasVisibleTitle = false;
    const firstFew = paragraphs.slice(0, 5);

    for (const pText of firstFew) {
      const lowerText = pText.toLowerCase();
      const lowerName = chapterName.toLowerCase();

      const matchName = lowerText.includes(lowerName);
      const matchChapter = lowerText.includes('chapter');
      const matchChap = lowerText.includes('chap');
      const matchPattern1 = /^(ch\.?\s*\d+|chapter\s+\d+|\d+\.?\s*[-–—])/i.test(
        pText,
      );
      const matchPattern2 = /^\d+\.\s/.test(pText);
      const matchPattern3 = /^\d+\s/.test(pText);

      const looksLikeTitle =
        matchName ||
        matchChapter ||
        matchChap ||
        matchPattern1 ||
        matchPattern2 ||
        matchPattern3;

      if (looksLikeTitle) {
        hasVisibleTitle = true;
        break;
      }
    }

    if (!hasVisibleTitle) {
      paragraphs.unshift(chapterName);
    }
  }

  return paragraphs;
}

/**
 * Extract paragraphs starting from a specific index
 * Useful for continuing TTS from a certain point
 */
export function extractParagraphsFrom(
  html: string,
  startIndex: number,
  count?: number,
  chapterName?: string,
): string[] {
  const allParagraphs = extractParagraphs(html, chapterName);
  const endIndex = count
    ? Math.min(startIndex + count, allParagraphs.length)
    : allParagraphs.length;

  if (startIndex >= allParagraphs.length) {
    return [];
  }

  return allParagraphs.slice(startIndex, endIndex);
}

// =============================================================================
// TTS Text Cleanup
//
// Declarative, length-preserving text cleanup applied to every paragraph that
// reaches the native TTS engine, across ALL playback modes and paths:
//   1. Initial queue (all modes)  - RN extractParagraphs() output
//   2. Foreground refill (Path B) - WebView DOM tts-queue payloads
//   3. Fallback single-speak      - WebView 'speak' payloads
//
// Design constraints (see PR for issue #17):
//   - No arbitrary user JS evaluation in the RN/Hermes layer (no eval/Function).
//   - Length-preserving: never drops or merges array entries, so the
//     RN <-> WebView paragraph index contract stays intact.
//   - No hardcoded site-specific regexes; everything is user-configurable.
// =============================================================================

/**
 * A single find/replace cleanup rule.
 * Can be a literal string replacement or a regex (pattern + flags).
 */
export interface TtsCleanupRule {
  id: string;
  enabled: boolean;
  /** Find pattern: literal text or regex source (when isRegex is true). */
  pattern: string;
  /** True when pattern should be compiled as a RegExp. */
  isRegex: boolean;
  /** RegExp flags (e.g. 'g', 'gi'). Ignored for literal rules. Defaults to 'g'. */
  flags: string;
  /** Replacement text (empty string strips matched spans). */
  replacement: string;
}

/**
 * Phonetic pronunciation swap: exact whole-word replacements performed after
 * rules so engines stop mispronouncing LN-specific names/honorifics
 * (e.g. 'Xianxia' -> 'Shee-an-shah').
 */
export interface TtsPhoneticPair {
  id: string;
  enabled: boolean;
  /** Word to look for (exact, whole-word, case-sensitive match). */
  word: string;
  /** What the TTS engine should say instead. */
  pronunciation: string;
  /**
   * Optional; defaults to 'whole-word'. 'substring' replaces every
   * occurrence, which is needed for unspaced CJK text where whole-word
   * boundaries never fire between adjacent CJK characters.
   */
  matchMode?: 'whole-word' | 'substring';
}

/** Full user-configurable TTS text cleanup settings. */
export interface TtsTextCleanupSettings {
  /** Master switch: apply cleanup to TTS text. */
  enabled: boolean;
  /** NFD-normalize and strip combining marks before other rules. */
  normalizeUnicode: boolean;
  /** Ordered find/replace + strip rules. */
  rules: TtsCleanupRule[];
  /** Ordered phonetic pronunciation swaps. */
  phoneticPairs: TtsPhoneticPair[];
}

export const DEFAULT_TTS_CLEANUP_SETTINGS: TtsTextCleanupSettings = {
  enabled: false,
  normalizeUnicode: false,
  rules: [],
  phoneticPairs: [],
};

/**
 * Maximum length for a user-authored regex pattern. Bounds both the compile
 * and per-paragraph scan cost. Real-world watermark/pronunciation patterns
 * are far shorter (the issue thread's longest is < 80 chars).
 */
export const TTS_CLEANUP_MAX_REGEX_LENGTH = 200;

const VALID_REGEX_FLAGS = ['d', 'g', 'i', 'm', 's', 'u', 'v', 'y'];

// Narrow catastrophic-backtracking heuristics (defense-in-depth on top of the
// length cap + compile-time try/catch). Kept intentionally narrow so common
// safe patterns like `(?:[.-][a-z0-9_]+)*` or the issue's `(?:\\W)*` watermark
// fragments are never rejected. Validated empirically against the existing
// test corpus (see src/utils/__tests__/ttsTextCleanup.test.ts).
const NESTED_SIMPLE_QUANT = /\((?:(?:\?:)?[^()[\]*+?{}][*+?])\)[*+?]/;
const NESTED_SIMPLE_BOUNDED =
  /\((?:(?:\?:)?[^()[\]*+?{}][*+?])\)\{[2-9]\d*(?:,\d*)?\}/;
const IDENTICAL_ALT_QUANT = /\((?:(?:\?:)?([^()[\]*+?{}])\|(\1))\)[*+?]/;

/**
 * True when a regex source matches known exponential-backtracking shapes
 * (e.g. `(a+)+`, `(?:a*)*`, `(?:a+){2,}`, `(a|a)+`). Best-effort structural
 * detection: false negatives are acceptable (length cap + try/catch remain),
 * false positives are not (a rejected rule silently stops cleaning).
 */
export function isPotentiallyCatastrophic(pattern: string): boolean {
  return (
    NESTED_SIMPLE_QUANT.test(pattern) ||
    NESTED_SIMPLE_BOUNDED.test(pattern) ||
    IDENTICAL_ALT_QUANT.test(pattern)
  );
}

/**
 * Normalize user-supplied regex flags: keep only valid flags, dedupe,
 * always include `g` (cleanup is a global find/replace), and drop `y`
 * (sticky without a global scan silently no-ops on mid-string matches).
 */
export function normalizeRegExpFlags(flags: string | undefined | null): string {
  const seen = new Set<string>();
  for (const ch of flags ?? '') {
    if (VALID_REGEX_FLAGS.includes(ch)) {
      seen.add(ch);
    }
  }
  seen.delete('y');
  seen.add('g');
  return [...seen].join('');
}

let ttsCleanupIdCounter = 0;

function nextCleanupId(prefix: string): string {
  ttsCleanupIdCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${ttsCleanupIdCounter}`;
}

/** Factory helper for the settings UI. */
export function createTtsCleanupRule(
  pattern: string,
  replacement = '',
  isRegex = false,
  flags = 'g',
  enabled = true,
): TtsCleanupRule {
  return {
    id: nextCleanupId('tts-rule'),
    enabled,
    pattern,
    isRegex,
    flags,
    replacement,
  };
}

/** Factory helper for the settings UI. */
export function createTtsPhoneticPair(
  word: string,
  pronunciation = '',
  enabled = true,
  matchMode: 'whole-word' | 'substring' = 'whole-word',
): TtsPhoneticPair {
  return {
    id: nextCleanupId('tts-phonetic'),
    enabled,
    word,
    pronunciation,
    matchMode,
  };
}

/** Escape regex special characters for literal matching. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** NFD-normalize and strip combining marks (e.g. 'e\u0301' -> 'e'). */
const COMBINING_MARKS_REGEX = /[\u0300-\u036f]/g;

export function normalizeUnicodeText(text: string): string {
  return text.normalize('NFD').replace(COMBINING_MARKS_REGEX, '');
}

/**
 * Apply a single cleanup rule; invalid or unsafe regexes are skipped silently.
 * `normalizePattern` NFD-normalizes LITERAL patterns so they match text that
 * was already normalized when `normalizeUnicode` is enabled (regex patterns
 * are matched verbatim against already-normalized text by design).
 */
function applyCleanupRule(
  text: string,
  rule: TtsCleanupRule,
  normalizePattern: boolean,
): string {
  if (!rule.pattern) {
    return text;
  }
  if (rule.isRegex) {
    if (
      rule.pattern.length > TTS_CLEANUP_MAX_REGEX_LENGTH ||
      isPotentiallyCatastrophic(rule.pattern)
    ) {
      return text;
    }
    try {
      const flags = normalizeRegExpFlags(rule.flags);
      // Callback form keeps the replacement LITERAL: with a string
      // replacement, `$&`, `$'`, `$``, `$$` and `$n` are interpolated.
      return text.replace(
        new RegExp(rule.pattern, flags),
        () => rule.replacement,
      );
    } catch {
      // Invalid regex source: leave text untouched rather than crashing TTS.
      return text;
    }
  }
  const pattern = normalizePattern
    ? normalizeUnicodeText(rule.pattern)
    : rule.pattern;
  if (!pattern) {
    return text;
  }
  // Literal find/replace of all occurrences (fully literal — no `$` semantics).
  return text.split(pattern).join(rule.replacement);
}

// Compiled whole-word regexes keyed by word (per-paragraph reuse across a
// 2000-paragraph queue build). Bounded: cleared once it exceeds 500 entries.
const wholeWordRegexCache = new Map<string, RegExp>();
const WHOLE_WORD_CACHE_LIMIT = 500;

function getWholeWordRegex(word: string): RegExp | null {
  const cached = wholeWordRegexCache.get(word);
  if (cached) {
    return cached;
  }
  try {
    const escaped = escapeRegExp(word);
    const regex = new RegExp(
      `(^|[^\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`,
      'gu',
    );
    if (wholeWordRegexCache.size >= WHOLE_WORD_CACHE_LIMIT) {
      wholeWordRegexCache.clear();
    }
    wholeWordRegexCache.set(word, regex);
    return regex;
  } catch {
    // Unicode property escapes unsupported on some runtime: degrade gracefully.
    return null;
  }
}

/**
 * Replace an exact whole word (case-sensitive) without touching
 * larger words that merely contain it. Unicode-aware boundaries so
 * non-ASCII names match correctly. Returns text unchanged when the
 * regex cannot be compiled.
 */
function replaceWholeWord(
  text: string,
  word: string,
  replacement: string,
): string {
  if (!word) {
    return text;
  }
  const regex = getWholeWordRegex(word);
  if (!regex) {
    return text;
  }
  regex.lastIndex = 0; // global regexes carry lastIndex between calls
  return text.replace(regex, (_match: string, prefix: string) => {
    return `${prefix}${replacement}`;
  });
}

/**
 * Clean a single text string using the configured cleanup settings.
 * Returns the input unchanged when cleanup is disabled/empty.
 *
 * Pipeline order:
 *   1. Unicode normalization (NFD + strip combining marks)
 *   2. Ordered find/replace + strip rules
 *   3. Phonetic dictionary (whole-word swaps)
 */
export function cleanTtsText(
  text: string,
  settings?: TtsTextCleanupSettings | null,
): string {
  if (typeof text !== 'string' || !text || !settings?.enabled) {
    return text;
  }

  let result = text;

  if (settings.normalizeUnicode) {
    result = normalizeUnicodeText(result);
  }

  for (const rule of settings.rules ?? []) {
    if (!rule.enabled) {
      continue;
    }
    result = applyCleanupRule(result, rule, settings.normalizeUnicode);
  }

  for (const pair of settings.phoneticPairs ?? []) {
    if (!pair.enabled || !pair.word) {
      continue;
    }
    result =
      pair.matchMode === 'substring'
        ? result.split(pair.word).join(pair.pronunciation)
        : replaceWholeWord(result, pair.word, pair.pronunciation);
  }

  return result;
}

/**
 * Apply cleanup to a list of paragraphs. LENGTH-PRESERVING: the returned
 * array always has the same length as the input (paragraph count drives the
 * RN <-> WebView index contract and must never change).
 */
export function applyTtsTextCleanup(
  paragraphs: string[],
  settings?: TtsTextCleanupSettings | null,
): string[];
export function applyTtsTextCleanup(
  paragraphs: string[] | undefined | null,
  settings?: TtsTextCleanupSettings | null,
): string[] | undefined | null;
export function applyTtsTextCleanup(
  paragraphs: string[] | undefined | null,
  settings?: TtsTextCleanupSettings | null,
): string[] | undefined | null {
  if (
    !settings?.enabled ||
    !Array.isArray(paragraphs) ||
    paragraphs.length === 0
  ) {
    return paragraphs;
  }

  const hasWork =
    settings.normalizeUnicode ||
    (settings.rules?.some(rule => rule.enabled) ?? false) ||
    (settings.phoneticPairs?.some(pair => pair.enabled) ?? false);

  if (!hasWork) {
    return paragraphs;
  }

  return paragraphs.map(paragraph => cleanTtsText(paragraph, settings));
}
