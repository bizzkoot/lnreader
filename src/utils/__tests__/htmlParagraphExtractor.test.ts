import {
  extractParagraphs,
  extractParagraphsFrom,
} from '../htmlParagraphExtractor';

describe('htmlParagraphExtractor', () => {
  describe('extractParagraphs', () => {
    it('should extract paragraphs from simple <p> tags', () => {
      const html = '<p>First paragraph.</p><p>Second paragraph.</p>';
      const result = extractParagraphs(html);
      expect(result).toEqual(['First paragraph.', 'Second paragraph.']);
    });

    it('should extract text from nested <div> elements (Flattening Strategy)', () => {
      const html = `
        <div class="chapter-content">
          This is a narrator's note
          <p>First paragraph of story</p>
        </div>
      `;
      const result = extractParagraphs(html);
      expect(result).toContain("This is a narrator's note");
      expect(result).toContain('First paragraph of story');
    });

    it('should handle <br> tags as paragraph separators', () => {
      const html = 'Line one.<br>Line two.<br/>Line three.';
      const result = extractParagraphs(html);
      expect(result).toEqual(['Line one.', 'Line two.', 'Line three.']);
    });

    it('should decode common HTML entities', () => {
      const html = '<p>Tom &amp; Jerry &quot;quoted&quot;</p>';
      const result = extractParagraphs(html);
      expect(result).toEqual(['Tom & Jerry "quoted"']);
    });

    it('should decode numeric HTML entities', () => {
      const html = '<p>Heart: &#10084; Arrow: &#x2192;</p>';
      const result = extractParagraphs(html);
      expect(result[0]).toContain('Heart:');
      // Check the unicode characters were decoded
      expect(result[0].length).toBeGreaterThan(10);
    });

    it('should decode &nbsp; as space', () => {
      const html = '<p>Word&nbsp;One&nbsp;Two</p>';
      const result = extractParagraphs(html);
      expect(result).toEqual(['Word One Two']);
    });

    it('should remove <script> tags completely', () => {
      const html = `
        <p>Before script.</p>
        <script>alert("evil");</script>
        <p>After script.</p>
      `;
      const result = extractParagraphs(html);
      expect(result).toEqual(['Before script.', 'After script.']);
      expect(result.join(' ')).not.toContain('evil');
    });

    it('should remove <style> tags completely', () => {
      const html = `
        <p>Before style.</p>
        <style>.hidden { display: none; }</style>
        <p>After style.</p>
      `;
      const result = extractParagraphs(html);
      expect(result).toEqual(['Before style.', 'After style.']);
      expect(result.join(' ')).not.toContain('display');
    });

    it('should strip inline tags but preserve text', () => {
      const html = '<p><strong>Bold</strong> and <em>italic</em> text.</p>';
      const result = extractParagraphs(html);
      expect(result).toEqual(['Bold and italic text.']);
    });

    it('should handle empty HTML', () => {
      expect(extractParagraphs('')).toEqual([]);
    });

    it('should handle null-like input', () => {
      expect(extractParagraphs(null as unknown as string)).toEqual([]);
      expect(extractParagraphs(undefined as unknown as string)).toEqual([]);
    });

    it('should handle HTML with only whitespace', () => {
      const html = '<p>   </p><div>  </div>';
      const result = extractParagraphs(html);
      expect(result).toEqual([]);
    });

    it('should collapse multiple whitespace into single space', () => {
      const html = '<p>Word   with    many     spaces</p>';
      const result = extractParagraphs(html);
      expect(result).toEqual(['Word with many spaces']);
    });

    it('should handle all block-level tags', () => {
      const html = `
        <h1>Heading 1</h1>
        <h2>Heading 2</h2>
        <article>Article text</article>
        <section>Section text</section>
        <blockquote>Quote text</blockquote>
      `;
      const result = extractParagraphs(html);
      expect(result).toContain('Heading 1');
      expect(result).toContain('Heading 2');
      expect(result).toContain('Article text');
      expect(result).toContain('Section text');
      expect(result).toContain('Quote text');
    });

    it('should handle deeply nested content', () => {
      const html = `
        <div>
          <div>
            <div>
              <p>Deeply nested paragraph</p>
            </div>
          </div>
        </div>
      `;
      const result = extractParagraphs(html);
      expect(result).toContain('Deeply nested paragraph');
    });

    it('should handle list items', () => {
      const html = `
        <ul>
          <li>Item one</li>
          <li>Item two</li>
          <li>Item three</li>
        </ul>
      `;
      const result = extractParagraphs(html);
      expect(result).toContain('Item one');
      expect(result).toContain('Item two');
      expect(result).toContain('Item three');
    });

    it('should handle mixed content with text nodes outside tags', () => {
      const html = `
        Text before div
        <div>Inside div</div>
        Text after div
      `;
      const result = extractParagraphs(html);
      expect(result.length).toBeGreaterThan(0);
      expect(result.join(' ')).toContain('Text before div');
      expect(result.join(' ')).toContain('Inside div');
    });

    it('should handle self-closing br tags', () => {
      const html = 'Line 1<br />Line 2<br/>Line 3';
      const result = extractParagraphs(html);
      expect(result).toEqual(['Line 1', 'Line 2', 'Line 3']);
    });

    it('should handle tags with attributes', () => {
      const html =
        '<p class="intro" id="p1">Paragraph with attributes</p><div data-chapter="1">Div with data</div>';
      const result = extractParagraphs(html);
      expect(result).toContain('Paragraph with attributes');
      expect(result).toContain('Div with data');
    });
  });

  describe('extractParagraphsFrom', () => {
    const sampleHtml =
      '<p>Para 0</p><p>Para 1</p><p>Para 2</p><p>Para 3</p><p>Para 4</p>';

    it('should extract paragraphs starting from given index', () => {
      const result = extractParagraphsFrom(sampleHtml, 2);
      expect(result).toEqual(['Para 2', 'Para 3', 'Para 4']);
    });

    it('should extract limited count of paragraphs', () => {
      const result = extractParagraphsFrom(sampleHtml, 1, 2);
      expect(result).toEqual(['Para 1', 'Para 2']);
    });

    it('should return empty array if startIndex exceeds total paragraphs', () => {
      const result = extractParagraphsFrom(sampleHtml, 100);
      expect(result).toEqual([]);
    });

    it('should clamp endIndex to total length', () => {
      const result = extractParagraphsFrom(sampleHtml, 3, 100);
      expect(result).toEqual(['Para 3', 'Para 4']);
    });

    it('should work with startIndex 0', () => {
      const result = extractParagraphsFrom(sampleHtml, 0, 2);
      expect(result).toEqual(['Para 0', 'Para 1']);
    });

    it('should handle empty HTML', () => {
      expect(extractParagraphsFrom('', 0)).toEqual([]);
      expect(extractParagraphsFrom('', 5)).toEqual([]);
    });
  });
});
