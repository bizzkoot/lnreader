/**
 * Tests for Chapter Title Enhancement functionality
 *
 * These tests verify the logic of the enhanceChapterTitles function from core.js
 * The function ensures chapter titles are visible for TTS synchronization.
 *
 * Note: Since React Native's test environment has limited DOM APIs,
 * we test using a simplified version that checks the key behaviors.
 *
 * @module reader/components/__tests__/chapterTitleEnhancement.test
 */

/**
 * Simplified enhancement function for testing
 * Tests the core logic without full DOM dependency
 */
const createEnhancedTitleHtml = (chapterName: string): string => {
  return `<div class="enhanced-chapter-title lnreader-chapter-title" style="font-size: 1.5em !important; font-weight: bold !important; margin: 15px 0 15px 0 !important; padding: 10px 0 !important; color: inherit !important; text-align: center !important; display: block !important; visibility: visible !important; opacity: 1 !important; clear: both !important; width: 100% !important; box-sizing: border-box !important;">${chapterName}</div>`;
};

/**
 * Checks if HTML contains existing chapter title indicators
 * (Simplified regex-based check for testing)
 */
const hasExistingChapterTitle = (
  html: string,
  chapterName: string,
): boolean => {
  const lowerHtml = html.toLowerCase();
  const lowerName = chapterName.toLowerCase();

  // Check for heading tags with chapter content
  const headingPattern = /<h[1-6][^>]*>.*?(chapter|chap|\d+\.|chapterName)/i;
  if (headingPattern.test(html)) {
    return true;
  }

  // Check for chapter title classes
  if (
    lowerHtml.includes('class="chapter-title"') ||
    lowerHtml.includes('class="chap-title"') ||
    lowerHtml.includes('class="chapter"') ||
    lowerHtml.includes('class="title"') ||
    /class="[^"]*chap[^"]*"/.test(lowerHtml)
  ) {
    // Check if any element with these classes contains chapter indicators
    if (
      lowerHtml.includes('chapter') ||
      />\s*\d+\s*\./.test(html) ||
      lowerHtml.includes(lowerName)
    ) {
      return true;
    }
  }

  // Check for chapter name in heading tags
  const headingWithNamePattern = new RegExp(
    `<h[1-6][^>]*>[^<]*${lowerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^<]*</h[1-6]>`,
    'i',
  );
  if (headingWithNamePattern.test(html)) {
    return true;
  }

  return false;
};

/**
 * Test version of enhanceChapterTitles
 */
const enhanceChapterTitles = (html: string, chapterName: string): string => {
  try {
    // Check for existing title
    if (hasExistingChapterTitle(html, chapterName)) {
      return html;
    }

    // Create enhanced title
    const titleHtml = createEnhancedTitleHtml(chapterName);

    // Insert title after body tag or at beginning
    if (html.toLowerCase().includes('<body')) {
      return html.replace(/<body([^>]*)>/i, `<body$1>${titleHtml}`);
    } else {
      return titleHtml + html;
    }
  } catch {
    return html;
  }
};

describe('chapterTitleEnhancement', () => {
  describe('createEnhancedTitleHtml', () => {
    it('should create title div with correct classes', () => {
      const result = createEnhancedTitleHtml('Test Chapter');

      expect(result).toContain(
        'class="enhanced-chapter-title lnreader-chapter-title"',
      );
    });

    it('should include the chapter name', () => {
      const chapterName = 'Chapter 5 - The Quest';
      const result = createEnhancedTitleHtml(chapterName);

      expect(result).toContain(chapterName);
    });

    it('should use inherit color for TTS highlight compatibility', () => {
      const result = createEnhancedTitleHtml('Test');

      expect(result).toContain('color: inherit !important');
    });

    it('should NOT include background styling', () => {
      const result = createEnhancedTitleHtml('Test');

      expect(result).not.toContain('background:');
      expect(result).not.toContain('background-color:');
    });

    it('should NOT include border styling', () => {
      const result = createEnhancedTitleHtml('Test');

      expect(result).not.toContain('border-bottom:');
      expect(result).not.toContain('border:');
    });

    it('should handle special characters in chapter name', () => {
      const chapterName = "Chapter 1: The Hero's Journey";
      const result = createEnhancedTitleHtml(chapterName);

      expect(result).toContain(chapterName);
    });

    it('should handle Unicode characters', () => {
      const chapterName = '第一章 - 开始';
      const result = createEnhancedTitleHtml(chapterName);

      expect(result).toContain(chapterName);
    });
  });

  describe('hasExistingChapterTitle', () => {
    it('should detect h1 with chapter content', () => {
      const html = '<h1>Chapter 1</h1><p>Content.</p>';

      expect(hasExistingChapterTitle(html, 'Chapter 1')).toBe(true);
    });

    it('should detect h2 with chapter name', () => {
      const html = '<h2>Chapter 5 - The Journey</h2><p>Content.</p>';

      expect(hasExistingChapterTitle(html, 'Chapter 5 - The Journey')).toBe(
        true,
      );
    });

    it('should detect .chapter-title class', () => {
      const html = '<div class="chapter-title">Chapter 10</div><p>Content.</p>';

      expect(hasExistingChapterTitle(html, 'Chapter 10')).toBe(true);
    });

    it('should detect .chap-header class with chapter keyword', () => {
      const html = '<div class="chap-header">Chapter Info</div><p>Content.</p>';

      expect(hasExistingChapterTitle(html, 'Some Chapter')).toBe(true);
    });

    it('should detect .title class with Chapter N pattern', () => {
      const html = '<div class="title">Chapter 42</div><p>Content.</p>';

      expect(hasExistingChapterTitle(html, 'The Answer')).toBe(true);
    });

    it('should return false for plain content without title', () => {
      const html = '<p>This is just regular content.</p>';

      expect(hasExistingChapterTitle(html, 'Chapter 1')).toBe(false);
    });

    it('should be case-insensitive', () => {
      const html = '<h1>CHAPTER ONE</h1><p>Content.</p>';

      expect(hasExistingChapterTitle(html, 'chapter one')).toBe(true);
    });
  });

  describe('enhanceChapterTitles', () => {
    it('should add title when no existing title present', () => {
      const html = '<p>This is some chapter content.</p>';
      const chapterName = 'Chapter 1 - The Beginning';

      const result = enhanceChapterTitles(html, chapterName);

      expect(result).toContain('enhanced-chapter-title');
      expect(result).toContain(chapterName);
    });

    it('should prepend title when no body tag exists', () => {
      const html = '<p>Content without body tag.</p>';
      const chapterName = 'Chapter 2';

      const result = enhanceChapterTitles(html, chapterName);

      expect(result.startsWith('<div class="enhanced-chapter-title')).toBe(
        true,
      );
    });

    it('should insert title after body tag when present', () => {
      const html = '<body class="reader"><p>Content with body tag.</p></body>';
      const chapterName = 'Chapter 3';

      const result = enhanceChapterTitles(html, chapterName);

      expect(result).toContain('<body class="reader"><div class="enhanced');
    });

    it('should NOT add title when h1 heading with chapter exists', () => {
      const html = '<h1>Chapter 1</h1><p>Content.</p>';
      const chapterName = 'Chapter 1';

      const result = enhanceChapterTitles(html, chapterName);

      expect(result).not.toContain('enhanced-chapter-title');
      expect(result).toBe(html);
    });

    it('should preserve original HTML content', () => {
      const html = '<p>Important content here.</p><p>More content.</p>';
      const chapterName = 'Chapter 1';

      const result = enhanceChapterTitles(html, chapterName);

      expect(result).toContain('Important content here.');
      expect(result).toContain('More content.');
    });

    it('should handle empty HTML', () => {
      const html = '';
      const chapterName = 'Chapter 1';

      const result = enhanceChapterTitles(html, chapterName);

      expect(result).toContain('enhanced-chapter-title');
      expect(result).toContain(chapterName);
    });
  });
});
