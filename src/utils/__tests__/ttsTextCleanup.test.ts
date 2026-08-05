import {
  cleanTtsText,
  applyTtsTextCleanup,
  cleanVisibleText,
  shouldCleanVisibleText,
  VISIBLE_PAD_CHAR,
  createTtsCleanupRule,
  createTtsPhoneticPair,
  normalizeUnicodeText,
  DEFAULT_TTS_CLEANUP_SETTINGS,
  TtsTextCleanupSettings,
  TTS_CLEANUP_MAX_REGEX_LENGTH,
  isPotentiallyCatastrophic,
  normalizeRegExpFlags,
} from '../htmlParagraphExtractor';

const buildSettings = (
  overrides: Partial<TtsTextCleanupSettings> = {},
): TtsTextCleanupSettings => ({
  ...DEFAULT_TTS_CLEANUP_SETTINGS,
  ...overrides,
});

describe('cleanTtsText', () => {
  it('returns text unchanged when cleanup is disabled', () => {
    const settings = buildSettings({ enabled: false });
    expect(cleanTtsText('Some text with u2014 watermark', settings)).toBe(
      'Some text with u2014 watermark',
    );
  });

  it('returns text unchanged when settings are undefined/null', () => {
    expect(cleanTtsText('Hello', undefined)).toBe('Hello');
    expect(cleanTtsText('Hello', null)).toBe('Hello');
  });

  it('returns empty text unchanged', () => {
    const settings = buildSettings({ enabled: true });
    expect(cleanTtsText('', settings)).toBe('');
  });

  it('returns text unchanged when there are no enabled rules', () => {
    const settings = buildSettings({
      enabled: true,
      rules: [createTtsCleanupRule('a', 'b', false, 'g', false)],
    });
    expect(cleanTtsText('alpha', settings)).toBe('alpha');
  });

  it('applies a literal find/replace rule to all occurrences', () => {
    const settings = buildSettings({
      enabled: true,
      rules: [createTtsCleanupRule('u2014', ' ')],
    });
    expect(cleanTtsText('The u2014 corrupted u2014 text', settings)).toBe(
      'The   corrupted   text',
    );
  });

  it('applies a regex rule with flags', () => {
    const settings = buildSettings({
      enabled: true,
      rules: [
        createTtsCleanupRule('(Do not rehost this novel)+', '', true, 'gi'),
      ],
    });
    expect(
      cleanTtsText('do not rehost this novel This is the story.', settings),
    ).toBe(' This is the story.');
  });

  it('strips matched spans with an empty replacement', () => {
    const settings = buildSettings({
      enabled: true,
      rules: [createTtsCleanupRule('\\(Official version\\)\\s*', '', true)],
    });
    expect(
      cleanTtsText(
        'Chapter 1 (Official version) The journey begins.',
        settings,
      ),
    ).toBe('Chapter 1 The journey begins.');
  });

  it('handles the author-style watermark regex tolerant of spacing', () => {
    const settings = buildSettings({
      enabled: true,
      rules: [
        createTtsCleanupRule(
          'N(?:\\W)*o(?:\\W)*v(?:\\W)*e(?:\\W)*l(?:\\W)*i(?:\\W)*g(?:\\W)*h(?:\\W)*t',
          '',
          true,
          'gi',
        ),
      ],
    });
    expect(
      cleanTtsText('Read on N o v e l i g h t for the full version', settings),
    ).toBe('Read on  for the full version');
  });

  it('skips invalid regex rules without throwing', () => {
    const settings = buildSettings({
      enabled: true,
      rules: [
        createTtsCleanupRule('([unclosed', 'x', true),
        createTtsCleanupRule('valid', 'replaced', true),
      ],
    });
    expect(cleanTtsText('valid text', settings)).toBe('replaced text');
  });

  it('normalizes unicode (NFD + strips combining marks)', () => {
    expect(normalizeUnicodeText('cafe\u0301')).toBe('cafe');
    const settings = buildSettings({ enabled: true, normalizeUnicode: true });
    expect(cleanTtsText('Zoë went to café\u0301', settings)).toBe(
      'Zoe went to cafe',
    );
  });

  it('maps unicode lookalike characters via user rules', () => {
    const settings = buildSettings({
      enabled: true,
      normalizeUnicode: true,
      rules: [
        createTtsCleanupRule('\u{1D40D}', 'N'), // mathematical bold N
        createTtsCleanupRule('\u{1D4DD}', 'N'), // mathematical script N
      ],
    });
    expect(cleanTtsText('\u{1D40D}ovelight \u{1D4DD}ovel', settings)).toBe(
      'Novelight Novel',
    );
  });

  it('applies phonetic whole-word swaps', () => {
    const settings = buildSettings({
      enabled: true,
      phoneticPairs: [
        createTtsPhoneticPair('Xianxia', 'Shee-an-shah'),
        createTtsPhoneticPair('Qing', 'Ching'),
      ],
    });
    expect(
      cleanTtsText('He cultivates Xianxia in the Qing mountains', settings),
    ).toBe('He cultivates Shee-an-shah in the Ching mountains');
  });

  it('does not swap phonetic words inside larger words', () => {
    const settings = buildSettings({
      enabled: true,
      phoneticPairs: [createTtsPhoneticPair('Ainz', 'Ownz')],
    });
    // 'Ainz' at start, standalone, followed by punctuation, and inside a word
    expect(cleanTtsText('Ainz Ooal Gown ainz, Ainzura', settings)).toBe(
      'Ownz Ooal Gown ainz, Ainzura',
    );
  });

  it('substring match mode replaces adjacent CJK occurrences', () => {
    const settings = buildSettings({
      enabled: true,
      phoneticPairs: [
        createTtsPhoneticPair('秦', 'Qin', true, 'substring'),
        createTtsPhoneticPair('卿', 'Qing', true, 'substring'),
      ],
    });
    // Whole-word mode would no-op here (adjacent CJK are both \p{L});
    // substring mode replaces every occurrence.
    expect(cleanTtsText('秦国 大秦 卿卿', settings)).toBe(
      'Qin国 大Qin QingQing',
    );
  });

  it('defaults to whole-word mode when matchMode is absent', () => {
    const pair = createTtsPhoneticPair('秦', 'Qin');
    expect(pair.matchMode).toBe('whole-word');
    const settings = buildSettings({
      enabled: true,
      phoneticPairs: [pair],
    });
    // Legacy pair without matchMode behaves as before (no CJK adjacency hit)
    expect(cleanTtsText('秦国', settings)).toBe('秦国');
  });

  it('applies rules before phonetic swaps (pipeline order)', () => {
    const settings = buildSettings({
      enabled: true,
      rules: [createTtsCleanupRule('Mr. Qing', 'Qing')],
      phoneticPairs: [createTtsPhoneticPair('Qing', 'Ching')],
    });
    expect(cleanTtsText('Mr. Qing arrived', settings)).toBe('Ching arrived');
  });

  it('supports regex flags on phonetic-independent rules only', () => {
    const settings = buildSettings({
      enabled: true,
      rules: [createTtsCleanupRule('^\\[TTS\\]\\s*', '', true)],
    });
    expect(cleanTtsText('[TTS] Once upon a time', settings)).toBe(
      'Once upon a time',
    );
  });
});

describe('isPotentiallyCatastrophic', () => {
  it('detects known exponential-backtracking shapes', () => {
    expect(isPotentiallyCatastrophic('(a+)+')).toBe(true);
    expect(isPotentiallyCatastrophic('(?:a*)*')).toBe(true);
    expect(isPotentiallyCatastrophic('(?:a?)+')).toBe(true);
    expect(isPotentiallyCatastrophic('(?:a+){2,}')).toBe(true);
    expect(isPotentiallyCatastrophic('(a|a)+')).toBe(true);
    expect(isPotentiallyCatastrophic('(?:x|x)+')).toBe(true);
    expect(isPotentiallyCatastrophic('(?:a+){2,10}')).toBe(true);
  });

  it('does not flag common safe patterns', () => {
    // The author's watermark fragment + full pattern from the issue thread
    expect(isPotentiallyCatastrophic('(?:\\W)*')).toBe(false);
    expect(
      isPotentiallyCatastrophic(
        'N(?:\\W)*o(?:\\W)*v(?:\\W)*e(?:\\W)*l(?:\\W)*i(?:\\W)*g(?:\\W)*h(?:\\W)*t',
      ),
    ).toBe(false);
    // Existing test patterns
    expect(isPotentiallyCatastrophic('(Do not rehost this novel)+')).toBe(
      false,
    );
    expect(isPotentiallyCatastrophic('\\(Official version\\)\\s*')).toBe(false);
    expect(isPotentiallyCatastrophic('(?:ab)+')).toBe(false);
    expect(isPotentiallyCatastrophic('[0-9]+')).toBe(false);
    expect(isPotentiallyCatastrophic('^[a-z0-9_]+(?:[.-][a-z0-9_]+)*$')).toBe(
      false,
    );
    expect(isPotentiallyCatastrophic('(?:\\W|\\d)+')).toBe(false);
    expect(isPotentiallyCatastrophic('(?:ab){2,4}')).toBe(false);
    expect(isPotentiallyCatastrophic('(?:x){2,}')).toBe(false);
    expect(isPotentiallyCatastrophic('a+b+')).toBe(false);
  });
});

describe('normalizeRegExpFlags', () => {
  it('always includes g and dedupes duplicates', () => {
    expect(normalizeRegExpFlags('')).toBe('g');
    expect(normalizeRegExpFlags('gg')).toBe('g');
    expect(normalizeRegExpFlags('gi')).toBe('gi');
    expect(normalizeRegExpFlags('xgi')).toBe('gi');
  });

  it('drops the sticky y flag so mid-string matches work', () => {
    expect(normalizeRegExpFlags('y')).toBe('g');
    expect(normalizeRegExpFlags('iy')).toBe('ig');
  });
});

describe('cleanTtsText hardening', () => {
  it('skips regex rules exceeding the length cap', () => {
    const longPattern = 'a'.repeat(TTS_CLEANUP_MAX_REGEX_LENGTH + 1);
    const settings = buildSettings({
      enabled: true,
      rules: [
        createTtsCleanupRule(longPattern, 'x', true),
        createTtsCleanupRule('u2014', ' '),
      ],
    });
    expect(cleanTtsText('hello u2014 world', settings)).toBe('hello   world');
  });

  it('skips a catastrophic regex rule without breaking later rules', () => {
    const settings = buildSettings({
      enabled: true,
      rules: [
        createTtsCleanupRule('(a+)+', 'x', true), // skipped (unsafe)
        createTtsCleanupRule('u2014', ' '), // still applied
      ],
    });
    expect(cleanTtsText('aaaa u2014 text', settings)).toBe('aaaa   text');
  });

  it('treats regex replacement text literally ($& stays literal)', () => {
    const settings = buildSettings({
      enabled: true,
      rules: [createTtsCleanupRule('\\d+', '$&', true)],
    });
    expect(cleanTtsText('price 5', settings)).toBe('price $&');
  });

  it('sticky y flags behave like a global scan (mid-string match)', () => {
    const settings = buildSettings({
      enabled: true,
      rules: [createTtsCleanupRule('world', 'replaced', true, 'y')],
    });
    expect(cleanTtsText('hello world', settings)).toBe('hello replaced');
  });

  it('matches precomposed literal patterns against normalized text', () => {
    const settings = buildSettings({
      enabled: true,
      normalizeUnicode: true,
      rules: [createTtsCleanupRule('é', 'x')],
    });
    // Text is NFD-normalized first (café -> cafe'), so the precomposed
    // 'é' pattern must be normalized too before matching.
    expect(cleanTtsText('café', settings)).toBe('cafx');
  });

  it('leaves text unchanged when a non-string reaches the pipeline', () => {
    const settings = buildSettings({ enabled: true });
    // Cast: not reachable from extractParagraphs, but a cheap runtime guard.
    expect(cleanTtsText(42 as unknown as string, settings)).toBe(42);
  });
});

describe('applyTtsTextCleanup', () => {
  const settings = buildSettings({
    enabled: true,
    rules: [createTtsCleanupRule('u2014', ' ')],
  });

  it('cleans every paragraph', () => {
    const paragraphs = ['a u2014 b', 'c u2014 d'];
    expect(applyTtsTextCleanup(paragraphs, settings)).toEqual([
      'a   b',
      'c   d',
    ]);
  });

  it('is length-preserving (never drops or merges paragraphs)', () => {
    const paragraphs = ['u2014 only', '', 'text', 'u2014', 'last'];
    const result = applyTtsTextCleanup(paragraphs, settings);
    expect(result).toHaveLength(paragraphs.length);
  });

  it('returns the same array instance when disabled', () => {
    const paragraphs = ['a', 'b'];
    const disabled = buildSettings({ enabled: false });
    expect(applyTtsTextCleanup(paragraphs, disabled)).toBe(paragraphs);
  });

  it('handles undefined/null input', () => {
    expect(applyTtsTextCleanup(undefined, settings)).toBeUndefined();
    expect(applyTtsTextCleanup(null, settings)).toBeNull();
  });

  it('returns empty array unchanged', () => {
    expect(applyTtsTextCleanup([], settings)).toEqual([]);
  });
});

describe('cleanVisibleText (issue #19 visible-text cleanup)', () => {
  it('applies RULES ONLY — phonetic pairs and normalizeUnicode stay TTS-only', () => {
    const settings = buildSettings({
      enabled: true,
      applyTo: 'both',
      normalizeUnicode: true,
      rules: [createTtsCleanupRule('u2014', ' ')],
      phoneticPairs: [createTtsPhoneticPair('Xianxia', 'Shee-an-shah')],
    });
    // 'é' would NFD-normalize to 'e' and 'Xianxia' would be swapped by the
    // TTS-only phonetic pass — neither may touch visible text.
    const texts = ['u2014 hello', 'Xianxia é'];
    expect(cleanVisibleText(texts, settings)).toEqual(['  hello', 'Xianxia é']);
  });

  it('is count-preserving: pads paragraphs a rule would empty', () => {
    const settings = buildSettings({
      enabled: true,
      applyTo: 'both',
      rules: [
        createTtsCleanupRule('\\s*\\(Official version\\)\\s*', '', true, 'g'),
      ],
    });
    const result = cleanVisibleText(['(Official version)', 'keep'], settings)!;
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(VISIBLE_PAD_CHAR);
    expect(result[1]).toBe('keep');
    // Padded element stays "readable": trim() of ZWSP is non-empty.
    expect(result[0].trim().length).toBeGreaterThan(0);
  });

  it('no-ops when applyTo is tts or missing (default)', () => {
    const texts = ['a', 'b'];
    const ttsOnly = buildSettings({
      enabled: true,
      applyTo: 'tts',
      rules: [createTtsCleanupRule('a', 'b')],
    });
    expect(cleanVisibleText(texts, ttsOnly)).toBe(texts);
    const missing = buildSettings({
      enabled: true,
      rules: [createTtsCleanupRule('a', 'b')],
    });
    expect(cleanVisibleText(texts, missing)).toBe(texts);
  });

  it('no-ops when disabled or when only phonetic pairs exist', () => {
    const texts = ['a'];
    expect(
      cleanVisibleText(
        texts,
        buildSettings({ enabled: false, applyTo: 'both' }),
      ),
    ).toBe(texts);
    const phoneticsOnly = buildSettings({
      enabled: true,
      applyTo: 'both',
      phoneticPairs: [createTtsPhoneticPair('Xianxia', 'Shee-an-shah')],
    });
    expect(cleanVisibleText(texts, phoneticsOnly)).toBe(texts);
  });

  it('handles undefined/null input', () => {
    const settings = buildSettings({
      enabled: true,
      applyTo: 'both',
      rules: [createTtsCleanupRule('a', 'b')],
    });
    expect(cleanVisibleText(undefined, settings)).toBeUndefined();
    expect(cleanVisibleText(null, settings)).toBeNull();
  });

  it('reuses regex guardrails — invalid regex skipped silently', () => {
    const settings = buildSettings({
      enabled: true,
      applyTo: 'both',
      rules: [
        createTtsCleanupRule('(unclosed', '', true, 'g'),
        createTtsCleanupRule('u2014', ' '),
      ],
    });
    expect(cleanVisibleText(['unclosed u2014'], settings)).toEqual([
      'unclosed  ',
    ]);
  });
});

describe('applyTo gating (issue #19)', () => {
  it("'visible' mode: TTS pipeline no-ops, visible pipeline active", () => {
    const settings = buildSettings({
      enabled: true,
      applyTo: 'visible',
      rules: [createTtsCleanupRule('u2014', ' ')],
    });
    expect(cleanTtsText('u2014 x', settings)).toBe('u2014 x');
    expect(applyTtsTextCleanup(['u2014 x'], settings)).toEqual(['u2014 x']);
    expect(cleanVisibleText(['u2014 x'], settings)).toEqual(['  x']);
  });

  it("'both' mode: TTS pipeline AND visible pipeline active", () => {
    const settings = buildSettings({
      enabled: true,
      applyTo: 'both',
      rules: [createTtsCleanupRule('u2014', ' ')],
    });
    expect(cleanTtsText('u2014 x', settings)).toBe('  x');
    expect(applyTtsTextCleanup(['u2014 x'], settings)).toEqual(['  x']);
    expect(cleanVisibleText(['u2014 x'], settings)).toEqual(['  x']);
  });

  it("'tts' (default) keeps historical behavior", () => {
    const settings = buildSettings({
      enabled: true,
      rules: [createTtsCleanupRule('u2014', ' ')],
    });
    expect(cleanTtsText('u2014 x', settings)).toBe('  x');
    expect(cleanVisibleText(['u2014 x'], settings)).toEqual(['u2014 x']);
  });

  it('shouldCleanVisibleText reflects the target mode', () => {
    expect(
      shouldCleanVisibleText(buildSettings({ enabled: true, applyTo: 'both' })),
    ).toBe(true);
    expect(
      shouldCleanVisibleText(
        buildSettings({ enabled: true, applyTo: 'visible' }),
      ),
    ).toBe(true);
    expect(
      shouldCleanVisibleText(buildSettings({ enabled: true, applyTo: 'tts' })),
    ).toBe(false);
    expect(shouldCleanVisibleText(buildSettings({ enabled: true }))).toBe(
      false,
    );
    expect(
      shouldCleanVisibleText(
        buildSettings({ enabled: false, applyTo: 'both' }),
      ),
    ).toBe(false);
    expect(shouldCleanVisibleText(undefined)).toBe(false);
  });
});
