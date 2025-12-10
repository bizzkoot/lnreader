import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
        <Text style={[styles.label, { color: theme.onSurface }]}>{label}</Text>
        <Text style={{ color: theme.onSurfaceVariant }}>
          {description?.toUpperCase?.()}
        </Text>
      </View>
      <View style={[{ backgroundColor: description }, styles.colorPreview]} />
    </Pressable>
  );
};

export default ColorPreferenceItem;
