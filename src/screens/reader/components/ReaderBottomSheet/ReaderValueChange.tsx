import { StyleSheet, TextStyle, View } from 'react-native';
import React, { useMemo } from 'react';
import AppText from '@components/AppText';

import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { Slider } from '@components';
import {
  ChapterReaderSettings,
  useAppSettings,
} from '@hooks/persisted/useSettings';
import { scaleDimension } from '@theme/scaling';

type ValueKey<T extends object> = Exclude<
  {
    [K in keyof T]: T[K] extends number ? K : never;
  }[keyof T],
  undefined
>;

interface ReaderValueChangeProps {
  labelStyle?: TextStyle | TextStyle[];
  valueChange?: number;
  label: string;
  valueKey: ValueKey<ChapterReaderSettings>;
  decimals?: number;
  min?: number;
  max?: number;
  unit?: string;
}

const ReaderValueChange: React.FC<ReaderValueChangeProps> = ({
  labelStyle,
  label,
  valueChange = 0.1,
  valueKey,
  decimals = 1,
  min = 1.3,
  max = 2,
  unit = '×',
}) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();
  const { setChapterReaderSettings, ...settings } = useChapterReaderSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        labelRow: {
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
        },
        container: {
          marginVertical: scaleDimension(6, uiScale),
          paddingHorizontal: scaleDimension(16, uiScale),
        },
        value: {
          fontVariant: ['tabular-nums'],
          textAlign: 'center',
        },
      }),
    [uiScale],
  );

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <AppText style={[{ color: theme.onSurfaceVariant }, labelStyle]}>
          {label}
        </AppText>
        <AppText style={[styles.value, { color: theme.onSurface }]}>
          {`${((settings[valueKey] * 10) / 10).toFixed(decimals)}${unit}`}
        </AppText>
      </View>
      <Slider
        value={settings[valueKey]}
        min={min}
        max={max}
        step={valueChange}
        showStops
        showValueIndicator
        formatValue={value => `${value.toFixed(decimals)}${unit}`}
        accessibilityLabel={label}
        onSlidingComplete={value =>
          setChapterReaderSettings({ [valueKey]: value })
        }
      />
    </View>
  );
};

export default ReaderValueChange;
