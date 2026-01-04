const fs = require('fs');

/**
 * Test script to analyze special characters that may cause TTS highlight desync
 *
 * This script simulates how the WebView and Android TTS engine might handle text differently
 */

// Sample text from the problematic chapter with middle dots
const sampleTexts = [
  '······',
  '······Hmph.',
  'It was as if a god had accidentally spilled paint.',
  '"Thank you…for two days—"',
  "['Ending the reading of 'A: 1'.']",
  'CEO~nim',
];

function analyzeText(text) {
  console.log('\n=== Analyzing Text ===');
  console.log(`Text: "${text}"`);
  console.log(`Length: ${text.length}`);
  console.log(
    `Char codes: ${Array.from(text)
      .map(c => c.charCodeAt(0))
      .join(', ')}`,
  );

  // Check for problematic characters
  const problematicChars = [];
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const char = text[i];

    // Middle dot (Unicode 183)
    if (charCode === 183) {
      problematicChars.push({ index: i, char, charCode, type: 'MIDDLE_DOT' });
    }
    // Smart quotes
    else if ([8216, 8217, 8220, 8221].includes(charCode)) {
      problematicChars.push({ index: i, char, charCode, type: 'SMART_QUOTE' });
    }
    // Em dash
    else if (charCode === 8212) {
      problematicChars.push({ index: i, char, charCode, type: 'EM_DASH' });
    }
    // Non-ASCII
    else if (charCode > 127) {
      problematicChars.push({ index: i, char, charCode, type: 'NON_ASCII' });
    }
  }

  if (problematicChars.length > 0) {
    console.log('\n⚠️  Problematic characters found:');
    problematicChars.forEach(pc => {
      console.log(
        `  Position ${pc.index}: '${pc.char}' (code: ${pc.charCode}, type: ${pc.type})`,
      );
    });
  } else {
    console.log('\n✅ No problematic characters found');
  }

  return problematicChars;
}

function simulateTextContentExtraction(html) {
  console.log('\n=== Simulating textContent Extraction ===');
  console.log(`HTML: ${html}`);

  // Simulate what textContent does (strips tags, preserves text)
  const textContent = html.replace(/<[^>]*>/g, '');
  console.log(`textContent result: "${textContent}"`);
  console.log(`Length: ${textContent.length}`);

  return textContent;
}

function compareIndexing() {
  console.log('\n\n===============================');
  console.log('TTS HIGHLIGHT DESYNC ANALYSIS');
  console.log('===============================');

  // Test case 1: Middle dots
  console.log('\n\n--- Test Case 1: Middle Dots ---');
  const middleDots = '······';
  analyzeText(middleDots);
  console.log('\nProblem: TTS engine might treat each dot as a separate pause');
  console.log(
    'WebView textContent returns 6 characters, but TTS might skip/compress them',
  );

  // Test case 2: Mixed content
  console.log('\n\n--- Test Case 2: Mixed Special Characters ---');
  const mixed = '"Hello…world—test"';
  analyzeText(mixed);

  // Test case 3: HTML entity handling
  console.log('\n\n--- Test Case 3: HTML Entities ---');
  const htmlWithEntity = '<p>Hello&nbsp;world</p>';
  const extracted = simulateTextContentExtraction(htmlWithEntity);
  analyzeText(extracted);

  // Test case 4: Unwrapped text nodes
  console.log('\n\n--- Test Case 4: Unwrapped Text Nodes ---');
  console.log(
    'Issue: Some text is NOT wrapped in <p> tags, just bare text nodes + <br>',
  );
  console.log('Example: "It was as if a god had accidentally spilled paint."');
  console.log(
    'This causes getReadableElements() to potentially skip or miscount paragraphs',
  );

  // Test case 5: Character offset simulation
  console.log('\n\n--- Test Case 5: Character Offset Simulation ---');
  const paragraph = 'Hello world ······ test';
  console.log(`Text: "${paragraph}"`);
  console.log(`Length: ${paragraph.length}`);

  // Simulate WebView counting
  const webViewChars = paragraph.length;
  console.log(`WebView character count: ${webViewChars}`);

  // Simulate TTS engine potentially skipping middle dots
  const ttsEngineText = paragraph.replace(/·+/g, '');
  console.log(`TTS engine might see: "${ttsEngineText}"`);
  console.log(`TTS character count: ${ttsEngineText.length}`);
  console.log(
    `Offset difference: ${webViewChars - ttsEngineText.length} characters`,
  );

  console.log('\n\n===============================');
  console.log('FINDINGS & RECOMMENDATIONS');
  console.log('===============================');

  console.log('\n1. Middle Dot Issue (Unicode 183):');
  console.log('   - WebView counts each · as 1 character');
  console.log('   - TTS engine may skip or compress consecutive middle dots');
  console.log(
    '   - Recommendation: Normalize middle dots before sending to TTS',
  );

  console.log('\n2. Unwrapped Text Nodes:');
  console.log(
    '   - Some sentences are bare text nodes, not wrapped in <p> tags',
  );
  console.log('   - getReadableElements() might skip these');
  console.log(
    '   - Recommendation: Update paragraph detection to include text nodes',
  );

  console.log('\n3. Smart Quotes & Special Characters:');
  console.log('   - Usually handled correctly by TTS engines');
  console.log('   - But can cause issues with character offset calculation');

  console.log('\n4. Fix Strategy:');
  console.log(
    '   a) Normalize text before TTS (replace ······ with single ellipsis)',
  );
  console.log('   b) Ensure getReadableElements() captures ALL text content');
  console.log('   c) Add character offset validation/correction');
  console.log(
    '   d) Consider using word boundaries instead of character offsets',
  );
}

// Run analysis
console.log('Running TTS Highlight Desync Analysis...\n');

sampleTexts.forEach((text, index) => {
  console.log(`\n--- Sample Text ${index + 1} ---`);
  analyzeText(text);
});

compareIndexing();

console.log('\n\n✅ Analysis complete!');
console.log('\nNext steps:');
console.log('1. Check core.js getReadableElements() for text node handling');
console.log('2. Add text normalization before TTS in speak() method');
console.log('3. Test with the problematic chapter URL');
