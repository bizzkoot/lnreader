import { clampUIScale, scaleDimension } from '../scaling';

describe('UI Scale Clamping', () => {
  describe('clampUIScale', () => {
    it('should clamp values below minimum (0.8)', () => {
      expect(clampUIScale(0.2)).toBe(0.8);
      expect(clampUIScale(0.5)).toBe(0.8);
      expect(clampUIScale(0.79)).toBe(0.8);
    });

    it('should clamp values above maximum (1.3)', () => {
      expect(clampUIScale(1.5)).toBe(1.3);
      expect(clampUIScale(2.0)).toBe(1.3);
      expect(clampUIScale(10.0)).toBe(1.3);
    });

    it('should preserve valid values (0.8-1.3)', () => {
      expect(clampUIScale(0.8)).toBe(0.8);
      expect(clampUIScale(1.0)).toBe(1.0);
      expect(clampUIScale(1.1)).toBe(1.1);
      expect(clampUIScale(1.3)).toBe(1.3);
    });

    it('should handle edge cases', () => {
      expect(clampUIScale(0)).toBe(0.8);
      expect(clampUIScale(-1)).toBe(0.8);
      expect(clampUIScale(Infinity)).toBe(1.3);
    });
  });

  describe('scaleDimension', () => {
    it('should apply clamping in scaleDimension', () => {
      // 16px at 0.2x would be 3.2px, but clamped to 0.8x = 12.8px → 13px
      expect(scaleDimension(16, 0.2)).toBe(13);

      // 16px at 1.5x would be 24px, but clamped to 1.3x = 20.8px → 21px
      expect(scaleDimension(16, 1.5)).toBe(21);
    });

    it('should scale normally for valid values', () => {
      expect(scaleDimension(16, 0.8)).toBe(13); // 12.8 → 13
      expect(scaleDimension(16, 1.0)).toBe(16);
      expect(scaleDimension(16, 1.3)).toBe(21); // 20.8 → 21
    });

    it('should round scaled values correctly', () => {
      expect(scaleDimension(10, 1.0)).toBe(10);
      expect(scaleDimension(10, 1.1)).toBe(11); // 11 exactly
      expect(scaleDimension(10, 1.15)).toBe(12); // 11.5 → 12
    });
  });

  describe('Preventing UX disasters', () => {
    it('should prevent illegible text at extreme low values', () => {
      const fontSize = 14;
      // At 0.2x: 14px would become 3px (illegible)
      // Clamped to 0.8x: 14px becomes 11px (readable)
      expect(scaleDimension(fontSize, 0.2)).toBe(11);
    });

    it('should prevent layout overflow at extreme high values', () => {
      const buttonHeight = 48;
      // At 1.5x: 48px would become 72px (too large)
      // Clamped to 1.3x: 48px becomes 62px (acceptable)
      expect(scaleDimension(buttonHeight, 1.5)).toBe(62);
    });

    it('should prevent touch target issues', () => {
      const minTouchTarget = 44; // Material Design minimum
      // At 0.2x: 44px would become 9px (too small for fingers)
      // Clamped to 0.8x: 44px becomes 35px (still usable, slightly below ideal)
      expect(scaleDimension(minTouchTarget, 0.2)).toBe(35);
    });
  });
});
