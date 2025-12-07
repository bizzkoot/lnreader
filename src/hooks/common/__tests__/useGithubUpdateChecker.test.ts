import { pickApkAsset } from '../githubReleaseUtils';

describe('pickApkAsset', () => {
  test('selects first .apk asset when present', () => {
    const assets = [
      { name: 'release-notes.txt', browser_download_url: 'https://example.com/text' },
      { name: 'LNReader-arm64.apk', browser_download_url: 'https://example.com/arm64.apk' },
    ];

    expect(pickApkAsset(assets)).toBe('https://example.com/arm64.apk');
  });

  test('prefers arm64/universal when multiple apk candidates exist', () => {
    const assets = [
      { name: 'LNReader-x86.apk', browser_download_url: 'https://example.com/x86.apk' },
      { name: 'LNReader-arm64.apk', browser_download_url: 'https://example.com/arm64.apk' },
      { name: 'LNReader-universal.apk', browser_download_url: 'https://example.com/universal.apk' },
    ];

    expect(pickApkAsset(assets)).toBe('https://example.com/arm64.apk');
  });

  test('falls back to first asset when no apk is present but content_type indicates android', () => {
    const assets = [
      { name: 'binary.pkg', content_type: 'application/vnd.android.package-archive', browser_download_url: 'https://example.com/pkg' },
      { name: 'other.bin', browser_download_url: 'https://example.com/other' },
    ];

    expect(pickApkAsset(assets)).toBe('https://example.com/pkg');
  });

  test('returns undefined when no assets', () => {
    expect(pickApkAsset(undefined)).toBeUndefined();
    expect(pickApkAsset([])).toBeUndefined();
  });
});
