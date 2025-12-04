// Clean extraction of voice data
const fs = require('fs');
const https = require('https');

async function extractVoiceData() {
  const url =
    'https://raw.githubusercontent.com/HadrienGardeur/web-speech-recommended-voices/main/json/en.json';

  return new Promise((resolve, reject) => {
    https
      .get(url, res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            const voiceData = JSON.parse(data);
            resolve(processVoiceData(voiceData));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });
}

function processVoiceData(data) {
  const voices = data.voices || data;
  if (!Array.isArray(voices)) {
    throw new Error('Voice data is not an array');
  }

  const regionMap = {
    'en-US': 'US',
    'en-GB': 'UK',
    'en-AU': 'AU',
    'en-CA': 'CA',
    'en-IN': 'IN',
    'en-IE': 'IE',
    'en-ZA': 'ZA',
    'en-KE': 'KE',
    'en-NZ': 'NZ',
    'en-NG': 'NG',
    'en-PH': 'PH',
    'en-SG': 'SG',
    'en-TZ': 'TZ',
    'en-HK': 'HK',
    'en-GB-u-sd-gbsct': 'UK-SCT',
  };

  const processedVoices = {};

  voices.forEach(voice => {
    // Only process English voices
    if (!voice.language || !voice.language.startsWith('en')) return;

    const region = regionMap[voice.language] || 'XX';
    const gender = voice.gender || 'neutral';
    const quality = voice.quality || ['normal'];
    const qualityStr = Array.isArray(quality) ? quality[0] : quality;

    // USE THE LABEL FIELD - this is the authoritative human-readable name
    // The label field contains the proper voice name from the source
    let baseName = voice.label || voice.name;

    // Clean up platform prefix from label if present (e.g., "Microsoft Ava" -> "Ava")
    if (baseName.startsWith('Microsoft ')) {
      baseName = baseName.substring(10).trim();
    }

    // For voices with region in label like "Female voice 2 (US)", keep as-is
    // These are already good display names

    // Map quality to display string
    const qualityMap = {
      'veryHigh': 'HQ',
      'high': 'HIGH',
      'normal': 'NORMAL',
      'low': 'LOW',
    };
    const displayQuality = qualityMap[qualityStr] || qualityStr.toUpperCase();

    // Final display name: ENGLISH (REGION) Name Quality
    // User requested: "ENGLISH (US) Jenny HQ" or "ENGLISH (UK) Female Voice 2 LOW"
    const displayName = `ENGLISH (${region}) ${baseName} ${displayQuality}`;

    processedVoices[voice.name] = {
      id: voice.name.toLowerCase().replace(/\s+/g, '-'),
      displayName,
      platform: detectPlatform(voice),
      language: voice.language,
      languageName: 'ENGLISH',
      region,
      name: baseName,
      gender,
      quality: qualityStr,
      style: getStyleFromQuality(qualityStr),
      altIds: voice.altNames || [],
      nativeIds: voice.nativeID || [],
    };
  });

  return processedVoices;
}

function detectPlatform(voice) {
  if (voice.name.includes('Microsoft')) return 'microsoft';
  if (voice.os && voice.os.includes('Apple')) return 'apple';
  if (voice.name.includes('Google')) return 'google';
  if (voice.os && voice.os.includes('Windows')) return 'windows';
  return 'unknown';
}



function getStyleFromQuality(quality) {
  const styleMap = {
    'veryHigh': 'Natural',
    'high': 'Clear',
    'normal': 'Standard',
    'low': 'Basic',
  };
  return styleMap[quality] || 'Standard';
}

// Execute extraction
extractVoiceData()
  .then(processedVoices => {
    const voiceCount = Object.keys(processedVoices).length;
    console.log(`Extracted ${voiceCount} English voices`);

    const outputPath = '../src/services/authoritative-voice-map.ts';
    const fileContent = `export interface VoiceMapping {
  /** Original voice identifier from web-speech-recommended-voices */
  id: string;
  /** Display name for UI - Format: "LANGUAGE (REGION) Name - Quality" */
  displayName: string;
  /** Platform: microsoft, apple, google, windows */
  platform: 'microsoft' | 'apple' | 'google' | 'windows' | 'unknown';
  /** Language code (en-US, en-GB, etc.) */
  language: string;
  /** Language name for display - Always ENGLISH for all variants */
  languageName: string;
  /** Region name for display (US, UK, AU, etc.) */
  region: string;
  /** Base voice name (Ava, Emma, David, etc.) */
  name: string;
  /** Gender: male, female, neutral */
  gender: 'male' | 'female' | 'neutral';
  /** Quality level: veryHigh, high, normal, low */
  quality: 'veryHigh' | 'high' | 'normal' | 'low';
  /** Style descriptor: Natural, Warm, Professional, etc. */
  style?: string;
  /** Alternative voice identifiers */
  altIds?: string[];
  /** Native platform identifiers (Android/ChromeOS) */
  nativeIds?: string[];

  /** Generated display name following format: "LANGUAGE (REGION) Name - Quality" */
  getDisplayDisplayName(): string;
}

export const AUTHORITATIVE_VOICE_MAP: Record<string, VoiceMapping> = ${JSON.stringify(
      processedVoices,
      null,
      2,
    )};

// Helper function to generate display names
export const generateDisplayName = (
  languageName: string,
  region: string,
  name: string,
  quality: string
): string => {
  const qualityMap: Record<string, string> = {
    'veryHigh': 'HQ',
    'high': 'HIGH',
    'normal': 'NORMAL',
    'low': 'LOW',
  };
  const displayQuality = qualityMap[quality] || quality.toUpperCase();
  return \`\${languageName} (\${region}) \${name} \${displayQuality}\`;
};
`;

    fs.writeFileSync(outputPath, fileContent);
    console.log(`Voice data saved to ${outputPath}`);
    console.log(
      `Sample voices:`,
      Object.values(processedVoices)
        .slice(0, 3)
        .map(v => v.displayName),
    );
  })
  .catch(error => {
    console.error('Error extracting voice data:', error);
    process.exit(1);
  });
