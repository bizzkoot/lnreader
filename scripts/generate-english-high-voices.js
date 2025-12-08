const fs = require('fs');
const path = require('path');

const srcPath = path.resolve(
  __dirname,
  '../src/services/authoritative-voice-map.ts',
);
const outMd = path.resolve(__dirname, '../docs/english-high-voices.md');
const outCsv = path.resolve(__dirname, '../docs/english-high-voices.csv');

const content = fs.readFileSync(srcPath, 'utf8');

// Extract the AUTHORITATIVE_VOICE_MAP object literal using a brace-matching approach
const startToken = 'export const AUTHORITATIVE_VOICE_MAP';
const startIndex = content.indexOf(startToken);
if (startIndex === -1) {
  console.error(
    'Could not locate AUTHORITATIVE_VOICE_MAP in authoritative-voice-map.ts',
  );
  process.exit(1);
}

// Find the first '{' after the '=' sign and then find the matching closing '}'
const equalsIndex = content.indexOf('=', startIndex);
const braceStart = content.indexOf('{', equalsIndex);
if (braceStart === -1) {
  console.error('Could not find opening brace for AUTHORITATIVE_VOICE_MAP');
  process.exit(1);
}

let depth = 0;
let i = braceStart;
for (; i < content.length; i++) {
  const ch = content[i];
  if (ch === '{') depth++;
  else if (ch === '}') {
    depth--;
    if (depth === 0) break;
  }
}

if (depth !== 0) {
  console.error(
    'Failed to locate matching closing brace for AUTHORITATIVE_VOICE_MAP',
  );
  process.exit(1);
}

let rawObj = content.slice(braceStart, i + 1);

// Remove any getDisplayDisplayName functions to avoid eval issues
rawObj = rawObj.replace(
  /getDisplayDisplayName\s*:\s*function\([^\)]*\)\s*\{[\s\S]*?\},?/g,
  '',
);

let voiceMap;
try {
  voiceMap = new Function('return ' + rawObj)();
} catch (err) {
  console.error('Failed to evaluate voice map:', err.message);
  process.exit(1);
}

const isEnglish = v => v.language && v.language.startsWith('en');
const isHigh = v => v.quality === 'veryHigh' || v.quality === 'high';

const rows = [];
for (const [key, val] of Object.entries(voiceMap)) {
  try {
    if (isEnglish(val) && isHigh(val)) {
      rows.push({
        key,
        id: val.id || '',
        displayName: val.displayName || '',
        language: val.language || '',
        region: val.region || '',
        name: val.name || '',
        quality: val.quality || '',
        platform: val.platform || '',
        altIds: (val.altIds || []).join('; '),
        nativeIds: (val.nativeIds || []).join('; '),
      });
    }
  } catch (e) {
    // ignore
  }
}

rows.sort(
  (a, b) =>
    (a.language || '').localeCompare(b.language || '') ||
    (a.region || '').localeCompare(b.region || '') ||
    (a.name || '').localeCompare(b.name || ''),
);

// Write CSV
const csvHeader = [
  'mapKey',
  'id',
  'displayName',
  'language',
  'region',
  'name',
  'quality',
  'platform',
  'altIds',
  'nativeIds',
];
const csvLines = [csvHeader.join(',')];
for (const r of rows) {
  const escape = s => '"' + String(s).replace(/"/g, '""') + '"';
  csvLines.push(
    [
      r.key,
      r.id,
      r.displayName,
      r.language,
      r.region,
      r.name,
      r.quality,
      r.platform,
      r.altIds,
      r.nativeIds,
    ]
      .map(escape)
      .join(','),
  );
}
fs.mkdirSync(path.dirname(outMd), { recursive: true });
fs.writeFileSync(outCsv, csvLines.join('\n'));

// Write Markdown table
const mdLines = [];
mdLines.push('# English voices (quality = veryHigh / high)');
mdLines.push('');
mdLines.push(
  '| Map Key | id | displayName | language | region | name | quality | platform | altIds | nativeIds |',
);
mdLines.push('|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  mdLines.push(
    `| ${r.key} | ${r.id} | ${r.displayName} | ${r.language} | ${r.region} | ${r.name} | ${r.quality} | ${r.platform} | ${r.altIds} | ${r.nativeIds} |`,
  );
}
fs.writeFileSync(outMd, mdLines.join('\n'));

console.log(
  'Wrote',
  rows.length,
  'English HQ/HIGH voices to',
  outMd,
  'and',
  outCsv,
);
