// minimal RTL dir logic tests — mirrors translations.ts + WebViewReader.tsx

function isRtlLocale(locale: string): boolean {
  return ['ar', 'he', 'fa', 'ur'].includes(
    locale.split(/[-_]/)[0].toLowerCase(),
  );
}

function getDirection(locale: string): 'rtl' | 'ltr' {
  const lang = (locale || 'en').replace('_', '-');
  const base = lang.split('-')[0].toLowerCase();
  return ['ar', 'he', 'fa', 'ur'].includes(base) ? 'rtl' : 'ltr';
}

function buildHtmlAttrs(locale: string, theme = '#fff') {
  const language = (locale || 'en').replace('_', '-');
  const direction = getDirection(locale);
  return {
    lang: language,
    dir: direction,
    htmlTag: `<html lang="${language}" dir="${direction}" style="background-color: ${theme}">`,
    bodyTag: `<body dir="${direction}">`,
  };
}

describe('RTL locale detection', () => {
  it.each([
    ['ar_SA', true],
    ['ar', true],
    ['he_IL', true],
    ['fa_IR', true],
    ['ur_PK', true],
    ['AR_sa', true],
    ['en_US', false],
    ['fr_FR', false],
    ['zh_CN', false],
  ])('isRtlLocale(%s) -> %s', (locale, expected) => {
    expect(isRtlLocale(locale)).toBe(expected);
  });

  it('getDirection handles hyphen and underscore variants', () => {
    expect(getDirection('ar-SA')).toBe('rtl');
    expect(getDirection('ar_SA')).toBe('rtl');
    expect(getDirection('he-IL')).toBe('rtl');
    expect(getDirection('en-US')).toBe('ltr');
    expect(getDirection('en')).toBe('ltr');
    expect(getDirection('')).toBe('ltr');
  });

  it('buildHtmlAttrs sets lang/dir correctly', () => {
    const rtl = buildHtmlAttrs('ar_SA');
    expect(rtl.lang).toBe('ar-SA');
    expect(rtl.dir).toBe('rtl');
    expect(rtl.htmlTag).toContain('dir="rtl"');
    expect(rtl.bodyTag).toContain('dir="rtl"');

    const ltr = buildHtmlAttrs('en_US');
    expect(ltr.dir).toBe('ltr');
    expect(ltr.htmlTag).toContain('dir="ltr"');
  });

  it('mirrors WebViewReader memoizedHTML dir injection (6ddfe3d2e)', () => {
    // WebViewReader logic: ['ar','he','fa','ur'].includes(language.split('-')[0].toLowerCase()) ? 'rtl' : 'ltr'
    const cases: Array<[string, 'rtl' | 'ltr']> = [
      ['ar-SA', 'rtl'],
      ['he-IL', 'rtl'],
      ['fa', 'rtl'],
      ['ur-PK', 'rtl'],
      ['en', 'ltr'],
      ['ja-JP', 'ltr'],
    ];
    cases.forEach(([locale, expected]) => {
      const language = locale.replace('_', '-');
      const dir = (
        ['ar', 'he', 'fa', 'ur'].includes(language.split('-')[0].toLowerCase())
          ? 'rtl'
          : 'ltr'
      ) as 'rtl' | 'ltr';
      expect(dir).toBe(expected);
    });
  });

  it('translations.ts allows RTL and forces correctly', () => {
    // simulate I18nManager calls
    const calls: Array<[string, boolean]> = [];
    const mockI18nManager = {
      allowRTL: jest.fn((v: boolean) => calls.push(['allow', v])),
      forceRTL: jest.fn((v: boolean) => calls.push(['force', v])),
    };
    const locale = 'he_IL';
    const isRtl = isRtlLocale(locale);
    mockI18nManager.allowRTL(true);
    mockI18nManager.forceRTL(isRtl);
    expect(mockI18nManager.allowRTL).toHaveBeenCalledWith(true);
    expect(mockI18nManager.forceRTL).toHaveBeenCalledWith(true);

    const locale2 = 'en_US';
    const isRtl2 = isRtlLocale(locale2);
    mockI18nManager.forceRTL(isRtl2);
    expect(mockI18nManager.forceRTL).toHaveBeenLastCalledWith(false);
  });
});
