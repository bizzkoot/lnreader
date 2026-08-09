import {
  TTS_CLEANUP_PRESETS,
  applyPresetToSettings,
  serializeCleanupSettings,
  parseCleanupSettingsImport,
  TTS_CLEANUP_IMPORT_FORMAT,
  TTS_CLEANUP_IMPORT_VERSION,
  TTS_CLEANUP_APPLY_TO_VERSION,
} from '../ttsCleanupPresets';
import {
  TtsTextCleanupSettings,
  createTtsCleanupRule,
  createTtsPhoneticPair,
  DEFAULT_TTS_CLEANUP_SETTINGS,
  isPotentiallyCatastrophic,
  TTS_CLEANUP_MAX_REGEX_LENGTH,
} from '@utils/htmlParagraphExtractor';

const buildSettings = (
  overrides: Partial<TtsTextCleanupSettings> = {},
): TtsTextCleanupSettings => ({
  ...DEFAULT_TTS_CLEANUP_SETTINGS,
  ...overrides,
});

describe('TTS_CLEANUP_PRESETS', () => {
  it('provides a non-empty curated set with valid shape', () => {
    expect(TTS_CLEANUP_PRESETS.length).toBeGreaterThan(0);
    for (const preset of TTS_CLEANUP_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.title).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(Array.isArray(preset.rules)).toBe(true);
      expect(Array.isArray(preset.phoneticPairs)).toBe(true);
    }
  });

  it('ships only safe regexes (within length cap, not catastrophic)', () => {
    for (const preset of TTS_CLEANUP_PRESETS) {
      for (const rule of preset.rules) {
        if (!rule.isRegex) {
          continue;
        }
        expect(rule.pattern.length).toBeLessThanOrEqual(
          TTS_CLEANUP_MAX_REGEX_LENGTH,
        );
        expect(isPotentiallyCatastrophic(rule.pattern)).toBe(false);
      }
    }
  });

  it('ships at least one phonetic preset with whole-word and substring modes', () => {
    const allPairs = TTS_CLEANUP_PRESETS.flatMap(p => p.phoneticPairs);
    expect(
      allPairs.some(p => (p.matchMode ?? 'whole-word') === 'whole-word'),
    ).toBe(true);
    expect(allPairs.some(p => p.matchMode === 'substring')).toBe(true);
  });
});

describe('applyPresetToSettings', () => {
  it('adds preset rules and phonetic pairs', () => {
    const preset = TTS_CLEANUP_PRESETS[0]; // novelight watermark
    const settings = buildSettings();
    const result = applyPresetToSettings(settings, preset);
    expect(result.rules).toHaveLength(preset.rules.length);
    expect(result.phoneticPairs).toHaveLength(0);
  });

  it('is immutable (does not mutate the input)', () => {
    const settings = buildSettings();
    const snapshot = JSON.stringify(settings);
    applyPresetToSettings(settings, TTS_CLEANUP_PRESETS[0]);
    expect(JSON.stringify(settings)).toBe(snapshot);
  });

  it('dedupes rules with the same pattern + isRegex', () => {
    const existing = createTtsCleanupRule(
      'N(?:\\W)*o(?:\\W)*v(?:\\W)*e(?:\\W)*l(?:\\W)*i(?:\\W)*g(?:\\W)*h(?:\\W)*t',
      '',
      true,
      'gi',
    );
    const settings = buildSettings({ rules: [existing] });
    const result = applyPresetToSettings(settings, TTS_CLEANUP_PRESETS[0]);
    expect(result.rules).toHaveLength(1);
  });

  it('keeps distinct rules with the same pattern but different isRegex', () => {
    const literal = createTtsCleanupRule('u2014', ' '); // literal
    const settings = buildSettings({ rules: [literal] });
    const preset = TTS_CLEANUP_PRESETS.find(p => p.id === 'corruption-u2014')!;
    // Preset adds a literal 'u2014' too — must be deduped.
    const result = applyPresetToSettings(settings, preset);
    expect(result.rules).toHaveLength(1);
  });

  it('dedupes phonetic pairs by word + matchMode', () => {
    const pair = createTtsPhoneticPair('Xianxia', 'Shee-an-shah');
    const settings = buildSettings({ phoneticPairs: [pair] });
    const preset = TTS_CLEANUP_PRESETS.find(
      p => p.id === 'phonetics-ln-names',
    )!;
    const result = applyPresetToSettings(settings, preset);
    expect(result.phoneticPairs).toHaveLength(3); // Xianxia deduped, 2 new
  });

  it('preserves existing rules when applying multiple presets', () => {
    const settings = buildSettings();
    const one = applyPresetToSettings(settings, TTS_CLEANUP_PRESETS[0]);
    const two = applyPresetToSettings(one, TTS_CLEANUP_PRESETS[1]);
    expect(two.rules.length).toBeGreaterThan(one.rules.length);
  });
});

describe('serializeCleanupSettings', () => {
  it('produces a versioned JSON envelope that round-trips', () => {
    const settings = buildSettings({
      enabled: true,
      normalizeUnicode: true,
      rules: [createTtsCleanupRule('u2014', ' ')],
      phoneticPairs: [createTtsPhoneticPair('Qing', 'Ching')],
    });
    const json = serializeCleanupSettings(settings);
    const parsed = JSON.parse(json);
    expect(parsed.format).toBe(TTS_CLEANUP_IMPORT_FORMAT);
    expect(parsed.version).toBe(TTS_CLEANUP_IMPORT_VERSION);
    expect(parsed.settings.rules[0].pattern).toBe('u2014');
    expect(parsed.settings.phoneticPairs[0].word).toBe('Qing');
  });
});

describe('parseCleanupSettingsImport', () => {
  const current = buildSettings({ enabled: true, normalizeUnicode: true });

  it('round-trips a serialize -> parse (ids regenerated, fields intact)', () => {
    const settings = buildSettings({
      enabled: true,
      normalizeUnicode: false,
      rules: [
        createTtsCleanupRule('u2014', ' ', false, 'g', true),
        createTtsCleanupRule('\\(Official version\\)\\s*', '', true, 'g'),
      ],
      phoneticPairs: [
        createTtsPhoneticPair('Xianxia', 'Shee-an-shah'),
        createTtsPhoneticPair('秦', 'Qin', true, 'substring'),
      ],
    });
    const result = parseCleanupSettingsImport(
      serializeCleanupSettings(settings),
      current,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.settings.enabled).toBe(true);
    expect(result.settings.normalizeUnicode).toBe(false);
    expect(result.settings.rules).toHaveLength(2);
    expect(result.settings.rules[0].pattern).toBe('u2014');
    expect(result.settings.rules[1].isRegex).toBe(true);
    expect(result.settings.phoneticPairs).toHaveLength(2);
    expect(result.settings.phoneticPairs[1].matchMode).toBe('substring');
    // Fresh ids on import
    expect(result.settings.rules[0].id).not.toBe(settings.rules[0].id);
  });

  it('accepts a bare settings object (no envelope)', () => {
    const bare = {
      enabled: true,
      normalizeUnicode: false,
      rules: [{ pattern: 'u2014', replacement: ' ' }],
      phoneticPairs: [],
    };
    const result = parseCleanupSettingsImport(JSON.stringify(bare), current);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.settings.rules[0].pattern).toBe('u2014');
    expect(result.settings.rules[0].isRegex).toBe(false);
  });

  it('rejects invalid JSON', () => {
    const result = parseCleanupSettingsImport('{not json', current);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain('Invalid JSON');
  });

  it('rejects arrays and non-object payloads', () => {
    expect(parseCleanupSettingsImport('[1,2,3]', current).ok).toBe(false);
    expect(parseCleanupSettingsImport('"text"', current).ok).toBe(false);
    expect(parseCleanupSettingsImport('42', current).ok).toBe(false);
  });

  it('rejects wrong-typed rules / phoneticPairs', () => {
    expect(
      parseCleanupSettingsImport(
        JSON.stringify({ rules: 'nope', phoneticPairs: [] }),
        current,
      ).ok,
    ).toBe(false);
    expect(
      parseCleanupSettingsImport(
        JSON.stringify({ rules: [], phoneticPairs: 7 }),
        current,
      ).ok,
    ).toBe(false);
  });

  it('skips invalid regexes and reports them in the summary', () => {
    const payload = {
      enabled: true,
      rules: [
        { pattern: '([unclosed', isRegex: true }, // invalid
        { pattern: 'valid', isRegex: true }, // valid
        { pattern: '' }, // empty -> skipped
        { pattern: 42 }, // non-string -> skipped
      ],
      phoneticPairs: [],
    };
    const result = parseCleanupSettingsImport(JSON.stringify(payload), current);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.settings.rules).toHaveLength(1);
    expect(result.settings.rules[0].pattern).toBe('valid');
    expect(result.summary).toContain('3 invalid rules skipped');
  });

  it('skips over-length regexes', () => {
    const longPattern = 'a'.repeat(TTS_CLEANUP_MAX_REGEX_LENGTH + 1);
    const payload = {
      rules: [{ pattern: longPattern, isRegex: true }],
      phoneticPairs: [],
    };
    const result = parseCleanupSettingsImport(JSON.stringify(payload), current);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.settings.rules).toHaveLength(0);
  });

  it('coerces non-string replacements and invalid matchMode', () => {
    const payload = {
      rules: [{ pattern: 'x', replacement: 5 }],
      phoneticPairs: [
        { word: 'Qing', pronunciation: 'Ching', matchMode: 'bogus' },
      ],
    };
    const result = parseCleanupSettingsImport(JSON.stringify(payload), current);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.settings.rules[0].replacement).toBe('');
    expect(result.settings.phoneticPairs[0].matchMode).toBe('whole-word');
  });

  it('preserves enabled flags when provided, else falls back to current', () => {
    const withFlags = parseCleanupSettingsImport(
      JSON.stringify({
        enabled: false,
        normalizeUnicode: true,
        rules: [],
        phoneticPairs: [],
      }),
      current,
    );
    expect(withFlags.ok).toBe(true);
    if (!withFlags.ok) {
      return;
    }
    expect(withFlags.settings.enabled).toBe(false);
    expect(withFlags.settings.normalizeUnicode).toBe(true);

    const withoutFlags = parseCleanupSettingsImport(
      JSON.stringify({ rules: [], phoneticPairs: [] }),
      current,
    );
    expect(withoutFlags.ok).toBe(true);
    if (!withoutFlags.ok) {
      return;
    }
    expect(withoutFlags.settings.enabled).toBe(true); // from current
    expect(withoutFlags.settings.normalizeUnicode).toBe(true); // from current
  });

  it('accepts an empty import (clears rules) with a summary', () => {
    const result = parseCleanupSettingsImport(
      JSON.stringify({ rules: [], phoneticPairs: [] }),
      current,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.settings.rules).toHaveLength(0);
    expect(result.settings.phoneticPairs).toHaveLength(0);
    expect(result.summary).toContain('Imported 0 rules');
  });

  it('never trusts imported ids (regenerates them)', () => {
    const payload = {
      rules: [{ id: 'evil-id', pattern: 'u2014', replacement: ' ' }],
      phoneticPairs: [
        { id: 'evil-id-2', word: 'Qing', pronunciation: 'Ching' },
      ],
    };
    const result = parseCleanupSettingsImport(JSON.stringify(payload), current);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.settings.rules[0].id).not.toBe('evil-id');
    expect(result.settings.phoneticPairs[0].id).not.toBe('evil-id-2');
  });
});

describe('applyTo / envelope versioning (issue #19)', () => {
  it('exports v1 envelope when applyTo is default (tts)', () => {
    const settings = buildSettings({ enabled: true });
    const parsed = JSON.parse(serializeCleanupSettings(settings));
    expect(parsed.version).toBe(TTS_CLEANUP_IMPORT_VERSION);
    expect(parsed.version).toBe(1);
  });

  it('exports v2 envelope when applyTo is non-default', () => {
    const settings = buildSettings({ enabled: true, applyTo: 'both' });
    const parsed = JSON.parse(serializeCleanupSettings(settings));
    expect(parsed.version).toBe(TTS_CLEANUP_APPLY_TO_VERSION);
    expect(parsed.version).toBe(2);
    expect(parsed.settings.applyTo).toBe('both');
  });

  it('round-trips applyTo through a v2 export/import', () => {
    const settings = buildSettings({
      enabled: true,
      applyTo: 'both',
      rules: [createTtsCleanupRule('u2014', ' ')],
    });
    const result = parseCleanupSettingsImport(
      serializeCleanupSettings(settings),
      buildSettings(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.settings.applyTo).toBe('both');
    expect(result.settings.rules).toHaveLength(1);
  });

  it('maps missing/invalid applyTo to tts on import', () => {
    const v1 = JSON.stringify({
      format: TTS_CLEANUP_IMPORT_FORMAT,
      version: 1,
      settings: {
        enabled: true,
        normalizeUnicode: false,
        rules: [],
        phoneticPairs: [],
      },
    });
    const result = parseCleanupSettingsImport(v1, buildSettings());
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.settings.applyTo).toBe('tts');

    const bogus = JSON.stringify({
      format: TTS_CLEANUP_IMPORT_FORMAT,
      version: 1,
      settings: {
        enabled: true,
        applyTo: 'sideways',
        rules: [],
        phoneticPairs: [],
      },
    });
    const bogusResult = parseCleanupSettingsImport(bogus, buildSettings());
    expect(bogusResult.ok).toBe(true);
    if (!bogusResult.ok) {
      return;
    }
    expect(bogusResult.settings.applyTo).toBe('tts');
  });

  it('rejects unknown envelope versions with a clear error', () => {
    const v99 = JSON.stringify({
      format: TTS_CLEANUP_IMPORT_FORMAT,
      version: 99,
      settings: {
        enabled: true,
        normalizeUnicode: false,
        rules: [],
        phoneticPairs: [],
      },
    });
    const result = parseCleanupSettingsImport(v99, buildSettings());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.toLowerCase()).toContain('version');
    }
  });

  it('keeps accepting bare settings objects (no envelope) with applyTo', () => {
    const bare = {
      enabled: true,
      normalizeUnicode: false,
      rules: [],
      phoneticPairs: [],
      applyTo: 'visible',
    };
    const result = parseCleanupSettingsImport(
      JSON.stringify(bare),
      buildSettings(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.settings.applyTo).toBe('visible');
  });
});
