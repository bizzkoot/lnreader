import {
  TtsTextCleanupSettings,
  TtsCleanupRule,
  TtsPhoneticPair,
  createTtsCleanupRule,
  createTtsPhoneticPair,
  normalizeRegExpFlags,
  TTS_CLEANUP_MAX_REGEX_LENGTH,
} from '@utils/htmlParagraphExtractor';

// =============================================================================
// TTS Text Cleanup — Presets + Import/Export
//
// Presets are SHIPPED AS DATA ONLY. They are never executed by the cleanup
// pipeline: applying a preset copies its rules/phonetic pairs into the user's
// own settings (MMKV), where they stay fully editable. This keeps the core
// pipeline site-agnostic while giving users one-tap onboarding for the common
// watermark / pronunciation fixes (see PR_17 §10).
// =============================================================================

export interface TtsCleanupPreset {
  id: string;
  title: string;
  description: string;
  rules: TtsCleanupRule[];
  phoneticPairs: TtsPhoneticPair[];
}

export const TTS_CLEANUP_PRESETS: TtsCleanupPreset[] = [
  {
    id: 'watermark-novelight',
    title: 'Novelight watermark (spaced letters)',
    description:
      'Strips the spaced-out "Novelight" anti-scraper watermark found on sites like Novelight.',
    rules: [
      createTtsCleanupRule(
        'N(?:\\W)*o(?:\\W)*v(?:\\W)*e(?:\\W)*l(?:\\W)*i(?:\\W)*g(?:\\W)*h(?:\\W)*t',
        '',
        true,
        'gi',
      ),
    ],
    phoneticPairs: [],
  },
  {
    id: 'corruption-u2014',
    title: 'Fix "u2014" text corruption',
    description:
      'Replaces the literal "u2014" string (corrupted sentence spacing) with a space.',
    rules: [createTtsCleanupRule('u2014', ' ')],
    phoneticPairs: [],
  },
  {
    id: 'tag-official-version',
    title: 'Strip "(Official version)" tags',
    description:
      'Removes "(Official version)" tags and the whitespace after them.',
    rules: [createTtsCleanupRule('\\(Official version\\)\\s*', '', true, 'g')],
    phoneticPairs: [],
  },
  {
    id: 'spam-do-not-rehost',
    title: 'Strip "Do not rehost this novel" spam',
    description:
      'Removes repeated "Do not rehost this novel" anti-scraper spam phrases.',
    rules: [
      createTtsCleanupRule('(Do not rehost this novel)+', '', true, 'gi'),
    ],
    phoneticPairs: [],
  },
  {
    id: 'lookalike-math-bold',
    title: 'Fix math-bold lookalike letters',
    description:
      'Maps unicode mathematical bold/script letters (e.g. mathematical bold N) back to normal letters.',
    rules: [
      createTtsCleanupRule('\u{1D40D}', 'N'), // mathematical bold capital N
      createTtsCleanupRule('\u{1D4DD}', 'N'), // mathematical script capital N
      createTtsCleanupRule('\u{1D400}', 'A'), // mathematical bold capital A
    ],
    phoneticPairs: [],
  },
  {
    id: 'phonetics-ln-names',
    title: 'LN name pronunciations',
    description:
      'Common light-novel names/honorifics that system engines mispronounce.',
    rules: [],
    phoneticPairs: [
      createTtsPhoneticPair('Xianxia', 'Shee-an-shah'),
      createTtsPhoneticPair('Qing', 'Ching'),
      createTtsPhoneticPair('Ainz', 'Ownz'),
    ],
  },
  {
    id: 'phonetics-cjk',
    title: 'CJK name pronunciation (substring)',
    description:
      'Pronounces common CJK characters used in names. Substring mode is required because whole-word boundaries never fire between adjacent CJK characters.',
    rules: [],
    phoneticPairs: [
      createTtsPhoneticPair('秦', 'Qin', true, 'substring'),
      createTtsPhoneticPair('卿', 'Qing', true, 'substring'),
      createTtsPhoneticPair('楚', 'Chu', true, 'substring'),
    ],
  },
];

/**
 * Merge a preset into settings, skipping rules/pairs that already exist
 * (deduped by pattern+isRegex / word+matchMode). Immutable — returns a new
 * settings object.
 */
export function applyPresetToSettings(
  settings: TtsTextCleanupSettings,
  preset: TtsCleanupPreset,
): TtsTextCleanupSettings {
  const rules = [...(settings.rules ?? [])];
  for (const rule of preset.rules) {
    const alreadyExists = rules.some(
      r => r.pattern === rule.pattern && r.isRegex === rule.isRegex,
    );
    if (!alreadyExists) {
      rules.push(rule);
    }
  }

  const phoneticPairs = [...(settings.phoneticPairs ?? [])];
  for (const pair of preset.phoneticPairs) {
    const alreadyExists = phoneticPairs.some(
      p =>
        p.word === pair.word &&
        (p.matchMode ?? 'whole-word') === (pair.matchMode ?? 'whole-word'),
    );
    if (!alreadyExists) {
      phoneticPairs.push(pair);
    }
  }

  return { ...settings, rules, phoneticPairs };
}

// -----------------------------------------------------------------------------
// Import / Export (JSON)
// -----------------------------------------------------------------------------

export const TTS_CLEANUP_IMPORT_FORMAT = 'lnreader-tts-cleanup';
export const TTS_CLEANUP_IMPORT_VERSION = 1;

/** Serialize settings to a versioned JSON envelope for sharing/backup. */
export function serializeCleanupSettings(
  settings: TtsTextCleanupSettings,
): string {
  return JSON.stringify(
    {
      format: TTS_CLEANUP_IMPORT_FORMAT,
      version: TTS_CLEANUP_IMPORT_VERSION,
      settings,
    },
    null,
    2,
  );
}

export type CleanupImportResult =
  | { ok: true; settings: TtsTextCleanupSettings; summary: string }
  | { ok: false; error: string };

/**
 * Parse + validate an imported JSON payload (versioned envelope OR a bare
 * settings object). Rules/pairs are sanitized and get fresh ids; invalid
 * regexes and empty patterns are skipped (counted in the summary). Boolean
 * flags missing from the payload fall back to the current settings.
 */
export function parseCleanupSettingsImport(
  text: string,
  current: TtsTextCleanupSettings,
): CleanupImportResult {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: 'Invalid JSON — paste a valid TTS Text Cleanup export.',
    };
  }

  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return {
      ok: false,
      error: 'Unsupported format — expected a TTS Text Cleanup export object.',
    };
  }

  const raw = payload as Record<string, unknown>;
  const settingsRaw =
    raw.format === TTS_CLEANUP_IMPORT_FORMAT &&
    typeof raw.settings === 'object' &&
    raw.settings !== null
      ? (raw.settings as Record<string, unknown>)
      : raw;

  if (settingsRaw.rules !== undefined && !Array.isArray(settingsRaw.rules)) {
    return { ok: false, error: 'Import "rules" must be an array.' };
  }
  if (
    settingsRaw.phoneticPairs !== undefined &&
    !Array.isArray(settingsRaw.phoneticPairs)
  ) {
    return { ok: false, error: 'Import "phoneticPairs" must be an array.' };
  }

  const rules: TtsCleanupRule[] = [];
  let skippedRules = 0;
  for (const item of settingsRaw.rules ?? []) {
    const rule = sanitizeImportedRule(item);
    if (rule) {
      rules.push(rule);
    } else {
      skippedRules += 1;
    }
  }

  const phoneticPairs: TtsPhoneticPair[] = [];
  for (const item of settingsRaw.phoneticPairs ?? []) {
    const pair = sanitizeImportedPair(item);
    if (pair) {
      phoneticPairs.push(pair);
    }
  }

  const settings: TtsTextCleanupSettings = {
    enabled:
      typeof settingsRaw.enabled === 'boolean'
        ? settingsRaw.enabled
        : !!current.enabled,
    normalizeUnicode:
      typeof settingsRaw.normalizeUnicode === 'boolean'
        ? settingsRaw.normalizeUnicode
        : !!current.normalizeUnicode,
    rules,
    phoneticPairs,
  };

  const skippedNote =
    skippedRules > 0
      ? ` (${skippedRules} invalid rule${skippedRules === 1 ? '' : 's'} skipped)`
      : '';
  return {
    ok: true,
    settings,
    summary: `Imported ${rules.length} rule${rules.length === 1 ? '' : 's'}, ${phoneticPairs.length} phonetic pair${
      phoneticPairs.length === 1 ? '' : 's'
    }.${skippedNote}`,
  };
}

function sanitizeImportedRule(item: unknown): TtsCleanupRule | null {
  if (typeof item !== 'object' || item === null) {
    return null;
  }
  const raw = item as Record<string, unknown>;
  if (typeof raw.pattern !== 'string' || raw.pattern.length === 0) {
    return null;
  }
  const isRegex = raw.isRegex === true;
  const replacement =
    typeof raw.replacement === 'string' ? raw.replacement : '';
  let flags = typeof raw.flags === 'string' ? raw.flags : 'g';
  if (isRegex) {
    if (raw.pattern.length > TTS_CLEANUP_MAX_REGEX_LENGTH) {
      return null;
    }
    flags = normalizeRegExpFlags(flags);
    try {
      new RegExp(raw.pattern, flags);
    } catch {
      return null;
    }
  }
  return createTtsCleanupRule(
    raw.pattern,
    replacement,
    isRegex,
    flags,
    raw.enabled !== false,
  );
}

function sanitizeImportedPair(item: unknown): TtsPhoneticPair | null {
  if (typeof item !== 'object' || item === null) {
    return null;
  }
  const raw = item as Record<string, unknown>;
  if (typeof raw.word !== 'string' || raw.word.length === 0) {
    return null;
  }
  const pronunciation =
    typeof raw.pronunciation === 'string' ? raw.pronunciation : '';
  const matchMode = raw.matchMode === 'substring' ? 'substring' : 'whole-word';
  return createTtsPhoneticPair(
    raw.word,
    pronunciation,
    raw.enabled !== false,
    matchMode,
  );
}
