const fs = require('fs');
let content = fs.readFileSync('android/app/src/main/assets/js/core.js', 'utf8');

// Remove atomic protection flag setting from wrong location
content = content.replace(
  /\/\/ ATOMIC PROTECTION: Set flag immediately if this is initial scroll to prevent race conditions[\s\S\s]*if \(needsInitialScroll\) \{[\s\S\s]*reader\.hasPerformedInitialScroll = true;[\s\S\s]*console\.log\([\s\S\s]*'\[calculatePages\] ATOMIC: Set hasPerformedInitialScroll = true immediately'[\s\S\s]*'\);[\s\S\s]*\}/g,
  `// ATOMIC PROTECTION: Set flag immediately if this is initial scroll to prevent race conditions`
);

// Add flag setting at correct location - after all checks pass and we're about to execute initial scroll
content = content.replace(
  /if \(readableElements\[initialReaderConfig\.savedParagraphIndex\]\) \{[\s\S\s]*console\.log\([\s\S\s]*'\[calculatePages\] Scrolling to paragraph'[\s\S\s]*initialReaderConfig\.savedParagraphIndex[\s\S\s]*'hasPerformedInitialScroll:'[\s\S\s]*reader\.hasPerformedInitialScroll[\s\S\s]*'timeSinceLastCall:'[\s\S\s]*Date\.now\(\) - window\.lastCalculatePagesCall[\s\S\s]*'\);[\s\S\s]*reader\.suppressSaveOnScroll = true;/g,
  `if (readableElements[initialReaderConfig.savedParagraphIndex]) {
        console.log(
          '[calculatePages] Scrolling to paragraph',
          initialReaderConfig.savedParagraphIndex,
          'hasPerformedInitialScroll:',
          reader.hasPerformedInitialScroll,
          'timeSinceLastCall:',
          Date.now() - window.lastCalculatePagesCall,
        );

        // CRITICAL: Set flag immediately to prevent duplicate initial scrolls
        reader.hasPerformedInitialScroll = true;
        reader.suppressSaveOnScroll = true;`
);

fs.writeFileSync('android/app/src/main/assets/js/core.js', content);
