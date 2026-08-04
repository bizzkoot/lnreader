import { StyleSheet, TextStyle, View } from 'react-native';
import React, { useMemo } from 'react';

import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { Slider } from '@components';
import AppText from '@components/AppText';
import { getString } from '@strings/translations';
import { useAppSettings } from '@hooks/persisted/useSettings';
import { scaleDimension } from '@theme/scaling';

interface ReaderTextSizeProps {
  labelStyle?: TextStyle | TextStyle[];
}

const ReaderTextSize: React.FC<ReaderTextSizeProps> = ({ labelStyle }) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();
  const { textSize, setChapterReaderSettings } = useChapterReaderSettings();

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
        },
      }),
    [uiScale],
  );

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <AppText style={[{ color: theme.onSurfaceVariant }, labelStyle]}>
          {getString('readerScreen.bottomSheet.textSize')}
        </AppText>
        <AppText style={[styles.value, { color: theme.onSurface }]}>
          {textSize}px
        </AppText>
      </View>
      <Slider
        value={textSize}
        min={12}
        max={20}
        step={1}
        showStops
        showValueIndicator
        formatValue={value => `${value}px`}
        accessibilityLabel={getString('readerScreen.bottomSheet.textSize')}
        onSlidingComplete={value =>
          setChapterReaderSettings({ textSize: value })
        }
      />
    </View>
  );
};

export default ReaderTextSize;
