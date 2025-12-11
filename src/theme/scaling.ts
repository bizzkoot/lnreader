/**
 * Scales a dimension value by the given scale factor.
 * @param value - Base dimension value in dp
 * @param scale - UI scale factor
 * @returns Scaled dimension value
 */
export const scaleDimension = (value: number, scale: number): number => {
  return Math.round(value * scale);
};

/**
 * Scales multiple dimension values at once.
 * @param values - Object with dimension values
 * @param scale - UI scale factor
 * @returns Object with scaled dimension values
 */
export const scaleDimensions = (
  values: Record<string, number>,
  scale: number,
): Record<string, number> => {
  const scaled: Record<string, number> = {};
  for (const [key, value] of Object.entries(values)) {
    scaled[key] = scaleDimension(value, scale);
  }
  return scaled;
};

/**
 * Creates a scaled style object with common UI dimensions.
 * @param scale - UI scale factor
 * @returns Object with scaled dimensions
 */
export const getScaledDimensions = (scale: number = 1.0) => {
  const baseDimensions = {
    padding: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
    },
    margin: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
    },
    borderRadius: {
      sm: 4,
      md: 8,
      lg: 12,
      xl: 16,
    },
    iconSize: {
      sm: 16,
      md: 24,
      lg: 32,
      xl: 48,
    },
    buttonHeight: {
      sm: 32,
      md: 40,
      lg: 48,
    },
  };

  return {
    padding: scaleDimensions(baseDimensions.padding, scale),
    margin: scaleDimensions(baseDimensions.margin, scale),
    borderRadius: scaleDimensions(baseDimensions.borderRadius, scale),
    iconSize: scaleDimensions(baseDimensions.iconSize, scale),
    buttonHeight: scaleDimensions(baseDimensions.buttonHeight, scale),
  };
};
