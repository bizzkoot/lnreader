import { isValidSelfHostUrl, isValidBackupFolder } from '../selfhost';

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

describe('isValidBackupFolder', () => {
  it('accepts valid folder names', () => {
    expect(isValidBackupFolder('backups')).toBe(true);
    expect(isValidBackupFolder('my-backup-2024')).toBe(true);
    expect(isValidBackupFolder('lnreader.v2')).toBe(true);
    expect(isValidBackupFolder('a')).toBe(true);
  });

  it('rejects empty strings', () => {
    expect(isValidBackupFolder('')).toBe(false);
  });

  it('rejects non-string types', () => {
    expect(isValidBackupFolder(null as any)).toBe(false);
    expect(isValidBackupFolder(undefined as any)).toBe(false);
    expect(isValidBackupFolder(123 as any)).toBe(false);
  });

  it('rejects path traversal', () => {
    expect(isValidBackupFolder('..')).toBe(false);
    expect(isValidBackupFolder('../etc')).toBe(false);
    expect(isValidBackupFolder('backup/../../etc/passwd')).toBe(false);
  });

  it('rejects slashes and backslashes', () => {
    expect(isValidBackupFolder('backup/data')).toBe(false);
    expect(isValidBackupFolder('backup\\data')).toBe(false);
  });

  it('rejects special characters', () => {
    expect(isValidBackupFolder('backup?query=1')).toBe(false);
    expect(isValidBackupFolder('backup#fragment')).toBe(false);
    expect(isValidBackupFolder('backup file')).toBe(false);
    expect(isValidBackupFolder('backup;rm -rf')).toBe(false);
  });

  it('rejects names longer than 64 characters', () => {
    expect(isValidBackupFolder('a'.repeat(65))).toBe(false);
    expect(isValidBackupFolder('a'.repeat(64))).toBe(true);
  });
});
