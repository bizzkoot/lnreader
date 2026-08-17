import { isValidPluginId } from '../pluginManager';

describe('isValidPluginId', () => {
  it('accepts valid alphanumeric plugin IDs', () => {
    expect(isValidPluginId('novelhost')).toBe(true);
    expect(isValidPluginId('my.source1')).toBe(true);
    expect(isValidPluginId('com.example-v2')).toBe(true);
    expect(isValidPluginId('a')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidPluginId('')).toBe(false);
  });

  it('rejects non-string types', () => {
    expect(isValidPluginId(null)).toBe(false);
    expect(isValidPluginId(undefined)).toBe(false);
    expect(isValidPluginId(123)).toBe(false);
  });

  it('rejects traversal sequences', () => {
    expect(isValidPluginId('..')).toBe(false);
    expect(isValidPluginId('../etc')).toBe(false);
    expect(isValidPluginId('plugin/..')).toBe(false);
  });

  it('rejects path separators', () => {
    expect(isValidPluginId('plugin/sub')).toBe(false);
    expect(isValidPluginId('plugin\\sub')).toBe(false);
  });

  it('rejects special characters', () => {
    expect(isValidPluginId('plugin name')).toBe(false);
    expect(isValidPluginId('plugin;rm -rf')).toBe(false);
    expect(isValidPluginId('plugin/null')).toBe(false);
    expect(isValidPluginId('plugin\x00')).toBe(false);
  });

  it('rejects IDs longer than 64 characters', () => {
    expect(isValidPluginId('a'.repeat(65))).toBe(false);
    expect(isValidPluginId('a'.repeat(64))).toBe(true);
  });
});
