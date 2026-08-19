import {
  normalizeLibraryUpdateIntervalHours,
  SUPPORTED_LIBRARY_UPDATE_INTERVAL_HOURS,
} from '../useSettings';

// Persistence/default contract: AppSettings.automaticLibraryUpdateIntervalHours defaults to 0 (off)
// and any persisted unsupported value must normalize to 0.

describe('automaticLibraryUpdateIntervalHours persistence contract', () => {
  it('defaults to 0 (off) in SUPPORTED list', () => {
    expect(SUPPORTED_LIBRARY_UPDATE_INTERVAL_HOURS.includes(0 as any)).toBe(
      true,
    );
  });

  it('normalizes persisted unsupported values to 0 on load/write', () => {
    expect(normalizeLibraryUpdateIntervalHours(undefined)).toBe(0);
    expect(normalizeLibraryUpdateIntervalHours(null)).toBe(0);
    expect(normalizeLibraryUpdateIntervalHours(13)).toBe(0);
    expect(normalizeLibraryUpdateIntervalHours(99)).toBe(0);
    expect(normalizeLibraryUpdateIntervalHours('24' as any)).toBe(0);
  });

  it('preserves supported values through normalization', () => {
    for (const v of SUPPORTED_LIBRARY_UPDATE_INTERVAL_HOURS) {
      expect(normalizeLibraryUpdateIntervalHours(v)).toBe(v);
    }
  });
});
