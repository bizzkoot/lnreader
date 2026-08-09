import { StyleSheet, View } from 'react-native';
import React from 'react';
import AppText from '@components/AppText';

import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { Slider } from '@components';
import { getString } from '@strings/translations';

const TextSizeSlider: React.FC = () => {
  const theme = useTheme();

  const { textSize, setChapterReaderSettings } = useChapterReaderSettings();

  return (
    <View style={styles.container}>
      <AppText style={[styles.label, { color: theme.onSurfaceVariant }]}>
        {getString('readerScreen.bottomSheet.textSize')}
      </AppText>
      <Slider
        style={styles.slider}
        value={textSize}
        min={12}
        max={20}
        step={1}
        showStops
        showValueIndicator
        accessibilityLabel={getString('readerScreen.bottomSheet.textSize')}
        onSlidingComplete={value =>
          setChapterReaderSettings({ textSize: value })
        }
      />
    </View>
  );
};

export default TextSizeSlider;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  slider: {
    flex: 1,
  },
});
