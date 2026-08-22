import {
  decodePath,
  normalizePath,
  basename,
  createAssetNameMap,
  rewriteAssetReferences,
} from '../import';

// Heavy IO dependencies of import.ts are not exercised here — only the pure
// asset-mapping/rewriting helpers. Provide minimal mocks so the module loads.
jest.mock('@database/db', () => ({
  db: {
    runAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 1 })),
    withExclusiveTransactionAsync: jest.fn(),
  },
}));

jest.mock('@database/queries/NovelQueries', () => ({
  updateNovelCategoryById: jest.fn(),
  updateNovelInfo: jest.fn(),
}));

jest.mock('@plugins/pluginManager', () => ({
  LOCAL_PLUGIN_ID: 'local',
}));

jest.mock('@services/ServiceManager', () => ({
  __esModule: true,
  default: { manager: { addTask: jest.fn() } },
}));

jest.mock('@utils/Storages', () => ({
  NOVEL_STORAGE: 'file://novels',
}));

jest.mock('@strings/translations', () => ({
  getString: jest.fn(key => key),
}));

describe('decodePath', () => {
  it('decodes percent-encoded path segments', () => {
    expect(decodePath('chapters/Chapter%201.xhtml')).toBe(
      'chapters/Chapter 1.xhtml',
    );
    expect(decodePath('images/My%20Image.png')).toBe('images/My Image.png');
  });

  it('leaves non-encoded and malformed strings intact', () => {
    expect(decodePath('images/plain.png')).toBe('images/plain.png');
    expect(decodePath('bad%zz')).toBe('bad%zz');
  });
});

describe('normalizePath', () => {
  it('collapses dot segments and backslashes', () => {
    expect(normalizePath('/OEBPS/styles/../images/bg.png')).toBe(
      'OEBPS/images/bg.png',
    );
    expect(normalizePath('a\\b\\c.png')).toBe('a/b/c.png');
    expect(normalizePath('./x/./y.png')).toBe('x/y.png');
  });
});

describe('basename', () => {
  it('returns the final path segment for both separators', () => {
    expect(basename('/OEBPS/images/cover.png')).toBe('cover.png');
    expect(basename('OEBPS\\images\\cover.png')).toBe('cover.png');
    expect(basename('cover.png')).toBe('cover.png');
  });
});

describe('createAssetNameMap', () => {
  it('suffixes colliding basenames while preserving extensions', () => {
    const map = createAssetNameMap([
      'book/OEBPS/images/a/cover.png',
      'book/OEBPS/images/b/cover.png',
      'book/OEBPS/images/a/style.css',
      'book/OEBPS/images/b/style.css',
    ]);

    expect(map.get('book/OEBPS/images/a/cover.png')).toBe('cover.png');
    expect(map.get('book/OEBPS/images/b/cover.png')).toBe('cover-2.png');
    expect(map.get('book/OEBPS/images/a/style.css')).toBe('style.css');
    expect(map.get('book/OEBPS/images/b/style.css')).toBe('style-2.css');
  });

  it('uses normalized decoded paths as keys', () => {
    const map = createAssetNameMap([
      'book/OEBPS/images/My%20Image.png',
      'book/OEBPS/../OEBPS/images/dup.png',
    ]);

    expect(map.get('book/OEBPS/images/My Image.png')).toBe('My Image.png');
    expect(map.get('book/OEBPS/images/dup.png')).toBe('dup.png');
  });

  it('dedupes identical source paths', () => {
    const map = createAssetNameMap([
      'book/OEBPS/images/a.png',
      'book/OEBPS/images/a.png',
    ]);

    expect(map.size).toBe(1);
    expect(map.get('book/OEBPS/images/a.png')).toBe('a.png');
  });
});

describe('rewriteAssetReferences', () => {
  const assetNames = new Map([
    ['book/OEBPS/images/bg.png', 'bg.png'],
    ['book/OEBPS/images/photo.jpg', 'photo.jpg'],
    ['book/OEBPS/images/My Image.png', 'My-Image.png'],
  ]);

  it('rewrites relative url() references to the flattened file path', () => {
    const css = "body { background: url('../images/bg.png'); }";
    const out = rewriteAssetReferences(
      css,
      '/book/OEBPS/styles/main.css',
      '/novels/7',
      assetNames,
      /url\(\s*(["']?)([^)]*?)\1\s*\)/gi,
    );

    expect(out).toBe(
      "body { background: url('../images/bg.png'); }".replace(
        "'../images/bg.png'",
        "'file:///novels/7/bg.png'",
      ),
    );
  });

  it('preserves query/fragment suffixes on rewritten references', () => {
    const css = "img { src: url('../images/photo.jpg?w=100#crop'); }";
    const out = rewriteAssetReferences(
      css,
      '/book/OEBPS/styles/main.css',
      '/novels/7',
      assetNames,
      /url\(\s*(["']?)([^)]*?)\1\s*\)/gi,
    );

    expect(out).toContain("url('file:///novels/7/photo.jpg?w=100#crop')");
  });

  it('decodes percent-encoded references before lookup', () => {
    const css = "a { background: url('../images/My%20Image.png'); }";
    const out = rewriteAssetReferences(
      css,
      '/book/OEBPS/styles/main.css',
      '/novels/7',
      assetNames,
      /url\(\s*(["']?)([^)]*?)\1\s*\)/gi,
    );

    expect(out).toContain("url('file:///novels/7/My-Image.png')");
  });

  it('leaves data: and absolute URLs untouched', () => {
    const css =
      'a { background: url(data:image/png;base64,AAAA); }' +
      "b { background: url('https://cdn.example.com/x.png'); }";
    const out = rewriteAssetReferences(
      css,
      '/book/OEBPS/styles/main.css',
      '/novels/7',
      assetNames,
      /url\(\s*(["']?)([^)]*?)\1\s*\)/gi,
    );

    expect(out).toBe(css);
  });

  it('leaves fragment-only and unmapped references untouched', () => {
    const css =
      "a { background: url('#sprite'); }" +
      "b { background: url('images/missing.png'); }";
    const out = rewriteAssetReferences(
      css,
      '/book/OEBPS/styles/main.css',
      '/novels/7',
      assetNames,
      /url\(\s*(["']?)([^)]*?)\1\s*\)/gi,
    );

    expect(out).toBe(css);
  });

  it('handles unquoted url() references', () => {
    const css = 'body { background: url(../images/bg.png); }';
    const out = rewriteAssetReferences(
      css,
      '/book/OEBPS/styles/main.css',
      '/novels/7',
      assetNames,
      /url\(\s*(["']?)([^)]*?)\1\s*\)/gi,
    );

    expect(out).toContain('url(file:///novels/7/bg.png)');
  });
});
