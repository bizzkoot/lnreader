import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AppText from '@components/AppText';

import { ThemeColors } from '../../theme/types';
import { overlay } from 'react-native-paper';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

interface ChipProps {
  label: string;
  theme: ThemeColors;
}

const Chip: React.FC<ChipProps> = ({ label, theme }) => {
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        chipContainer: {
          borderRadius: scaleDimension(8, uiScale),
          height: scaleDimension(32, uiScale),
          marginRight: scaleDimension(8, uiScale),
          overflow: 'hidden',
        },
        label: {
          fontSize: scaleDimension(12, uiScale),
        },
        pressable: {
          alignItems: 'center',
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: scaleDimension(16, uiScale),
        },
      }),
    [uiScale],
  );

  return (
    <View
      style={[
        styles.chipContainer,
        {
          backgroundColor: theme.isDark
            ? overlay(1, theme.surface)
            : theme.secondaryContainer,
        },
      ]}
    >
      <Pressable
        android_ripple={{ color: theme.rippleColor }}
        style={styles.pressable}
      >
        <AppText
          style={[
            styles.label,
            {
              color: theme.isDark
                ? theme.onSurface
                : theme.onSecondaryContainer,
            },
          ]}
        >
          {label}
        </AppText>
      </Pressable>
    </View>
  );
};

export default Chip;
