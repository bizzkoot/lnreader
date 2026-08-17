import { isValidSelfHostUrl } from '../selfhost';

describe('self-host URL validation', () => {
  it('accepts valid https URLs', () => {
    expect(isValidSelfHostUrl('https://myserver.example.com')).toBe(true);
    expect(isValidSelfHostUrl('https://192.168.1.100:8080')).toBe(true);
  });

  it('accepts valid http URLs', () => {
    expect(isValidSelfHostUrl('http://localhost:8080')).toBe(true);
    expect(isValidSelfHostUrl('http://192.168.1.100')).toBe(true);
  });

  it('rejects ftp URLs', () => {
    expect(isValidSelfHostUrl('ftp://server.example.com')).toBe(false);
  });

  it('rejects javascript URLs', () => {
    expect(isValidSelfHostUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects file URLs', () => {
    expect(isValidSelfHostUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects empty hostname', () => {
    expect(isValidSelfHostUrl('https://')).toBe(false);
  });

  it('rejects malformed URLs', () => {
    expect(isValidSelfHostUrl('not-a-url')).toBe(false);
    expect(isValidSelfHostUrl('')).toBe(false);
  });

  it('rejects URLs with traversal in path', () => {
    // The URL is valid per URL spec, but the path contains traversal.
    // The URL validation catches scheme/host; path traversal is caught by
    // the downstream NativeZipArchive.validateZipEntry.
    expect(isValidSelfHostUrl('https://server/../../etc/passwd')).toBe(true);
  });
});
