import { StyleSheet, Text, TextStyle, View } from 'react-native';
import React, { useMemo } from 'react';

import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { IconButtonV2 } from '@components/index';
import { getString } from '@strings/translations';
import { useAppSettings } from '@hooks/persisted/useSettings';
import { useScaledDimensions } from '@hooks/useScaledDimensions';
import { scaleDimension } from '@theme/scaling';

interface ReaderTextSizeProps {
  labelStyle?: TextStyle | TextStyle[];
}

const ReaderTextSize: React.FC<ReaderTextSizeProps> = ({ labelStyle }) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();
  const { iconSize } = useScaledDimensions();
  const { textSize, setChapterReaderSettings } = useChapterReaderSettings();

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
          paddingHorizontal: scaleDimension(24, uiScale),
        },
      }),
    [uiScale],
  );

  return (
    <View style={styles.container}>
      <Text style={[{ color: theme.onSurfaceVariant }, labelStyle]}>
        {getString('readerScreen.bottomSheet.textSize')}
      </Text>
      <View style={styles.buttonContainer}>
        <IconButtonV2
          name="minus"
          color={theme.primary}
          size={iconSize.md + scaleDimension(2, uiScale)}
          disabled={textSize <= 0}
          onPress={() => setChapterReaderSettings({ textSize: textSize - 1 })}
          theme={theme}
        />
        <Text style={[styles.value, { color: theme.onSurface }]}>
          {textSize}
        </Text>
        <IconButtonV2
          name="plus"
          color={theme.primary}
          size={iconSize.md + scaleDimension(2, uiScale)}
          onPress={() => setChapterReaderSettings({ textSize: textSize + 1 })}
          theme={theme}
        />
      </View>
    </View>
  );
};

export default ReaderTextSize;
