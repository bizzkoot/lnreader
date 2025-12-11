import React, { useMemo } from 'react';
import { View, Pressable, StyleSheet, ScrollView } from 'react-native';
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

  const styles = useMemo(() => createStyles(uiScale), [uiScale]);

  if (!theme.isDark) {
    return null;
  }

  return (
    <View style={styles.amoledContainer}>
      <AppText style={[styles.amoledLabel, { color: theme.onSurface }]}>
        {getString('appearanceScreen.pureBlackDarkMode')}
      </AppText>
      <Pressable
        onPress={() => setAmoledBlack(!isAmoledBlack)}
        style={[
          styles.toggle,
          {
            backgroundColor: isAmoledBlack
              ? theme.primary
              : theme.surfaceVariant,
          },
        ]}
      >
        <View
          style={[
            styles.toggleThumb,
            isAmoledBlack && styles.toggleThumbActive,
            {
              backgroundColor: isAmoledBlack
                ? theme.onPrimary
                : theme.onSurfaceVariant,
            },
          ]}
        />
      </Pressable>
    </View>
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

    if (mode !== 'system') {
      const themes = mode === 'dark' ? darkThemes : lightThemes;
      const currentThemeInMode = themes.find(t => t.id === theme.id);

      if (!currentThemeInMode) {
        setThemeId(themes[0].id);
      }
    }
  };

  const handleThemeSelect = (selectedTheme: ThemeColors) => {
    setThemeId(selectedTheme.id);
    setThemeMode(selectedTheme.isDark ? 'dark' : 'light');
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.themeScrollContent}
      >
        {availableThemes.map(item => (
          <View key={item.id} style={styles.themeItem}>
            <ThemePicker
              currentTheme={theme}
              theme={item}
              onPress={() => handleThemeSelect(item)}
            />
          </View>
        ))}
      </ScrollView>

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
    themeScrollContent: {
      paddingVertical: 16,
      paddingHorizontal: 24,
    },
    themeItem: {
      marginHorizontal: 8,
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
    toggle: {
      width: scaleDimension(52, uiScale),
      height: scaleDimension(32, uiScale),
      borderRadius: scaleDimension(16, uiScale),
      padding: scaleDimension(2, uiScale),
      justifyContent: 'center',
    },
    toggleThumb: {
      width: scaleDimension(28, uiScale),
      height: scaleDimension(28, uiScale),
      borderRadius: scaleDimension(14, uiScale),
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
    },
    toggleThumbActive: {
      alignSelf: 'flex-end',
    },
  });
