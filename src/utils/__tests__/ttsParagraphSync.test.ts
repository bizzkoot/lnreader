/**
 * Test to ensure TTS paragraph extraction in React Native (extractParagraphs)
 * matches WebView's readable elements (getReadableElements via readableNodeNames).
 *
 * This prevents index mismatch bugs where TTS counts different paragraphs than WebView,
 * causing highlight +1 offset issues.
 */

import * as fs from 'fs';
import * as path from 'path';

// Extract BLOCK_TAGS from htmlParagraphExtractor.ts
// These are the tags that extractParagraphs() uses to split text
const BLOCK_TAGS_FROM_EXTRACTOR = [
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

describe('TTS Paragraph Extraction Sync', () => {
  let coreJsContent: string;
  let readableNodeNamesFromCoreJs: string[];
  let blockNodeNamesFromCoreJs: string[];

  beforeAll(() => {
    // Read core.js to extract the actual tag arrays
    // From src/utils/__tests__/ we need to go up 3 levels to project root
    const coreJsPath = path.resolve(
      __dirname,
      '../../../android/app/src/main/assets/js/core.js',
    );
    coreJsContent = fs.readFileSync(coreJsPath, 'utf-8');

    // Extract readableNodeNames array from core.js
    const readableMatch = coreJsContent.match(
      /this\.readableNodeNames\s*=\s*\[([\s\S]*?)\];/,
    );
    if (readableMatch) {
      const arrayContent = readableMatch[1];
      readableNodeNamesFromCoreJs =
        arrayContent
          .match(/'([^']+)'/g)
          ?.map(s => s.replace(/'/g, '').toLowerCase()) ?? [];
    } else {
      readableNodeNamesFromCoreJs = [];
    }

    // Extract blockNodeNames array from core.js
    const blockMatch = coreJsContent.match(
      /this\.blockNodeNames\s*=\s*\[([\s\S]*?)\];/,
    );
    if (blockMatch) {
      const arrayContent = blockMatch[1];
      blockNodeNamesFromCoreJs =
        arrayContent
          .match(/'([^']+)'/g)
          ?.map(s => s.replace(/'/g, '').toLowerCase()) ?? [];
    } else {
      blockNodeNamesFromCoreJs = [];
    }
  });

  test('core.js is readable and contains tag arrays', () => {
    expect(coreJsContent.length).toBeGreaterThan(0);
    expect(readableNodeNamesFromCoreJs.length).toBeGreaterThan(0);
    expect(blockNodeNamesFromCoreJs.length).toBeGreaterThan(0);
  });

  test('all BLOCK_TAGS from extractParagraphs are in WebView readableNodeNames', () => {
    const missingFromReadable: string[] = [];

    for (const tag of BLOCK_TAGS_FROM_EXTRACTOR) {
      if (!readableNodeNamesFromCoreJs.includes(tag)) {
        missingFromReadable.push(tag);
      }
    }

    if (missingFromReadable.length > 0) {
      throw new Error(
        `The following block tags are in extractParagraphs but MISSING from core.js readableNodeNames:\n` +
          `${missingFromReadable.map(t => `  - ${t.toUpperCase()}`).join('\n')}\n\n` +
          `This will cause TTS highlight index mismatch! Add them to readableNodeNames in core.js.`,
      );
    }

    expect(missingFromReadable).toHaveLength(0);
  });

  test('all BLOCK_TAGS from extractParagraphs are in WebView blockNodeNames', () => {
    const missingFromBlock: string[] = [];

    for (const tag of BLOCK_TAGS_FROM_EXTRACTOR) {
      if (!blockNodeNamesFromCoreJs.includes(tag)) {
        missingFromBlock.push(tag);
      }
    }

    if (missingFromBlock.length > 0) {
      throw new Error(
        `The following block tags are in extractParagraphs but MISSING from core.js blockNodeNames:\n` +
          `${missingFromBlock.map(t => `  - ${t.toUpperCase()}`).join('\n')}\n\n` +
          `This may cause TTS vs highlight paragraph count mismatch! Add them to blockNodeNames in core.js.`,
      );
    }

    expect(missingFromBlock).toHaveLength(0);
  });

  test('WebView has standard inline tags for text rendering', () => {
    // These are inline tags that should be in readableNodeNames for proper text rendering
    const expectedInlineTags = ['b', 'i', 'span', 'em', 'strong', 'a', '#text'];

    const missingInline: string[] = [];
    for (const tag of expectedInlineTags) {
      if (!readableNodeNamesFromCoreJs.includes(tag)) {
        missingInline.push(tag);
      }
    }

    expect(missingInline).toHaveLength(0);
  });

  test('extractParagraphs BLOCK_TAGS constant is up to date', () => {
    // This test ensures we update the test if htmlParagraphExtractor changes
    const extractorPath = path.resolve(
      __dirname,
      '../htmlParagraphExtractor.ts',
    );
    const extractorContent = fs.readFileSync(extractorPath, 'utf-8');

    // Extract BLOCK_TAGS from the actual source file
    const blockTagsMatch = extractorContent.match(
      /const BLOCK_TAGS\s*=\s*\[([\s\S]*?)\];/,
    );

    expect(blockTagsMatch).not.toBeNull();

    if (blockTagsMatch) {
      const tagsFromSource =
        blockTagsMatch[1]
          .match(/'([^']+)'/g)
          ?.map(s => s.replace(/'/g, '').toLowerCase())
          .sort() ?? [];

      const tagsInTest = [...BLOCK_TAGS_FROM_EXTRACTOR].sort();

      // Check if test constant matches source
      const missingFromTest = tagsFromSource.filter(
        t => !tagsInTest.includes(t),
      );
      const extraInTest = tagsInTest.filter(t => !tagsFromSource.includes(t));

      if (missingFromTest.length > 0 || extraInTest.length > 0) {
        let message =
          'BLOCK_TAGS_FROM_EXTRACTOR in this test is out of sync with htmlParagraphExtractor.ts!\n';
        if (missingFromTest.length > 0) {
          message += `Missing from test: ${missingFromTest.join(', ')}\n`;
        }
        if (extraInTest.length > 0) {
          message += `Extra in test: ${extraInTest.join(', ')}\n`;
        }
        message += 'Update BLOCK_TAGS_FROM_EXTRACTOR in this test file.';
        throw new Error(message);
      }
    }
  });
});
