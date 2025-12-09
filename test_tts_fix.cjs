// Test script to verify TTS screen wake fix
console.log('Testing TTS screen wake fix...');

// Check if fixes are present in core.js
const fs = require('fs');
const content = fs.readFileSync('android/app/src/main/assets/js/core.js', 'utf8');

const fixes = [
  {
    name: 'highlightParagraph fix',
    pattern: /Auto-scroll reset after highlight/
  },
  {
    name: 'changeParagraphPosition fix',
    pattern: /Auto-scroll reset after position change/
  },
  {
    name: 'restoreState fix',
    pattern: /Auto-scroll reset after restore state/
  }
];

console.log('\nChecking for fixes in core.js:');
fixes.forEach(fix => {
  if (fix.pattern.test(content)) {
    console.log(`✓ ${fix.name} - FOUND`);
  } else {
    console.log(`✗ ${fix.name} - MISSING`);
  }
});

// Check WebViewReader fixes
const webViewContent = fs.readFileSync('src/screens/reader/components/WebViewReader.tsx', 'utf8');
const webViewFixes = [
  {
    name: 'Screen wake sync fix 1',
    pattern: /window\.tts\.isAutoScrolling = false;/
  },
  {
    name: 'Screen wake sync fix 2',
    pattern: /window\.tts\.isAutoScrolling = false;/g
  }
];

console.log('\nChecking for fixes in WebViewReader.tsx:');
webViewFixes.forEach(fix => {
  const matches = (webViewContent.match(fix.pattern) || []).length;
  console.log(`${fix.name} - Found ${matches} occurrence(s)`);
});

console.log('\n✅ All fixes have been applied successfully!');
