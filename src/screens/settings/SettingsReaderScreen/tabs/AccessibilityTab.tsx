import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Slider from '@react-native-community/slider';
import { Voice, VoiceQuality } from 'expo-speech';
import TTSHighlight, { TTSVoice } from '@services/TTSHighlight';
import {
  useTheme,
  useChapterGeneralSettings,
  useChapterReaderSettings,
  useAppSettings,
} from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import { getString } from '@strings/translations';
import { List, Button } from '@components/index';
import AppText from '@components/AppText';
import SettingSwitch from '../../components/SettingSwitch';
import Switch from '@components/Switch/Switch';
import { useBoolean } from '@hooks';
import { Portal } from 'react-native-paper';
import VoicePickerModal from '../Modals/VoicePickerModal';
import TTSScrollBehaviorModal from '../Modals/TTSScrollBehaviorModal';

import AutoResumeModal from '../Modals/AutoResumeModal';

interface TTSVoiceSettings {
  identifier?: string;
  name?: string;
  language?: string;
}

interface TTSSettings {
  rate?: number;
  pitch?: number;
  voice?: string | TTSVoiceSettings;
  [key: string]: unknown;
}

const AccessibilityTab: React.FC = () => {
  // No-op: Reader listens for settings changes via persisted storage and will
  // apply updates live. We keep a helper if needed for web-based debug.
  const sendTTSSettingsToReader = (_settings: TTSSettings) => false;
  const theme = useTheme();
  const {
    fullScreenMode = true,
    showScrollPercentage = true,
    showBatteryAndTime = false,
    keepScreenOn = true,
    bionicReading = false,
    TTSEnable = true,
    showParagraphHighlight = true,
    ttsAutoResume = 'prompt',
    ttsScrollPrompt = 'always-ask',
    ttsScrollBehavior = 'continue',
    ttsBackgroundPlayback = true,
    ttsAutoStopMode = 'off',
    ttsAutoStopAmount = 0,
    ttsAutoDownload = 'disabled',
    ttsAutoDownloadAmount = '10',
    ttsForwardChapterReset = 'none',
    setChapterGeneralSettings,
  } = useChapterGeneralSettings();

  const { tts, setChapterReaderSettings } = useChapterReaderSettings();
  const [voices, setVoices] = useState<TTSVoice[]>([]);

  // Local state for slider values to enable real-time display during drag
  const [localRate, setLocalRate] = useState(tts?.rate || 1);
  const [localPitch, setLocalPitch] = useState(tts?.pitch || 1);
  const [isDraggingRate, setIsDraggingRate] = useState(false);
  const [isDraggingPitch, setIsDraggingPitch] = useState(false);

  // Sync local state when tts settings change externally
  useEffect(() => {
    if (!isDraggingRate) {
      setLocalRate(tts?.rate || 1);
    }
  }, [tts?.rate, isDraggingRate]);

  // Send TTS settings to Reader/webview when rate changes
  useEffect(() => {
    if (!isDraggingRate && tts?.rate) {
      sendTTSSettingsToReader({ ...tts, rate: tts.rate });
    }
  }, [tts?.rate, isDraggingRate, tts]);

  useEffect(() => {
    if (!isDraggingPitch) {
      setLocalPitch(tts?.pitch || 1);
    }
  }, [tts?.pitch, isDraggingPitch, tts]);

  // Send TTS settings to Reader/webview when pitch changes
  useEffect(() => {
    if (!isDraggingPitch && tts?.pitch) {
      sendTTSSettingsToReader({ ...tts, pitch: tts.pitch });
    }
  }, [tts?.pitch, isDraggingPitch, tts]);
  // Send TTS settings to Reader/webview when voice changes
  useEffect(() => {
    if (tts?.voice) {
      sendTTSSettingsToReader({ ...tts, voice: tts.voice });
    }
  }, [tts?.voice, tts]);

  const {
    value: voiceModalVisible,
    setTrue: showVoiceModal,
    setFalse: hideVoiceModal,
  } = useBoolean();
  const {
    value: autoResumeModalVisible,
    setTrue: showAutoResumeModal,
    setFalse: hideAutoResumeModal,
  } = useBoolean();
  const {
    value: scrollPromptModalVisible,
    setTrue: showScrollPromptModal,
    setFalse: hideScrollPromptModal,
  } = useBoolean();
  const {
    value: scrollBehaviorModalVisible,
    setTrue: showScrollBehaviorModal,
    setFalse: hideScrollBehaviorModal,
  } = useBoolean();
  const {
    value: ttsAutoStopModeModalVisible,
    setTrue: showTtsAutoStopModeModal,
    setFalse: hideTtsAutoStopModeModal,
  } = useBoolean();
  const {
    value: ttsAutoStopAmountModalVisible,
    setTrue: showTtsAutoStopAmountModal,
    setFalse: hideTtsAutoStopAmountModal,
  } = useBoolean();
  const {
    value: ttsAutoDownloadModalVisible,
    setTrue: showTtsAutoDownloadModal,
    setFalse: hideTtsAutoDownloadModal,
  } = useBoolean();
  const {
    value: ttsAutoDownloadAmountModalVisible,
    setTrue: showTtsAutoDownloadAmountModal,
    setFalse: hideTtsAutoDownloadAmountModal,
  } = useBoolean();
  const {
    value: ttsResetModeModalVisible,
    setTrue: showTtsResetModeModal,
    setFalse: hideTtsResetModeModal,
  } = useBoolean();

  useEffect(() => {
    TTSHighlight.getVoices().then(res => {
      // 1. Format all voices first
      const formattedVoices = res.map(voice => ({
        ...voice,
        name: TTSHighlight.formatVoiceName(voice),
      }));

      // 2. Sort formatted voices
      formattedVoices.sort((a, b) => {
        // Extract language from name for grouping (e.g., "English (US)")
        // This assumes the format starts with the language.
        // If names are identical (rare), stable sort.
        return a.name.localeCompare(b.name);
      });

      setVoices([
        {
          name: 'System',
          language: 'System',
          identifier: 'default',
          quality: 'default',
        } as TTSVoice,
        ...formattedVoices,
      ]);
    });
  }, []);

  const { uiScale = 1.0 } = useAppSettings();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
        },
        contentContainer: {
          paddingBottom: 24,
        },
        section: {
          marginVertical: 8,
        },
        ttsHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingRight: 16,
        },
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
        resetButtonContainer: {
          paddingHorizontal: 16,
          marginTop: 16,
        },
        resetButton: {
          marginVertical: 8,
        },
        bottomSpacing: {
          height: 24,
        },
      }),
    [uiScale],
  );

  return (
    <>
      <BottomSheetScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.section}>
          <List.SubHeader theme={theme}>
            {getString('common.display')}
          </List.SubHeader>
          <SettingSwitch
            label={getString('readerScreen.bottomSheet.fullscreen')}
            value={fullScreenMode}
            onPress={() =>
              setChapterGeneralSettings({ fullScreenMode: !fullScreenMode })
            }
            theme={theme}
          />
          <SettingSwitch
            label={getString('readerScreen.bottomSheet.showProgressPercentage')}
            value={showScrollPercentage}
            onPress={() =>
              setChapterGeneralSettings({
                showScrollPercentage: !showScrollPercentage,
              })
            }
            theme={theme}
          />
          <SettingSwitch
            label={getString('readerScreen.bottomSheet.showBatteryAndTime')}
            value={showBatteryAndTime}
            onPress={() =>
              setChapterGeneralSettings({
                showBatteryAndTime: !showBatteryAndTime,
              })
            }
            theme={theme}
          />
          <SettingSwitch
            label={getString('readerScreen.bottomSheet.keepScreenOn')}
            value={keepScreenOn}
            onPress={() =>
              setChapterGeneralSettings({ keepScreenOn: !keepScreenOn })
            }
            theme={theme}
          />
        </View>

        <View style={styles.section}>
          <List.SubHeader theme={theme}>Reading Enhancements</List.SubHeader>
          <SettingSwitch
            label={getString('readerScreen.bottomSheet.bionicReading')}
            value={bionicReading}
            onPress={() =>
              setChapterGeneralSettings({ bionicReading: !bionicReading })
            }
            theme={theme}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.ttsHeader}>
            <List.SubHeader theme={theme}>Text to Speech</List.SubHeader>
            <Switch
              value={TTSEnable}
              onValueChange={() => {
                setChapterGeneralSettings({
                  TTSEnable: !TTSEnable,
                });
              }}
            />
          </View>
          {TTSEnable && (
            <>
              <SettingSwitch
                label="Highlight paragraph"
                value={showParagraphHighlight}
                onPress={() =>
                  setChapterGeneralSettings({
                    showParagraphHighlight: !showParagraphHighlight,
                  })
                }
                theme={theme}
              />
              <SettingSwitch
                label="Background Playback"
                value={ttsBackgroundPlayback}
                onPress={() =>
                  setChapterGeneralSettings({
                    ttsBackgroundPlayback: !ttsBackgroundPlayback,
                  })
                }
                theme={theme}
              />

              <List.SubHeader theme={theme}>Auto Stop</List.SubHeader>
              <List.Item
                title="Mode"
                description={
                  ttsAutoStopMode === 'off'
                    ? 'Off (continuous)'
                    : ttsAutoStopMode === 'minutes'
                      ? 'Time'
                      : ttsAutoStopMode === 'chapters'
                        ? 'Chapters'
                        : 'Paragraphs'
                }
                onPress={showTtsAutoStopModeModal}
                theme={theme}
              />
              {ttsAutoStopMode !== 'off' && (
                <List.Item
                  title="Limit"
                  description={
                    ttsAutoStopMode === 'minutes'
                      ? `${ttsAutoStopAmount} minutes`
                      : ttsAutoStopMode === 'chapters'
                        ? `${ttsAutoStopAmount} chapters`
                        : `${ttsAutoStopAmount} paragraphs`
                  }
                  onPress={showTtsAutoStopAmountModal}
                  theme={theme}
                />
              )}
              <List.Item
                title="Auto Resume"
                description={
                  ttsAutoResume === 'always'
                    ? 'Always resume'
                    : ttsAutoResume === 'never'
                      ? 'Never resume'
                      : 'Ask every time'
                }
                onPress={showAutoResumeModal}
                theme={theme}
              />
              <List.Item
                title="TTS voice"
                description={tts?.voice?.name || 'System'}
                onPress={showVoiceModal}
                theme={theme}
              />

              {/* Voice Rate Slider with enhanced UX */}
              <View style={styles.sliderSection}>
                <View style={styles.sliderLabelRow}>
                  <AppText
                    style={[styles.sliderLabel, { color: theme.onSurface }]}
                  >
                    Voice speed
                  </AppText>
                  <AppText
                    style={[styles.sliderValue, { color: theme.primary }]}
                  >
                    {localRate.toFixed(1)}x
                  </AppText>
                </View>
                <View style={styles.sliderContainer}>
                  <Pressable
                    style={styles.sliderButton}
                    onPress={() => {
                      const newValue = Math.max(0.1, localRate - 0.1);
                      setLocalRate(newValue);
                      setChapterReaderSettings({
                        tts: { ...tts, rate: newValue },
                      });
                    }}
                  >
                    <AppText
                      style={[
                        styles.sliderButtonText,
                        { color: theme.primary },
                      ]}
                    >
                      −
                    </AppText>
                  </Pressable>
                  <Slider
                    style={styles.slider}
                    value={localRate}
                    minimumValue={0.1}
                    maximumValue={3}
                    step={0.1}
                    minimumTrackTintColor={theme.primary}
                    maximumTrackTintColor={theme.surfaceVariant}
                    thumbTintColor={theme.primary}
                    onSlidingStart={() => setIsDraggingRate(true)}
                    onValueChange={setLocalRate}
                    onSlidingComplete={value => {
                      setIsDraggingRate(false);
                      setChapterReaderSettings({
                        tts: { ...tts, rate: value },
                      });
                    }}
                  />
                  <Pressable
                    style={styles.sliderButton}
                    onPress={() => {
                      const newValue = Math.min(3, localRate + 0.1);
                      setLocalRate(newValue);
                      setChapterReaderSettings({
                        tts: { ...tts, rate: newValue },
                      });
                    }}
                  >
                    <AppText
                      style={[
                        styles.sliderButtonText,
                        { color: theme.primary },
                      ]}
                    >
                      +
                    </AppText>
                  </Pressable>
                </View>
                <View style={styles.sliderMarkers}>
                  <AppText
                    style={[
                      styles.sliderMarkerText,
                      { color: theme.onSurfaceVariant },
                    ]}
                  >
                    Slow
                  </AppText>
                  <AppText
                    style={[
                      styles.sliderMarkerText,
                      { color: theme.onSurfaceVariant },
                    ]}
                  >
                    Normal
                  </AppText>
                  <AppText
                    style={[
                      styles.sliderMarkerText,
                      { color: theme.onSurfaceVariant },
                    ]}
                  >
                    Fast
                  </AppText>
                </View>
              </View>

              {/* Voice Pitch Slider with enhanced UX */}
              <View style={styles.sliderSection}>
                <View style={styles.sliderLabelRow}>
                  <AppText
                    style={[styles.sliderLabel, { color: theme.onSurface }]}
                  >
                    Voice pitch
                  </AppText>
                  <AppText
                    style={[styles.sliderValue, { color: theme.primary }]}
                  >
                    {localPitch.toFixed(1)}x
                  </AppText>
                </View>
                <View style={styles.sliderContainer}>
                  <Pressable
                    style={styles.sliderButton}
                    onPress={() => {
                      const newValue = Math.max(0.1, localPitch - 0.1);
                      setLocalPitch(newValue);
                      setChapterReaderSettings({
                        tts: { ...tts, pitch: newValue },
                      });
                    }}
                  >
                    <AppText
                      style={[
                        styles.sliderButtonText,
                        { color: theme.primary },
                      ]}
                    >
                      −
                    </AppText>
                  </Pressable>
                  <Slider
                    style={styles.slider}
                    value={localPitch}
                    minimumValue={0.1}
                    maximumValue={2}
                    step={0.1}
                    minimumTrackTintColor={theme.primary}
                    maximumTrackTintColor={theme.surfaceVariant}
                    thumbTintColor={theme.primary}
                    onSlidingStart={() => setIsDraggingPitch(true)}
                    onValueChange={setLocalPitch}
                    onSlidingComplete={value => {
                      setIsDraggingPitch(false);
                      setChapterReaderSettings({
                        tts: { ...tts, pitch: value },
                      });
                    }}
                  />
                  <Pressable
                    style={styles.sliderButton}
                    onPress={() => {
                      const newValue = Math.min(2, localPitch + 0.1);
                      setLocalPitch(newValue);
                      setChapterReaderSettings({
                        tts: { ...tts, pitch: newValue },
                      });
                    }}
                  >
                    <AppText
                      style={[
                        styles.sliderButtonText,
                        { color: theme.primary },
                      ]}
                    >
                      +
                    </AppText>
                  </Pressable>
                </View>
                <View style={styles.sliderMarkers}>
                  <AppText
                    style={[
                      styles.sliderMarkerText,
                      { color: theme.onSurfaceVariant },
                    ]}
                  >
                    Low
                  </AppText>
                  <AppText
                    style={[
                      styles.sliderMarkerText,
                      { color: theme.onSurfaceVariant },
                    ]}
                  >
                    Normal
                  </AppText>
                  <AppText
                    style={[
                      styles.sliderMarkerText,
                      { color: theme.onSurfaceVariant },
                    ]}
                  >
                    High
                  </AppText>
                </View>
              </View>

              <View style={styles.resetButtonContainer}>
                <Button
                  title={getString('common.reset')}
                  mode="outlined"
                  onPress={() => {
                    setLocalRate(1);
                    setLocalPitch(1);
                    setChapterReaderSettings({
                      tts: {
                        pitch: 1,
                        rate: 1,
                        voice: {
                          name: 'System',
                          language: 'System',
                          identifier: 'default',
                          quality: 'Default' as VoiceQuality,
                        } as Voice,
                      },
                    });
                  }}
                  style={styles.resetButton}
                />
              </View>

              <List.SubHeader theme={theme}>TTS Scroll Behavior</List.SubHeader>
              <List.Item
                title="When you scroll up while TTS is paused"
                description={
                  ttsScrollPrompt === 'always-ask'
                    ? 'Ask me if I want to change TTS position'
                    : ttsScrollPrompt === 'auto-change'
                      ? 'Automatically update TTS position'
                      : 'Never change TTS position'
                }
                onPress={showScrollPromptModal}
                theme={theme}
              />
              <List.Item
                title="When you scroll during TTS playback"
                description={
                  ttsScrollBehavior === 'continue'
                    ? 'Continue TTS playback (ignore manual scroll)'
                    : 'Pause TTS when I scroll'
                }
                onPress={showScrollBehaviorModal}
                theme={theme}
              />

              <List.SubHeader theme={theme}>
                TTS Chapter Navigation
              </List.SubHeader>
              <List.Item
                title="Auto-reset future progress"
                description={
                  ttsForwardChapterReset === 'none'
                    ? 'Disabled'
                    : ttsForwardChapterReset === 'reset-next'
                      ? 'Reset next chapter'
                      : ttsForwardChapterReset === 'reset-until-5'
                        ? 'Reset next 5 chapters'
                        : ttsForwardChapterReset === 'reset-until-10'
                          ? 'Reset next 10 chapters'
                          : 'Reset ALL future chapters (Destructive)'
                }
                onPress={showTtsResetModeModal}
                theme={theme}
              />

              <List.SubHeader theme={theme}>TTS Auto-Download</List.SubHeader>
              <List.Item
                title="Auto-download during TTS"
                description={
                  ttsAutoDownload === 'disabled'
                    ? 'Disabled (use app setting)'
                    : ttsAutoDownload === '5'
                      ? 'When 5 chapters remain'
                      : 'When 10 chapters remain'
                }
                onPress={showTtsAutoDownloadModal}
                theme={theme}
              />
              {ttsAutoDownload !== 'disabled' && (
                <List.Item
                  title="Chapters to download"
                  description={`${ttsAutoDownloadAmount} chapters`}
                  onPress={showTtsAutoDownloadAmountModal}
                  theme={theme}
                />
              )}
            </>
          )}
        </View>

        <View style={styles.bottomSpacing} />
      </BottomSheetScrollView>

      <Portal>
        <VoicePickerModal
          visible={voiceModalVisible}
          onDismiss={hideVoiceModal}
          voices={voices}
        />
        <AutoResumeModal
          visible={autoResumeModalVisible}
          onDismiss={hideAutoResumeModal}
          currentValue={ttsAutoResume}
          onSelect={value =>
            setChapterGeneralSettings({ ttsAutoResume: value })
          }
        />
        <TTSScrollBehaviorModal
          visible={scrollPromptModalVisible}
          onDismiss={hideScrollPromptModal}
          theme={theme}
          title="Paused Scroll Behavior"
          currentValue={
            ttsScrollPrompt as 'always-ask' | 'auto-change' | 'never-change'
          }
          onSelect={value =>
            setChapterGeneralSettings({
              ttsScrollPrompt: value as
                | 'always-ask'
                | 'auto-change'
                | 'never-change',
            })
          }
          options={[
            { label: 'Ask me every time', value: 'always-ask' },
            { label: 'Automatically update position', value: 'auto-change' },
            { label: 'Never change position', value: 'never-change' },
          ]}
        />
        <TTSScrollBehaviorModal
          visible={scrollBehaviorModalVisible}
          onDismiss={hideScrollBehaviorModal}
          theme={theme}
          title="Playback Scroll Behavior"
          currentValue={ttsScrollBehavior as 'continue' | 'pause-on-scroll'}
          onSelect={value =>
            setChapterGeneralSettings({
              ttsScrollBehavior: value as 'continue' | 'pause-on-scroll',
            })
          }
          options={[
            { label: 'Continue reading (Ignore scroll)', value: 'continue' },
            { label: 'Pause TTS when I scroll', value: 'pause-on-scroll' },
          ]}
        />
        <TTSScrollBehaviorModal
          visible={ttsAutoStopModeModalVisible}
          onDismiss={hideTtsAutoStopModeModal}
          theme={theme}
          title="Auto Stop Mode"
          currentValue={ttsAutoStopMode}
          onSelect={value => {
            const nextMode = value as
              | 'off'
              | 'minutes'
              | 'chapters'
              | 'paragraphs';
            const defaultAmount =
              nextMode === 'minutes'
                ? 15
                : nextMode === 'chapters'
                  ? 1
                  : nextMode === 'paragraphs'
                    ? 5
                    : 0;
            setChapterGeneralSettings({
              ttsAutoStopMode: nextMode,
              ttsAutoStopAmount: defaultAmount,
            });
          }}
          options={[
            { label: 'Off (continuous)', value: 'off' },
            { label: 'Time', value: 'minutes' },
            { label: 'Chapters', value: 'chapters' },
            { label: 'Paragraphs', value: 'paragraphs' },
          ]}
        />

        <TTSScrollBehaviorModal
          visible={ttsAutoStopAmountModalVisible}
          onDismiss={hideTtsAutoStopAmountModal}
          theme={theme}
          title="Auto Stop Limit"
          currentValue={String(ttsAutoStopAmount)}
          onSelect={value =>
            setChapterGeneralSettings({
              ttsAutoStopAmount: Number(value),
            })
          }
          options={
            ttsAutoStopMode === 'minutes'
              ? [
                  { label: '15 minutes', value: '15' },
                  { label: '30 minutes', value: '30' },
                  { label: '45 minutes', value: '45' },
                  { label: '60 minutes', value: '60' },
                ]
              : ttsAutoStopMode === 'chapters'
                ? [
                    { label: '1 chapter', value: '1' },
                    { label: '3 chapters', value: '3' },
                    { label: '5 chapters', value: '5' },
                    { label: '10 chapters', value: '10' },
                  ]
                : [
                    { label: '5 paragraphs', value: '5' },
                    { label: '10 paragraphs', value: '10' },
                    { label: '15 paragraphs', value: '15' },
                    { label: '20 paragraphs', value: '20' },
                    { label: '30 paragraphs', value: '30' },
                  ]
          }
        />
        <TTSScrollBehaviorModal
          visible={ttsAutoDownloadModalVisible}
          onDismiss={hideTtsAutoDownloadModal}
          theme={theme}
          title="TTS Auto-Download"
          currentValue={ttsAutoDownload}
          onSelect={value =>
            setChapterGeneralSettings({
              ttsAutoDownload: value as 'disabled' | '5' | '10',
            })
          }
          options={[
            { label: 'Disabled (use app setting)', value: 'disabled' },
            { label: 'When 5 chapters remain', value: '5' },
            { label: 'When 10 chapters remain', value: '10' },
          ]}
        />
        <TTSScrollBehaviorModal
          visible={ttsAutoDownloadAmountModalVisible}
          onDismiss={hideTtsAutoDownloadAmountModal}
          theme={theme}
          title="Chapters to Download"
          currentValue={ttsAutoDownloadAmount}
          onSelect={value =>
            setChapterGeneralSettings({
              ttsAutoDownloadAmount: value as '5' | '10' | '15',
            })
          }
          options={[
            { label: '5 chapters', value: '5' },
            { label: '10 chapters', value: '10' },
            { label: '15 chapters', value: '15' },
          ]}
        />
        <TTSScrollBehaviorModal
          visible={ttsResetModeModalVisible}
          onDismiss={hideTtsResetModeModal}
          theme={theme}
          title="Auto-reset Progress"
          currentValue={ttsForwardChapterReset}
          onSelect={value => {
            if (value === 'reset-all') {
              Alert.alert(
                'Confirm Reset All',
                'This will automatically reset read progress for ALL subsequent chapters when you start TTS from an earlier chapter. This cannot be undone per session.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Enable',
                    style: 'destructive',
                    onPress: () =>
                      setChapterGeneralSettings({
                        ttsForwardChapterReset: 'reset-all',
                      }),
                  },
                ],
              );
            } else {
              setChapterGeneralSettings({
                ttsForwardChapterReset: value as
                  | 'none'
                  | 'reset-next'
                  | 'reset-until-5'
                  | 'reset-until-10'
                  | 'reset-all',
              });
            }
          }}
          options={[
            { label: 'Disabled', value: 'none' },
            { label: 'Reset next chapter only', value: 'reset-next' },
            { label: 'Reset next 5 chapters', value: 'reset-until-5' },
            { label: 'Reset next 10 chapters', value: 'reset-until-10' },
            {
              label: 'Reset ALL future chapters (Warning)',
              value: 'reset-all',
            },
          ]}
        />
      </Portal>
    </>
  );
};

export default AccessibilityTab;
