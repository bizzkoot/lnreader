import React, { useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import {
  useMMKVBoolean,
  useMMKVNumber,
  useMMKVString,
} from 'react-native-mmkv';
import { SegmentedControl } from '@components';
import type { SegmentedControlOption } from '@components/SegmentedControl';
import { ThemePicker } from '@components/ThemePicker/ThemePicker';
import { ThemeColors } from '@theme/types';
import { useTheme, useAppSettings } from '@hooks/persisted';
import { darkThemes, lightThemes } from '@theme/md3';
import { getString } from '@strings/translations';
import { LegendList } from '@legendapp/list';
import Switch from '@components/Switch/Switch';
import { scaleDimension } from '@theme/scaling';
import AppText from '@components/AppText';

type ThemeMode = 'light' | 'dark' | 'system';

interface AmoledToggleProps {
  theme: ThemeColors;
}

const AmoledToggle: React.FC<AmoledToggleProps> = ({ theme }) => {
  const [isAmoledBlack = false, setAmoledBlack] =
    useMMKVBoolean('AMOLED_BLACK');
  const { uiScale = 1.0 } = useAppSettings();

  const toggle = () => setAmoledBlack(!isAmoledBlack);

  const styles = useMemo(() => createStyles(uiScale), [uiScale]);

  if (!theme.isDark) {
    return null;
  }

  return (
    <Pressable
      style={[
        styles.amoledContainer,
        { backgroundColor: theme.surfaceVariant },
      ]}
      onPress={toggle}
    >
      <AppText style={[styles.amoledLabel, { color: theme.onSurface }]}>
        {getString('appearanceScreen.pureBlackDarkMode')}
      </AppText>
      <Switch value={isAmoledBlack} onValueChange={toggle} />
    </Pressable>
  );
};

export default function ThemeSelectionStep() {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();
  const [themeMode = 'system', setThemeMode] = useMMKVString('THEME_MODE');
  const [, setThemeId] = useMMKVNumber('APP_THEME_ID');

  const currentMode = themeMode as ThemeMode;

  const availableThemes = useMemo(() => {
    return theme.isDark ? darkThemes : lightThemes;
  }, [theme.isDark]);

  const themeModeOptions: SegmentedControlOption<ThemeMode>[] = useMemo(
    () => [
      {
        value: 'system',
        label: getString('onboardingScreen.system'),
      },
      {
        value: 'light',
        label: getString('onboardingScreen.light'),
      },
      {
        value: 'dark',
        label: getString('onboardingScreen.dark'),
      },
    ],
    [],
  );

  const handleModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  const handleThemeSelect = (selectedTheme: ThemeColors) => {
    setThemeId(selectedTheme.id);
  };

  const styles = useMemo(() => createStyles(uiScale), [uiScale]);

  return (
    <View style={styles.container}>
      {/* Segmented Control */}
      <View style={styles.segmentedControlContainer}>
        <SegmentedControl
          options={themeModeOptions}
          value={currentMode}
          onChange={handleModeChange}
          theme={theme}
        />
      </View>

      {/* Theme List */}
      <LegendList
        numColumns={3}
        showsHorizontalScrollIndicator={false}
        data={availableThemes}
        extraData={theme}
        keyExtractor={item => 'theme-' + item.id}
        renderItem={({ item }) => (
          <View>
            <ThemePicker
              currentTheme={theme}
              theme={item}
              onPress={e => handleThemeSelect(item)}
            />
          </View>
        )}
      />

      {/* AMOLED Toggle */}
      <AmoledToggle theme={theme} />
    </View>
  );
}

const createStyles = (uiScale: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 16,
    },
    segmentedControlContainer: {
      marginBottom: 24,
    },
    amoledContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      paddingHorizontal: 4,
      marginTop: 'auto',
    },
    amoledLabel: {
      fontSize: scaleDimension(16, uiScale),
      fontWeight: '400',
    },
  });
