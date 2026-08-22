import React from 'react';
import { StyleSheet, View } from 'react-native';
import { overlay } from 'react-native-paper';
import { useTheme, useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import AppText from '@components/AppText';

export const StatsCard: React.FC<{ label: string; value?: number }> = ({
  label,
  value = 0,
}) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();
  const styles = React.useMemo(() => createStyles(uiScale), [uiScale]);
  if (!label) return null;
  return (
    <View
      style={[
        styles.statsCardCtn,
        {
          backgroundColor: theme.isDark
            ? overlay(2, theme.surface)
            : theme.secondaryContainer,
        },
      ]}
    >
      <AppText style={[styles.statsVal, { color: theme.primary }]}>
        {value}
      </AppText>
      <AppText style={{ color: theme.onSurface }}>{label}</AppText>
    </View>
  );
};

export default StatsCard;

const createStyles = (uiScale: number) =>
  StyleSheet.create({
    statsCardCtn: {
      alignItems: 'center',
      borderRadius: 12,
      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
      justifyContent: 'center',
      margin: 4,
      paddingHorizontal: 8,
      paddingVertical: 12,
      minWidth: 92,
    },
    statsVal: { fontSize: scaleDimension(16, uiScale), fontWeight: 'bold' },
  });
