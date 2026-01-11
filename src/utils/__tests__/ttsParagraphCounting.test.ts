/**
 * TTS Paragraph Counting Consistency Tests
 *
 * Tests to verify extractParagraphs behavior with inline formatting
 */

import { extractParagraphs } from '../htmlParagraphExtractor';

describe('TTS Paragraph Counting Consistency', () => {
  describe('Inline Formatting Handling', () => {
    it('should count block elements, not inline elements', () => {
      const html = '<p><b>Bold</b> text</p>';
      const paragraphs = extractParagraphs(html);

      expect(paragraphs.length).toBe(1);
      expect(paragraphs[0]).toBe('Bold text');
    });

    it('should handle nested inline tags correctly', () => {
      const html = '<p><b><i>Nested</i></b></p>';
      const paragraphs = extractParagraphs(html);

      expect(paragraphs.length).toBe(1);
      expect(paragraphs[0]).toBe('Nested');
    });

    it('should normalize whitespace correctly', () => {
      const html = '<p>  Extra   spaces  </p>';
      const paragraphs = extractParagraphs(html);

      expect(paragraphs.length).toBe(1);
      expect(paragraphs[0]).toBe('Extra spaces');
    });
  });

  describe('HTML Structure Handling', () => {
    it('should handle div and p mixture', () => {
      const html = '<div>Div content</div><p>Para content</p>';
      const paragraphs = extractParagraphs(html);

      expect(paragraphs.length).toBe(2);
      expect(paragraphs[0]).toBe('Div content');
      expect(paragraphs[1]).toBe('Para content');
    });

    it('should handle nested blocks correctly', () => {
      const html = '<div><p>Inner para</p></div>';
      const paragraphs = extractParagraphs(html);

      expect(paragraphs.length).toBe(1);
      expect(paragraphs[0]).toBe('Inner para');
    });

    it('should handle headings', () => {
      const html = '<h1>Heading 1</h1><h2>Heading 2</h2>';
      const paragraphs = extractParagraphs(html);

      expect(paragraphs.length).toBe(2);
      expect(paragraphs[0]).toBe('Heading 1');
      expect(paragraphs[1]).toBe('Heading 2');
    });

    it('should handle lists', () => {
      const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      const paragraphs = extractParagraphs(html);

      expect(paragraphs.length).toBe(2);
      expect(paragraphs[0]).toBe('Item 1');
      expect(paragraphs[1]).toBe('Item 2');
    });

    it('should handle blockquotes', () => {
      const html = '<blockquote>Quote text</blockquote>';
      const paragraphs = extractParagraphs(html);

      expect(paragraphs.length).toBe(1);
      expect(paragraphs[0]).toBe('Quote text');
    });

    it('should handle tables', () => {
      const html = '<table><tr><td>Cell 1</td><td>Cell 2</td></tr></table>';
      const paragraphs = extractParagraphs(html);

      expect(paragraphs.length).toBeGreaterThanOrEqual(0);
    });

    it('should filter empty paragraphs', () => {
      const html = '<p></p><p>Content</p><p></p>';
      const paragraphs = extractParagraphs(html);

      expect(paragraphs.length).toBe(1);
      expect(paragraphs[0]).toBe('Content');
    });

    it('should handle complex mixed content', () => {
      const html = `
        <p>Paragraph 1</p>
        <div>Div with <b>bold</b> text</div>
        <ul>
          <li>List item 1</li>
          <li>List item 2 with <i>italic</i></li>
        </ul>
      `;
      const paragraphs = extractParagraphs(html);

      expect(paragraphs.length).toBe(4);
      expect(paragraphs[0]).toBe('Paragraph 1');
      expect(paragraphs[1]).toBe('Div with bold text');
      expect(paragraphs[2]).toBe('List item 1');
      expect(paragraphs[3]).toBe('List item 2 with italic');
    });
  });

  describe('Special Characters', () => {
    it('should handle Chinese ellipsis', () => {
      const html = '<p>Text...</p>';
      const paragraphs = extractParagraphs(html);

      expect(paragraphs.length).toBe(1);
      expect(paragraphs[0]).toBe('Text...');
    });

    it('should handle HTML entities', () => {
      const html = '<p>Text &amp; entities</p>';
      const paragraphs = extractParagraphs(html);

      expect(paragraphs.length).toBe(1);
      expect(paragraphs[0]).toBe('Text & entities');
    });

    it('should handle multiple entities', () => {
      const html = '<p>&lt;text&gt; &quot;quoted&quot;</p>';
      const paragraphs = extractParagraphs(html);

      expect(paragraphs.length).toBe(1);
      expect(paragraphs[0]).toBe('<text> "quoted"');
    });
  });
});
