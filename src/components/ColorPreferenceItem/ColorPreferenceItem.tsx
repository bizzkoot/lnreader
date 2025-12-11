import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AppText from '@components/AppText';

import { ThemeColors } from '../../theme/types';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

interface ColorPreferenceItemProps {
  label: string;
  description?: string;
  onPress: () => void;
  theme: ThemeColors;
}

const ColorPreferenceItem: React.FC<ColorPreferenceItemProps> = ({
  label,
  description,
  theme,
  onPress,
}) => {
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        colorPreview: {
          borderRadius: 50,
          height: scaleDimension(24, uiScale),
          marginRight: scaleDimension(16, uiScale),
          width: scaleDimension(24, uiScale),
        },
        container: {
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
          padding: scaleDimension(16, uiScale),
        },
        label: {
          fontSize: scaleDimension(16, uiScale),
        },
      }),
    [uiScale],
  );

  return (
    <Pressable
      style={styles.container}
      android_ripple={{ color: theme.rippleColor }}
      onPress={onPress}
    >
      <View>
        <AppText style={[styles.label, { color: theme.onSurface }]}>
          {label}
        </AppText>
        <AppText style={{ color: theme.onSurfaceVariant }}>
          {description?.toUpperCase?.()}
        </AppText>
      </View>
      <View style={[{ backgroundColor: description }, styles.colorPreview]} />
    </Pressable>
  );
};

export default ColorPreferenceItem;
