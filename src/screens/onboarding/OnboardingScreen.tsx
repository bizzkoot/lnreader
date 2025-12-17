import { useTheme, useAppSettings } from '@hooks/persisted';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Image,
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  FlatList,
} from 'react-native';
import {
  useMMKVString,
  useMMKVBoolean,
  useMMKVNumber,
} from 'react-native-mmkv';
import Slider from '@react-native-community/slider';
import { Button, SegmentedControl, List } from '@components';
import type { SegmentedControlOption } from '@components/SegmentedControl';
import { ThemePicker } from '@components/ThemePicker/ThemePicker';
import { useState, useMemo } from 'react';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { getString } from '@strings/translations';
import { scaleDimension } from '@theme/scaling';
import AppText from '@components/AppText';
import { darkThemes, lightThemes } from '@theme/md3';
import { ThemeColors } from '@theme/types';
import LanguagePickerModal from '@screens/settings/SettingsAppearanceScreen/LanguagePickerModal';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import ServiceManager from '@services/ServiceManager';
import { showToast } from '@utils/showToast';

type ThemeMode = 'light' | 'dark' | 'system';

const languageMap: Record<string, string> = {
  af: 'Afrikaans',
  ar: 'العربية',
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  id: 'Bahasa Indonesia',
  it: 'Italiano',
  ja: '日本語',
  ko: '한국어',
  pl: 'Polski',
  pt: 'Português',
  'pt-BR': 'Português (Brasil)',
  ru: 'Русский',
  tr: 'Türkçe',
  uk: 'Українська',
  vi: 'Tiếng Việt',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
};

export default function OnboardingScreen() {
  const theme = useTheme();
  const { uiScale = 1.0, setAppSettings } = useAppSettings();
  const [themeMode = 'system', setThemeMode] = useMMKVString('THEME_MODE');
  const [, setThemeId] = useMMKVNumber('APP_THEME_ID');
  const [isAmoledBlack = false, setAmoledBlack] =
    useMMKVBoolean('AMOLED_BLACK');
  const [appLocale = ''] = useMMKVString('APP_LOCALE');

  const [localUiScale, setLocalUiScale] = useState(uiScale);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const currentMode = themeMode as ThemeMode;

  const availableThemes = useMemo(() => {
    return theme.isDark ? darkThemes : lightThemes;
  }, [theme.isDark]);

  const themeModeOptions: SegmentedControlOption<ThemeMode>[] = useMemo(
    () => [
      { value: 'system', label: getString('onboardingScreen.system') },
      { value: 'light', label: getString('onboardingScreen.light') },
      { value: 'dark', label: getString('onboardingScreen.dark') },
    ],
    [],
  );

  const getCurrentLanguageName = (): string => {
    if (!appLocale) {
      return getString('appearanceScreen.appLanguageDefault');
    }
    return languageMap[appLocale] || appLocale;
  };

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

  const handleRestoreBackup = () => {
    setIsRestoring(true);
    try {
      // Clear any pending tasks (e.g. stale backups from dev sessions) to avoid confusion
      ServiceManager.manager.clearTaskList();
      ServiceManager.manager.addTask({ name: 'LOCAL_RESTORE' });
      showToast(getString('onboardingScreen.restoreStarted'));
    } catch (error) {
      showToast(getString('onboardingScreen.restoreFailed'));
    } finally {
      setIsRestoring(false);
    }
  };

  const handleComplete = () => {
    MMKVStorage.set('IS_ONBOARDED', true);
  };

  const styles = useMemo(() => createStyles(uiScale, theme), [uiScale, theme]);

  return (
    <SafeAreaView style={[{ backgroundColor: theme.background }, styles.root]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Image
            source={require('../../../assets/logo.png')}
            tintColor={theme.primary}
            style={styles.logo}
          />
          <AppText style={[{ color: theme.onBackground }, styles.headline]}>
            {getString('onboardingScreen.welcome')}
          </AppText>
        </View>

        {/* Theme Section */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <AppText style={[styles.sectionTitle, { color: theme.onSurface }]}>
            {getString('onboardingScreen.pickATheme')}
          </AppText>

          <SegmentedControl
            options={themeModeOptions}
            value={currentMode}
            onChange={handleModeChange}
            theme={theme}
          />

          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={availableThemes}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }: { item: ThemeColors }) => (
              <View style={styles.themeItem}>
                <ThemePicker
                  currentTheme={theme}
                  theme={item}
                  horizontal={true}
                  onPress={() => handleThemeSelect(item)}
                />
              </View>
            )}
            contentContainerStyle={styles.themeScrollContent}
          />

          {theme.isDark && (
            <Pressable
              style={styles.amoledRow}
              onPress={() => setAmoledBlack(!isAmoledBlack)}
            >
              <AppText style={[styles.amoledLabel, { color: theme.onSurface }]}>
                {getString('appearanceScreen.pureBlackDarkMode')}
              </AppText>
              <View
                style={[
                  styles.toggle,
                  {
                    backgroundColor: isAmoledBlack
                      ? theme.primary
                      : theme.surface,
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
              </View>
            </Pressable>
          )}
        </View>

        {/* Display Settings Section */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <AppText style={[styles.sectionTitle, { color: theme.onSurface }]}>
            {getString('onboardingScreen.customizeDisplay')}
          </AppText>

          {/* UI Scale */}
          <View style={styles.settingRow}>
            <View style={styles.sliderLabelRow}>
              <AppText
                style={[styles.settingLabel, { color: theme.onSurface }]}
              >
                {getString('onboardingScreen.uiScale')}
              </AppText>
              <AppText style={[styles.sliderValue, { color: theme.primary }]}>
                {Math.round(localUiScale * 100)}%
              </AppText>
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
                <AppText
                  style={[styles.sliderButtonText, { color: theme.primary }]}
                >
                  −
                </AppText>
              </Pressable>
              <Slider
                style={styles.slider}
                value={localUiScale}
                minimumValue={0.2}
                maximumValue={1.5}
                step={0.05}
                minimumTrackTintColor={theme.primary}
                maximumTrackTintColor={theme.surface}
                thumbTintColor={theme.primary}
                onValueChange={setLocalUiScale}
                onSlidingComplete={value => {
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
                <AppText
                  style={[styles.sliderButtonText, { color: theme.primary }]}
                >
                  +
                </AppText>
              </Pressable>
            </View>
          </View>

          <List.Divider theme={theme} />

          {/* Language */}
          <Pressable
            style={styles.languageRow}
            onPress={() => setLanguageModalVisible(true)}
          >
            <AppText style={[styles.settingLabel, { color: theme.onSurface }]}>
              {getString('onboardingScreen.appLanguage')}
            </AppText>
            <View style={styles.languageValue}>
              <AppText
                style={[styles.languageText, { color: theme.onSurfaceVariant }]}
              >
                {getCurrentLanguageName()}
              </AppText>
              <MaterialCommunityIcons
                name="chevron-right"
                size={scaleDimension(20, uiScale)}
                color={theme.onSurfaceVariant}
              />
            </View>
          </Pressable>
        </View>

        {/* Restore Backup Section */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <View style={styles.restoreHeader}>
            <MaterialCommunityIcons
              name="backup-restore"
              size={scaleDimension(24, uiScale)}
              color={theme.primary}
            />
            <AppText style={[styles.sectionTitle, { color: theme.onSurface }]}>
              {getString('onboardingScreen.restoreFromBackup')}
            </AppText>
          </View>
          <AppText
            style={[styles.restoreDesc, { color: theme.onSurfaceVariant }]}
          >
            {getString('onboardingScreen.restoreDesc')}
          </AppText>
          <Pressable
            style={[
              styles.restoreButton,
              { backgroundColor: theme.primaryContainer },
            ]}
            onPress={handleRestoreBackup}
            disabled={isRestoring}
          >
            <AppText
              style={[
                styles.restoreButtonText,
                { color: theme.onPrimaryContainer },
              ]}
            >
              {isRestoring
                ? getString('common.loading')
                : getString('onboardingScreen.restoreNow')}
            </AppText>
          </Pressable>
        </View>

        {/* Start Fresh Note */}
        <AppText
          style={[styles.startFreshNote, { color: theme.onSurfaceVariant }]}
        >
          {getString('onboardingScreen.startFreshNote')}
        </AppText>
      </ScrollView>

      {/* Complete Button */}
      <View style={styles.buttonContainer}>
        <Button
          title={getString('onboardingScreen.complete')}
          mode="contained"
          onPress={handleComplete}
        />
      </View>

      <LanguagePickerModal
        visible={languageModalVisible}
        onDismiss={() => setLanguageModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const createStyles = (uiScale: number, theme: any) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 24,
      paddingBottom: 16,
    },
    header: {
      marginBottom: 20,
    },
    logo: {
      width: scaleDimension(80, uiScale),
      height: scaleDimension(80, uiScale),
      marginBottom: 12,
    },
    headline: {
      fontSize: scaleDimension(28, uiScale),
      fontWeight: '600',
    },
    section: {
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: scaleDimension(16, uiScale),
      fontWeight: '600',
      marginBottom: 12,
    },
    themeScrollContent: {
      paddingVertical: 12,
      gap: 12,
    },
    themeItem: {
      marginRight: 12,
      minWidth: scaleDimension(80, uiScale),
    },
    amoledRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 12,
    },
    amoledLabel: {
      fontSize: scaleDimension(14, uiScale),
    },
    toggle: {
      width: scaleDimension(48, uiScale),
      height: scaleDimension(28, uiScale),
      borderRadius: scaleDimension(14, uiScale),
      padding: scaleDimension(2, uiScale),
      justifyContent: 'center',
    },
    toggleThumb: {
      width: scaleDimension(24, uiScale),
      height: scaleDimension(24, uiScale),
      borderRadius: scaleDimension(12, uiScale),
    },
    toggleThumbActive: {
      alignSelf: 'flex-end',
    },
    settingRow: {
      marginBottom: 12,
    },
    sliderLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    settingLabel: {
      fontSize: scaleDimension(14, uiScale),
    },
    sliderValue: {
      fontSize: scaleDimension(14, uiScale),
      fontWeight: '600',
    },
    sliderContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    slider: {
      flex: 1,
      height: 40,
    },
    sliderButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(128, 128, 128, 0.1)',
    },
    sliderButtonText: {
      fontSize: scaleDimension(20, uiScale),
      fontWeight: '500',
    },
    languageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 12,
    },
    languageValue: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    languageText: {
      fontSize: scaleDimension(14, uiScale),
      marginRight: 4,
    },
    restoreHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    restoreDesc: {
      fontSize: scaleDimension(13, uiScale),
      lineHeight: scaleDimension(18, uiScale),
      marginBottom: 12,
    },
    restoreButton: {
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: 8,
    },
    restoreButtonText: {
      fontSize: scaleDimension(14, uiScale),
      fontWeight: '500',
    },
    startFreshNote: {
      fontSize: scaleDimension(13, uiScale),
      textAlign: 'center',
      marginBottom: 8,
    },
    buttonContainer: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      paddingTop: 8,
    },
  });
