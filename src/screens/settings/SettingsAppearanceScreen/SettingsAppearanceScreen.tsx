import React, { useMemo, useState } from 'react';
import { ScrollView, Text, StyleSheet, View, Pressable } from 'react-native';
import Slider from '@react-native-community/slider';

import { ThemePicker } from '@components/ThemePicker/ThemePicker';
import type { SegmentedControlOption } from '@components/SegmentedControl';
import SettingSwitch from '../components/SettingSwitch';
import ColorPickerModal from '@components/ColorPickerModal/ColorPickerModal';
import LanguagePickerModal from './LanguagePickerModal';

import { useAppSettings, useTheme } from '@hooks/persisted';
import {
  useMMKVBoolean,
  useMMKVNumber,
  useMMKVString,
} from 'react-native-mmkv';
import { Appbar, List, SafeAreaView, SegmentedControl } from '@components';
import { AppearanceSettingsScreenProps } from '@navigators/types';
import { getString } from '@strings/translations';
import { darkThemes, lightThemes } from '@theme/md3';
import { ThemeColors } from '@theme/types';
import { scaleDimension } from '@theme/scaling';

type ThemeMode = 'light' | 'dark' | 'system';

const AppearanceSettings = ({ navigation }: AppearanceSettingsScreenProps) => {
  const theme = useTheme();
  const [, setThemeId] = useMMKVNumber('APP_THEME_ID');
  const [themeMode = 'system', setThemeMode] = useMMKVString('THEME_MODE');
  const [isAmoledBlack = false, setAmoledBlack] =
    useMMKVBoolean('AMOLED_BLACK');
  const [, setCustomAccentColor] = useMMKVString('CUSTOM_ACCENT_COLOR');

  const {
    showHistoryTab,
    showUpdatesTab,
    showLabelsInNav,
    hideBackdrop,
    useFabForContinueReading,
    uiScale = 1.0,
    setAppSettings,
  } = useAppSettings();

  const currentMode = themeMode as ThemeMode;

  // UI Scale slider local state
  const [localUiScale, setLocalUiScale] = useState(uiScale);
  const [_isDraggingScale, setIsDraggingScale] = useState(false);

  /**
   * Accent Color Modal
   */
  const [accentColorModal, setAccentColorModal] = useState(false);
  const showAccentColorModal = () => setAccentColorModal(true);
  const hideAccentColorModal = () => setAccentColorModal(false);

  /**
   * Language Picker Modal
   */
  const [languageModal, setLanguageModal] = useState(false);
  const showLanguageModal = () => setLanguageModal(true);
  const hideLanguageModal = () => setLanguageModal(false);
  const [appLocale = ''] = useMMKVString('APP_LOCALE');

  const getCurrentLanguageName = (): string => {
    if (!appLocale) {
      return getString('appearanceScreen.appLanguageDefault');
    }
    const languageMap: Record<string, string> = {
      af: 'Afrikaans',
      ar: 'العربية',
      as: 'অসমীয়া',
      ca: 'Català',
      cs: 'Čeština',
      da: 'Dansk',
      de: 'Deutsch',
      el: 'Ελληνικά',
      en: 'English',
      es: 'Español',
      fi: 'Suomi',
      fr: 'Français',
      he: 'עברית',
      hi: 'हिन्दी',
      hu: 'Magyar',
      id: 'Bahasa Indonesia',
      it: 'Italiano',
      ja: '日本語',
      ko: '한국어',
      nl: 'Nederlands',
      no: 'Norsk',
      or: 'ଓଡ଼ିଆ',
      pl: 'Polski',
      pt: 'Português',
      'pt-BR': 'Português (Brasil)',
      ro: 'Română',
      ru: 'Русский',
      sq: 'Shqip',
      sr: 'Српски',
      sv: 'Svenska',
      tr: 'Türkçe',
      uk: 'Українська',
      vi: 'Tiếng Việt',
      'zh-CN': '简体中文',
      'zh-TW': '繁體中文',
    };
    return languageMap[appLocale] || appLocale;
  };

  const themeModeOptions: SegmentedControlOption<ThemeMode>[] = useMemo(
    () => [
      {
        value: 'system',
        label: getString('appearanceScreen.themeModeSystem'),
      },
      {
        value: 'light',
        label: getString('appearanceScreen.themeModeLight'),
      },
      {
        value: 'dark',
        label: getString('appearanceScreen.themeModeDark'),
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
    setCustomAccentColor(undefined);

    if (currentMode !== 'system') {
      setThemeMode(selectedTheme.isDark ? 'dark' : 'light');
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        flex1: {
          flex: 1,
        },
        scrollContent: {
          paddingBottom: 40,
        },
        themeSectionText: {
          paddingHorizontal: 16,
          paddingVertical: 8,
        },
        themePickerRow: {
          paddingHorizontal: 16,
          paddingVertical: 8,
          flexDirection: 'row',
        },
        segmentedControlContainer: {
          paddingHorizontal: 16,
          paddingVertical: 12,
        },
        // UI Scale slider styles
        sliderSection: {
          paddingVertical: 12,
          paddingHorizontal: 16,
        },
        sliderLabelRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        },
        sliderLabel: {
          fontSize: scaleDimension(16, uiScale),
        },
        sliderValue: {
          fontSize: scaleDimension(16, uiScale),
          fontWeight: '600',
          minWidth: 48,
          textAlign: 'right',
        },
        sliderContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        slider: {
          flex: 1,
          height: 48,
        },
        sliderButton: {
          width: 40,
          height: 40,
          borderRadius: 20,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(128, 128, 128, 0.1)',
        },
        sliderButtonText: {
          fontSize: scaleDimension(24, uiScale),
          fontWeight: '500',
          lineHeight: 28,
        },
        sliderMarkers: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 48,
          marginTop: 4,
        },
        sliderMarkerText: {
          fontSize: scaleDimension(12, uiScale),
        },
      }),
    [uiScale],
  );

  return (
    <SafeAreaView excludeTop>
      <Appbar
        title={getString('appearance')}
        handleGoBack={navigation.goBack}
        theme={theme}
      />
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={styles.scrollContent}
      >
        <List.Section>
          <List.SubHeader theme={theme}>
            {getString('appearanceScreen.appTheme')}
          </List.SubHeader>

          {/* Theme Mode Selector */}
          <View style={styles.segmentedControlContainer}>
            <SegmentedControl
              options={themeModeOptions}
              value={currentMode}
              onChange={handleModeChange}
              theme={theme}
            />
          </View>

          {/* Light Themes */}
          <Text style={[{ color: theme.onSurface }, styles.themeSectionText]}>
            {getString('appearanceScreen.lightTheme')}
          </Text>
          <ScrollView
            contentContainerStyle={styles.themePickerRow}
            horizontal={true}
            showsHorizontalScrollIndicator={false}
          >
            {lightThemes.map(item => (
              <ThemePicker
                horizontal
                key={item.id}
                currentTheme={theme}
                theme={item}
                onPress={() => handleThemeSelect(item)}
              />
            ))}
          </ScrollView>

          {/* Dark Themes */}
          <Text style={[{ color: theme.onSurface }, styles.themeSectionText]}>
            {getString('appearanceScreen.darkTheme')}
          </Text>
          <ScrollView
            contentContainerStyle={styles.themePickerRow}
            horizontal={true}
            showsHorizontalScrollIndicator={false}
          >
            {darkThemes.map(item => (
              <ThemePicker
                horizontal
                key={item.id}
                currentTheme={theme}
                theme={item}
                onPress={() => handleThemeSelect(item)}
              />
            ))}
          </ScrollView>

          {theme.isDark ? (
            <SettingSwitch
              label={getString('appearanceScreen.pureBlackDarkMode')}
              value={isAmoledBlack}
              onPress={() => setAmoledBlack(prevVal => !prevVal)}
              theme={theme}
            />
          ) : null}
          <List.ColorItem
            title={getString('appearanceScreen.accentColor')}
            description={theme.primary.toUpperCase()}
            onPress={showAccentColorModal}
            theme={theme}
          />
          <List.Item
            title={getString('appearanceScreen.appLanguage')}
            description={getCurrentLanguageName()}
            onPress={showLanguageModal}
            theme={theme}
          />
          <List.Divider theme={theme} />
          <List.SubHeader theme={theme}>
            {getString('common.display')}
          </List.SubHeader>
          {/* UI Scale Slider */}
          <View style={styles.sliderSection}>
            <View style={styles.sliderLabelRow}>
              <Text style={[styles.sliderLabel, { color: theme.onSurface }]}>
                UI Scale
              </Text>
              <Text style={[styles.sliderValue, { color: theme.primary }]}>
                {Math.round(localUiScale * 100)}%
              </Text>
            </View>
            <View style={styles.sliderContainer}>
              <Pressable
                style={styles.sliderButton}
                onPress={() => {
                  const newValue = Math.max(0.2, localUiScale - 0.05);
                  setLocalUiScale(newValue);
                  setAppSettings({ uiScale: newValue });
                }}
              >
                <Text
                  style={[styles.sliderButtonText, { color: theme.primary }]}
                >
                  −
                </Text>
              </Pressable>
              <Slider
                style={styles.slider}
                value={localUiScale}
                minimumValue={0.2}
                maximumValue={1.5}
                step={0.05}
                minimumTrackTintColor={theme.primary}
                maximumTrackTintColor={theme.surfaceVariant}
                thumbTintColor={theme.primary}
                onSlidingStart={() => setIsDraggingScale(true)}
                onValueChange={setLocalUiScale}
                onSlidingComplete={value => {
                  setIsDraggingScale(false);
                  setAppSettings({ uiScale: value });
                }}
              />
              <Pressable
                style={styles.sliderButton}
                onPress={() => {
                  const newValue = Math.min(1.5, localUiScale + 0.05);
                  setLocalUiScale(newValue);
                  setAppSettings({ uiScale: newValue });
                }}
              >
                <Text
                  style={[styles.sliderButtonText, { color: theme.primary }]}
                >
                  +
                </Text>
              </Pressable>
            </View>
            <View style={styles.sliderMarkers}>
              <Text
                style={[
                  styles.sliderMarkerText,
                  { color: theme.onSurfaceVariant },
                ]}
              >
                20%
              </Text>
              <Text
                style={[
                  styles.sliderMarkerText,
                  { color: theme.onSurfaceVariant },
                ]}
              >
                100%
              </Text>
              <Text
                style={[
                  styles.sliderMarkerText,
                  { color: theme.onSurfaceVariant },
                ]}
              >
                150%
              </Text>
            </View>
          </View>
          <List.Divider theme={theme} />
          <List.SubHeader theme={theme}>
            {getString('appearanceScreen.novelInfo')}
          </List.SubHeader>
          <SettingSwitch
            label={getString('appearanceScreen.hideBackdrop')}
            value={hideBackdrop}
            onPress={() => setAppSettings({ hideBackdrop: !hideBackdrop })}
            theme={theme}
          />
          <SettingSwitch
            label={getString('advancedSettingsScreen.useFAB')}
            value={useFabForContinueReading}
            onPress={() =>
              setAppSettings({
                useFabForContinueReading: !useFabForContinueReading,
              })
            }
            theme={theme}
          />
          <List.Divider theme={theme} />
          <List.SubHeader theme={theme}>
            {getString('appearanceScreen.navbar')}
          </List.SubHeader>
          <SettingSwitch
            label={getString('appearanceScreen.showUpdatesInTheNav')}
            value={showUpdatesTab}
            onPress={() => setAppSettings({ showUpdatesTab: !showUpdatesTab })}
            theme={theme}
          />
          <SettingSwitch
            label={getString('appearanceScreen.showHistoryInTheNav')}
            value={showHistoryTab}
            onPress={() => setAppSettings({ showHistoryTab: !showHistoryTab })}
            theme={theme}
          />
          <SettingSwitch
            label={getString('appearanceScreen.alwaysShowNavLabels')}
            value={showLabelsInNav}
            onPress={() =>
              setAppSettings({ showLabelsInNav: !showLabelsInNav })
            }
            theme={theme}
          />
        </List.Section>
      </ScrollView>

      <ColorPickerModal
        title={getString('appearanceScreen.accentColor')}
        visible={accentColorModal}
        closeModal={hideAccentColorModal}
        color={theme.primary}
        onSubmit={val => setCustomAccentColor(val)}
        theme={theme}
        showAccentColors={true}
      />
      <LanguagePickerModal
        visible={languageModal}
        onDismiss={hideLanguageModal}
      />
    </SafeAreaView>
  );
};

export default AppearanceSettings;
