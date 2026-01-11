import {
  DoHProvider,
  DoHProviderNames,
  DoHProviderDescriptions,
} from '../DoHManager';

// This test file only tests the TypeScript enums and constants
// Native module integration is tested manually in Session 5

describe('DoHManager Types and Constants', () => {
  describe('DoHProvider enum', () => {
    it('should have correct provider IDs', () => {
      expect(DoHProvider.DISABLED).toBe(-1);
      expect(DoHProvider.CLOUDFLARE).toBe(1);
      expect(DoHProvider.GOOGLE).toBe(2);
      expect(DoHProvider.ADGUARD).toBe(3);
    });
  });

  describe('DoHProviderNames', () => {
    it('should have names for all providers', () => {
      expect(DoHProviderNames[DoHProvider.DISABLED]).toBe(
        'Disabled (System DNS)',
      );
      expect(DoHProviderNames[DoHProvider.CLOUDFLARE]).toBe(
        'Cloudflare (1.1.1.1)',
      );
      expect(DoHProviderNames[DoHProvider.GOOGLE]).toBe('Google (8.8.8.8)');
      expect(DoHProviderNames[DoHProvider.ADGUARD]).toBe(
        'AdGuard (94.140.14.140)',
      );
    });

    it('should contain correct DNS IPs in names', () => {
      expect(DoHProviderNames[DoHProvider.CLOUDFLARE]).toContain('1.1.1.1');
      expect(DoHProviderNames[DoHProvider.GOOGLE]).toContain('8.8.8.8');
      expect(DoHProviderNames[DoHProvider.ADGUARD]).toContain('94.140.14.140');
    });
  });

  describe('DoHProviderDescriptions', () => {
    it('should have descriptions for all providers', () => {
      expect(DoHProviderDescriptions[DoHProvider.DISABLED]).toContain('system');
      expect(DoHProviderDescriptions[DoHProvider.CLOUDFLARE]).toContain(
        'privacy',
      );
      expect(DoHProviderDescriptions[DoHProvider.GOOGLE]).toContain('Reliable');
      expect(DoHProviderDescriptions[DoHProvider.ADGUARD]).toContain(
        'Unfiltered',
      );
    });

    it('should provide meaningful descriptions', () => {
      const descriptions = Object.values(DoHProviderDescriptions);
      expect(descriptions.every(desc => desc.length > 10)).toBe(true);
    });
  });

  describe('Provider coverage', () => {
    it('should have consistent keys across all maps', () => {
      const nameKeys = Object.keys(DoHProviderNames).map(Number);
      const descKeys = Object.keys(DoHProviderDescriptions).map(Number);

      expect(nameKeys.sort()).toEqual(descKeys.sort());
    });

    it('should match enum values', () => {
      const enumValues = Object.values(DoHProvider).filter(
        v => typeof v === 'number',
      ) as number[];
      const nameKeys = Object.keys(DoHProviderNames).map(Number);

      expect(new Set(enumValues)).toEqual(new Set(nameKeys));
    });
  });
});
