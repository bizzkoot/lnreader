/**
 * Extracts readable paragraphs from HTML text for TTS playback.
 * This is used when WebView JavaScript is suspended (screen off).
 *
 * NOTE: This is a simplified parser. It won't perfectly match
 * the WebView DOM traversal, but it's good enough for TTS.
 */

// Tags that contain readable text (for reference)
// const READABLE_TAGS = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SPAN'];

// Tags that are block-level containers (for reference)
// const CONTAINER_TAGS = ['SECTION', 'ARTICLE', 'MAIN', 'HEADER', 'FOOTER', 'BODY', 'HTML'];

/**
 * Strip HTML tags and decode entities
 */
function stripHtml(html: string): string {
  // Remove script and style tags with their content
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = text
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

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Extract readable paragraphs from HTML content
 */
export function extractParagraphs(html: string): string[] {
  const paragraphs: string[] = [];

  // Simple regex-based extraction of paragraph-like content
  // Match content within P, DIV, H1-H6 tags
  const tagPattern =
    /<(p|div|h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;

  let match;
  while ((match = tagPattern.exec(html)) !== null) {
    const content = match[2];

    // Skip if this is a container with nested block elements
    if (/<(p|div|h[1-6])[^>]*>/i.test(content)) {
      continue;
    }

    const text = stripHtml(content);

    // Only include non-empty paragraphs
    if (text.length > 0) {
      paragraphs.push(text);
    }
  }

  // Fallback: If no paragraphs found with tags, split by line breaks
  if (paragraphs.length === 0) {
    const lines = html
      .split(/<br\s*\/?>/i)
      .map(line => stripHtml(line))
      .filter(line => line.length > 0);

    paragraphs.push(...lines);
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
): string[] {
  const allParagraphs = extractParagraphs(html);
  const endIndex = count
    ? Math.min(startIndex + count, allParagraphs.length)
    : allParagraphs.length;

  return allParagraphs.slice(startIndex, endIndex);
}

export default {
  extractParagraphs,
  extractParagraphsFrom,
  stripHtml,
};
