/**
 * TTS Special Character Handling Tests
 *
 * Tests for handling special characters like Chinese ellipsis (······) that may
 * cause TTS drift issues if treated inconsistently between paragraph extraction
 * and TTS engine processing.
 */

import { extractParagraphs } from '../htmlParagraphExtractor';

describe('TTS Special Character Handling', () => {
  describe('Chinese Ellipsis (······)', () => {
    it('should extract paragraphs containing Chinese ellipsis', () => {
      const html = '<p>"······"</p>';
      const paragraphs = extractParagraphs(html);

      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0]).toBe('"······"');
    });

    it('should extract paragraphs with mixed content including Chinese ellipsis', () => {
      const html = '<p>······Hmph.</p>';
      const paragraphs = extractParagraphs(html);

      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0]).toBe('······Hmph.');
    });

    it('should extract multiple paragraphs with Chinese ellipsis', () => {
      const html = `
        <p>First paragraph</p>
        <p>"······"</p>
        <p>Third paragraph</p>
      `;
      const paragraphs = extractParagraphs(html);

      expect(paragraphs).toHaveLength(3);
      expect(paragraphs[0]).toBe('First paragraph');
      expect(paragraphs[1]).toBe('"······"');
      expect(paragraphs[2]).toBe('Third paragraph');
    });

    it('should not treat Chinese ellipsis-only paragraphs as empty', () => {
      const html = '<p>······</p><p>Next paragraph</p>';
      const paragraphs = extractParagraphs(html);

      expect(paragraphs).toHaveLength(2);
      expect(paragraphs[0].length).toBeGreaterThan(0);
      expect(paragraphs[0]).toBe('······');
    });
  });

  describe('Dialogue Quotation Marks', () => {
    it('should extract Chinese-style quotation marks correctly', () => {
      const html = '<p>"······"</p><p>"······Hmph."</p>';
      const paragraphs = extractParagraphs(html);

      expect(paragraphs).toHaveLength(2);
      expect(paragraphs[0]).toBe('"······"');
      expect(paragraphs[1]).toBe('"······Hmph."');
    });

    it('should handle mixed quotation styles', () => {
      const html = `
        <p>"Hello," she said.</p>
        <p>"······"</p>
        <p>'Really? That's too bad.'</p>
      `;
      const paragraphs = extractParagraphs(html);

      expect(paragraphs).toHaveLength(3);
      expect(paragraphs[0]).toBe('"Hello," she said.');
      expect(paragraphs[1]).toBe('"······"');
      expect(paragraphs[2]).toBe("'Really? That's too bad.'");
    });
  });

  describe('Empty and Whitespace Handling', () => {
    it('should filter out empty paragraphs', () => {
      const html = '<p></p><p>Valid paragraph</p><p></p>';
      const paragraphs = extractParagraphs(html);

      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0]).toBe('Valid paragraph');
    });

    it('should filter out whitespace-only paragraphs', () => {
      const html = '<p>   </p><p>Valid paragraph</p><p>\t\n</p>';
      const paragraphs = extractParagraphs(html);

      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0]).toBe('Valid paragraph');
    });

    it('should trim whitespace from valid paragraphs', () => {
      const html = '<p>  Valid paragraph with spaces  </p>';
      const paragraphs = extractParagraphs(html);

      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0]).toBe('Valid paragraph with spaces');
    });
  });

  describe('Special Unicode Characters', () => {
    it('should preserve em-dashes and other punctuation', () => {
      const html = '<p>Hello—world!</p><p>Test…test</p>';
      const paragraphs = extractParagraphs(html);

      expect(paragraphs).toHaveLength(2);
      expect(paragraphs[0]).toBe('Hello—world!');
      expect(paragraphs[1]).toBe('Test…test');
    });

    it('should handle mixed scripts (Latin, CJK, Cyrillic)', () => {
      const html = '<p>Hello 你好 Привет</p>';
      const paragraphs = extractParagraphs(html);

      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0]).toBe('Hello 你好 Привет');
    });
  });

  describe('HTML Entity Handling', () => {
    it('should decode common HTML entities', () => {
      const html = '<p>&nbsp;&amp;&lt;&gt;&quot;&#39;</p>';
      const paragraphs = extractParagraphs(html);

      expect(paragraphs).toHaveLength(1);
      // Note: &nbsp; decodes to non-breaking space which gets trimmed
      expect(paragraphs[0]).toBe('&<>"\'');
    });

    it('should decode numeric HTML entities', () => {
      const html = '<p>&#8230;</p>'; // ellipsis character
      const paragraphs = extractParagraphs(html);

      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0]).toBe('…');
    });
  });

  describe('Real-world Test Cases from Chapter 214', () => {
    it('should handle sample line 25: "······"', () => {
      const html = '<p>"······"</p>';
      const paragraphs = extractParagraphs(html);

      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0]).toBe('"······"');
    });

    it('should handle sample line 71: "······Hmph."', () => {
      const html = '<p>"······Hmph."</p>';
      const paragraphs = extractParagraphs(html);

      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0]).toBe('"······Hmph."');
    });

    it('should handle complex dialogue with Chinese ellipsis', () => {
      const html = `
        <p>"······"</p>
        <p>"······Hmph."</p>
        <p>The girl glanced at Woojin and passed by.</p>
      `;
      const paragraphs = extractParagraphs(html);

      expect(paragraphs).toHaveLength(3);
      expect(paragraphs).toHaveLength(3);
      expect(paragraphs[0]).toBe('"······"');
      expect(paragraphs[1]).toBe('"······Hmph."');
      expect(paragraphs[2]).toBe('The girl glanced at Woojin and passed by.');
    });
  });
});
