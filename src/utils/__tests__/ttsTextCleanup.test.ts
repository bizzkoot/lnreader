import {
  cleanTtsText,
  applyTtsTextCleanup,
  createTtsCleanupRule,
  createTtsPhoneticPair,
  normalizeUnicodeText,
  DEFAULT_TTS_CLEANUP_SETTINGS,
  TtsTextCleanupSettings,
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
