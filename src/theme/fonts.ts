import { MD3Theme, configureFonts, MD3TypescaleKey } from 'react-native-paper';

/**
 * MD3 Typography Scale configuration.
 * Adjusted to "Compact" sizes to match legacy LNReader density.
 * MD3 Default bodyLarge is 16, we use 14.
 */
const baseTypescale: Record<
  MD3TypescaleKey,
  { fontSize: number; lineHeight: number }
> = {
  displayLarge: { fontSize: 48, lineHeight: 56 }, // MD3: 57/64
  displayMedium: { fontSize: 40, lineHeight: 48 }, // MD3: 45/52
  displaySmall: { fontSize: 32, lineHeight: 40 }, // MD3: 36/44
  headlineLarge: { fontSize: 28, lineHeight: 36 }, // MD3: 32/40
  headlineMedium: { fontSize: 24, lineHeight: 32 }, // MD3: 28/36
  headlineSmall: { fontSize: 20, lineHeight: 28 }, // MD3: 24/32
  titleLarge: { fontSize: 18, lineHeight: 24 }, // MD3: 22/28
  titleMedium: { fontSize: 16, lineHeight: 22 }, // MD3: 16/24
  titleSmall: { fontSize: 14, lineHeight: 20 }, // MD3: 14/20
  labelLarge: { fontSize: 14, lineHeight: 20 }, // MD3: 14/20
  labelMedium: { fontSize: 12, lineHeight: 16 }, // MD3: 12/16
  labelSmall: { fontSize: 10, lineHeight: 14 }, // MD3: 11/16
  bodyLarge: { fontSize: 14, lineHeight: 22 }, // MD3: 16/24 (Crucial change)
  bodyMedium: { fontSize: 13, lineHeight: 18 }, // MD3: 14/20
  bodySmall: { fontSize: 12, lineHeight: 16 }, // MD3: 12/16
};

/**
 * Usage:
 * "Resolution Scaling": Normalizes fonts based on screen width relative to standard 360dp.
 * This ensures "visual consistency" across different device widths.
 */
// We'll keep it simple: Pure DP scaling as requested by standard RN practice,
// but with the smaller base sizes.

/**
 * Creates a scaled typography configuration for react-native-paper.
 * @param scale - The UI scale factor (0.8 to 1.5, default 1.0)
 * @returns MD3 fonts configuration with scaled sizes
 */
export const getScaledFonts = (scale: number = 1.0): MD3Theme['fonts'] => {
  const scaledConfig: Parameters<typeof configureFonts>[0] = {
    config: {},
  };

  // Optional: We could neutralize system font scale here if "App Controlled" is desired.
  // const fontScale = PixelRatio.getFontScale();
  // const effectiveScale = scale / fontScale;
  // For now, we respect system scale + app scale, but start from smaller base.

  // Apply scale to all typescale variants
  for (const key of Object.keys(baseTypescale) as MD3TypescaleKey[]) {
    const base = baseTypescale[key];
    scaledConfig.config![key] = {
      fontFamily: 'System',
      fontWeight: '400' as const,
      letterSpacing: 0,
      fontSize: Math.round(base.fontSize * scale),
      lineHeight: Math.round(base.lineHeight * scale),
    };
  }

  return configureFonts(scaledConfig);
};

/**
 * Default font sizes for common UI elements (in dp).
 * Used by AppText component for consistent scaling.
 */
export const defaultFontSizes = {
  small: 12,
  medium: 13,
  large: 15,
  title: 18,
  header: 22,
} as const;

/**
 * Scales a font size value by the given scale factor.
 * @param size - Base font size in dp
 * @param scale - UI scale factor
 * @returns Scaled font size
 */
export const scaleFont = (size: number, scale: number): number => {
  return Math.round(size * scale);
};
