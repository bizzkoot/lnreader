import { buildEpubExportOptions } from '../ExportEpubOptions';

describe('buildEpubExportOptions', () => {
  it('maps live toggle values into the export options payload', () => {
    const options = buildEpubExportOptions({
      useAppTheme: true,
      useCustomCSS: false,
      useCustomJS: true,
      includeChapterNumber: false,
    });

    expect(options).toEqual({
      epubUseAppTheme: true,
      epubUseCustomCSS: false,
      epubUseCustomJS: true,
      epubIncludeChapterNumber: false,
    });
  });

  it('carries false values through (no truthy defaulting)', () => {
    const options = buildEpubExportOptions({
      useAppTheme: false,
      useCustomCSS: false,
      useCustomJS: false,
      includeChapterNumber: false,
    });

    expect(options).toEqual({
      epubUseAppTheme: false,
      epubUseCustomCSS: false,
      epubUseCustomJS: false,
      epubIncludeChapterNumber: false,
    });
  });

  it('propagates every toggle when all are enabled', () => {
    const options = buildEpubExportOptions({
      useAppTheme: true,
      useCustomCSS: true,
      useCustomJS: true,
      includeChapterNumber: true,
    });

    expect(options).toEqual({
      epubUseAppTheme: true,
      epubUseCustomCSS: true,
      epubUseCustomJS: true,
      epubIncludeChapterNumber: true,
    });
  });

  it('produces a complete payload every call (all four keys present)', () => {
    const options = buildEpubExportOptions({
      useAppTheme: true,
      useCustomCSS: false,
      useCustomJS: false,
      includeChapterNumber: true,
    });

    expect(Object.keys(options).sort()).toEqual([
      'epubIncludeChapterNumber',
      'epubUseAppTheme',
      'epubUseCustomCSS',
      'epubUseCustomJS',
    ]);
  });
});
