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
