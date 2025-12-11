import { StyleSheet, TextStyle, View } from 'react-native';
import React, { useMemo } from 'react';
import AppText from '@components/AppText';

import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { IconButtonV2 } from '@components';
import {
  ChapterReaderSettings,
  useAppSettings,
} from '@hooks/persisted/useSettings';
import { useScaledDimensions } from '@hooks/useScaledDimensions';
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
  unit = '%',
}) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();
  const { iconSize } = useScaledDimensions();
  const { setChapterReaderSettings, ...settings } = useChapterReaderSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        buttonContainer: {
          alignItems: 'center',
          flexDirection: 'row',
        },
        container: {
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginVertical: scaleDimension(6, uiScale),
          paddingHorizontal: scaleDimension(16, uiScale),
        },
        value: {
          paddingHorizontal: scaleDimension(4, uiScale),
          textAlign: 'center',
          width: scaleDimension(60, uiScale),
        },
      }),
    [uiScale],
  );

  return (
    <View style={styles.container}>
      <AppText style={[{ color: theme.onSurfaceVariant }, labelStyle]}>
        {label}
      </AppText>
      <View style={styles.buttonContainer}>
        <IconButtonV2
          name="minus"
          color={theme.primary}
          size={iconSize.md + scaleDimension(2, uiScale)}
          disabled={settings[valueKey] <= min}
          onPress={() =>
            setChapterReaderSettings({
              [valueKey]: Math.max(min, settings[valueKey] - valueChange),
            })
          }
          theme={theme}
        />
        <AppText style={[styles.value, { color: theme.onSurface }]}>
          {`${((settings[valueKey] * 10) / 10).toFixed(decimals)}${unit}`}
        </AppText>
        <IconButtonV2
          name="plus"
          color={theme.primary}
          size={iconSize.md + scaleDimension(2, uiScale)}
          disabled={settings[valueKey] >= max}
          onPress={() =>
            setChapterReaderSettings({
              [valueKey]: Math.min(max, settings[valueKey] + valueChange),
            })
          }
          theme={theme}
        />
      </View>
    </View>
  );
};

export default ReaderValueChange;
