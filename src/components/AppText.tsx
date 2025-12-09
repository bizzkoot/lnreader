import React, { useMemo } from 'react';
import {
  Text as RNText,
  TextProps as RNTextProps,
  StyleSheet,
  TextStyle,
} from 'react-native';
import { useAppSettings } from '@hooks/persisted';
import { scaleFont } from '@theme/fonts';

export interface AppTextProps extends RNTextProps {
  /**
   * Override the default font size (before scaling).
   * If not provided, inherits from style or uses 14 as default.
   */
  size?: number;
  /**
   * If true, disables UI scale for this text instance.
   * Useful for elements that should not scale (e.g., icons rendered as text).
   */
  disableScale?: boolean;
}

/**
 * AppText - A scaled Text component wrapper.
 *
 * Automatically applies the user's UI Scale preference to all text.
 * Use this instead of `import { Text } from 'react-native'` for consistent scaling.
 *
 * @example
 * ```tsx
 * import { Text } from '@components/AppText';
 *
 * <Text>This text will scale with user preference</Text>
 * <Text size={18}>Custom size, still scales</Text>
 * <Text disableScale>This text won't scale</Text>
 * ```
 */
export const Text: React.FC<AppTextProps> = ({
  style,
  size,
  disableScale = false,
  children,
  ...props
}) => {
  const { uiScale = 1.0 } = useAppSettings();

  const scaledStyle = useMemo(() => {
    if (disableScale) {
      return style;
    }

    // Flatten the style to extract fontSize
    const flatStyle = StyleSheet.flatten(style) as TextStyle | undefined;
    const baseFontSize = size ?? flatStyle?.fontSize ?? 14;
    const baseLineHeight = flatStyle?.lineHeight;

    const scaledFontSize = scaleFont(baseFontSize, uiScale);
    const scaledLineHeight = baseLineHeight
      ? scaleFont(baseLineHeight, uiScale)
      : undefined;

    return [
      style,
      {
        fontSize: scaledFontSize,
        ...(scaledLineHeight ? { lineHeight: scaledLineHeight } : {}),
      },
    ];
  }, [style, size, uiScale, disableScale]);

  return (
    <RNText style={scaledStyle} {...props}>
      {children}
    </RNText>
  );
};

export default Text;
