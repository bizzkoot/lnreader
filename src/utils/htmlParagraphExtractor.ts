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
): TtsPhoneticPair {
  return {
    id: nextCleanupId('tts-phonetic'),
    enabled,
    word,
    pronunciation,
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

/** Apply a single cleanup rule; invalid regexes are skipped silently. */
function applyCleanupRule(text: string, rule: TtsCleanupRule): string {
  if (!rule.pattern) {
    return text;
  }
  if (rule.isRegex) {
    try {
      const flags = rule.flags && rule.flags.length > 0 ? rule.flags : 'g';
      return text.replace(new RegExp(rule.pattern, flags), rule.replacement);
    } catch {
      // Invalid regex source: leave text untouched rather than crashing TTS.
      return text;
    }
  }
  // Literal find/replace of all occurrences.
  return text.split(rule.pattern).join(rule.replacement);
}

/**
 * Replace an exact whole word (case-sensitive) without touching
 * larger words that merely contain it. Unicode-aware boundaries so
 * non-ASCII names (e.g. Chinese honorifics) match correctly.
 */
function replaceWholeWord(
  text: string,
  word: string,
  replacement: string,
): string {
  if (!word) {
    return text;
  }
  const escaped = escapeRegExp(word);
  const regex = new RegExp(
    `(^|[^\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`,
    'gu',
  );
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
  if (!text || !settings?.enabled) {
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
    result = applyCleanupRule(result, rule);
  }

  for (const pair of settings.phoneticPairs ?? []) {
    if (!pair.enabled || !pair.word) {
      continue;
    }
    result = replaceWholeWord(result, pair.word, pair.pronunciation);
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
