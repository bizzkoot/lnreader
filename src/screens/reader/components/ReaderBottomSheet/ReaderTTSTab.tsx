import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Slider from '@react-native-community/slider';
import { VoiceQuality, Voice } from 'expo-speech';
import TTSHighlight, { TTSVoice } from '@services/TTSHighlight';
import {
  useTheme,
  useChapterGeneralSettings,
  useChapterReaderSettings,
} from '@hooks/persisted';
import { List, Button } from '@components/index';
import { useBoolean } from '@hooks';
import { Portal } from 'react-native-paper';
import VoicePickerModal from '@screens/settings/SettingsReaderScreen/Modals/VoicePickerModal';
import TTSScrollBehaviorModal from '@screens/settings/SettingsReaderScreen/Modals/TTSScrollBehaviorModal';
import Switch from '@components/Switch/Switch';
import { useChapterContext } from '../../ChapterContext';

const ReaderTTSTab: React.FC = React.memo(() => {
  const theme = useTheme();
  const { webViewRef } = useChapterContext();
  const {
    TTSEnable = false,
    showParagraphHighlight = true,
    ttsBackgroundPlayback = true,
    ttsAutoDownload = 'disabled',
    ttsAutoDownloadAmount = '10',
    setChapterGeneralSettings,
  } = useChapterGeneralSettings();

  const { tts, setChapterReaderSettings } = useChapterReaderSettings();
  const [voices, setVoices] = useState<TTSVoice[]>([]);

  // Local state for slider values to enable real-time display during drag
  const [localRate, setLocalRate] = useState(tts?.rate || 1);
  const [localPitch, setLocalPitch] = useState(tts?.pitch || 1);
  const [isDraggingRate, setIsDraggingRate] = useState(false);
  const [isDraggingPitch, setIsDraggingPitch] = useState(false);

  // Helper to post TTS settings to WebView for immediate effect
  const postTTSSettingsToWebView = useCallback(
    (settings: {
      rate?: number;
      pitch?: number;
      voice?: string;
      enabled?: boolean;
      showParagraphHighlight?: boolean;
    }) => {
      if (webViewRef?.current) {
        const message = JSON.stringify({
          type: 'tts-update-settings',
          data: settings,
        });
        webViewRef.current.postMessage(message);
      }
    },
    [webViewRef],
  );

  // Sync local state when tts settings change externally
  useEffect(() => {
    if (!isDraggingRate) {
      setLocalRate(tts?.rate || 1);
    }
  }, [tts?.rate, isDraggingRate]);

  useEffect(() => {
    if (!isDraggingPitch) {
      setLocalPitch(tts?.pitch || 1);
    }
  }, [tts?.pitch, isDraggingPitch]);

  const {
    value: voiceModalVisible,
    setTrue: showVoiceModal,
    setFalse: hideVoiceModal,
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

  useEffect(() => {
    TTSHighlight.getVoices().then(res => {
      const formattedVoices = res.map(voice => ({
        ...voice,
        name: TTSHighlight.formatVoiceName(voice),
      }));

      formattedVoices.sort((a, b) => a.name.localeCompare(b.name));

      setVoices([
        {
          name: 'System',
          language: 'System',
          identifier: 'default',
          quality: 'default' as any,
        } as TTSVoice,
        ...formattedVoices,
      ]);
    });
  }, []);

  const resetTTSSettings = useCallback(() => {
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
    postTTSSettingsToWebView({ rate: 1, pitch: 1, voice: 'default' });
  }, [setChapterReaderSettings, postTTSSettingsToWebView]);

  return (
    <>
      <BottomSheetScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* TTS Enable Toggle */}
        <View style={styles.section}>
          <View style={styles.ttsHeader}>
            <List.SubHeader theme={theme}>Text to Speech</List.SubHeader>
            <Switch
              value={TTSEnable}
              onValueChange={() => {
                const newValue = !TTSEnable;
                setChapterGeneralSettings({
                  TTSEnable: newValue,
                });
                postTTSSettingsToWebView({ enabled: newValue });
              }}
            />
          </View>
        </View>

        {TTSEnable && (
          <>
            {/* Voice Settings */}
            <View style={styles.section}>
              <List.Item
                title="Voice"
                description={tts?.voice?.name || 'System'}
                onPress={showVoiceModal}
                theme={theme}
              />

              {/* Voice Rate Slider */}
              <View style={styles.sliderSection}>
                <View style={styles.sliderLabelRow}>
                  <Text
                    style={[styles.sliderLabel, { color: theme.onSurface }]}
                  >
                    Speed
                  </Text>
                  <Text style={[styles.sliderValue, { color: theme.primary }]}>
                    {localRate.toFixed(1)}x
                  </Text>
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
                      postTTSSettingsToWebView({ rate: newValue });
                    }}
                  >
                    <Text
                      style={[
                        styles.sliderButtonText,
                        { color: theme.primary },
                      ]}
                    >
                      −
                    </Text>
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
                      postTTSSettingsToWebView({ rate: value });
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
                      postTTSSettingsToWebView({ rate: newValue });
                    }}
                  >
                    <Text
                      style={[
                        styles.sliderButtonText,
                        { color: theme.primary },
                      ]}
                    >
                      +
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Voice Pitch Slider */}
              <View style={styles.sliderSection}>
                <View style={styles.sliderLabelRow}>
                  <Text
                    style={[styles.sliderLabel, { color: theme.onSurface }]}
                  >
                    Pitch
                  </Text>
                  <Text style={[styles.sliderValue, { color: theme.primary }]}>
                    {localPitch.toFixed(1)}x
                  </Text>
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
                      postTTSSettingsToWebView({ pitch: newValue });
                    }}
                  >
                    <Text
                      style={[
                        styles.sliderButtonText,
                        { color: theme.primary },
                      ]}
                    >
                      −
                    </Text>
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
                      postTTSSettingsToWebView({ pitch: value });
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
                      postTTSSettingsToWebView({ pitch: newValue });
                    }}
                  >
                    <Text
                      style={[
                        styles.sliderButtonText,
                        { color: theme.primary },
                      ]}
                    >
                      +
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.resetButtonContainer}>
                <Button
                  title="Reset"
                  mode="outlined"
                  onPress={resetTTSSettings}
                  style={styles.resetButton}
                />
              </View>
            </View>

            {/* TTS Options */}
            <View style={styles.section}>
              <List.SubHeader theme={theme}>Options</List.SubHeader>
              <View style={styles.switchItem}>
                <Text style={[styles.switchLabel, { color: theme.onSurface }]}>
                  Highlight paragraph
                </Text>
                <Switch
                  value={showParagraphHighlight}
                  onValueChange={() => {
                    const newValue = !showParagraphHighlight;
                    setChapterGeneralSettings({
                      showParagraphHighlight: newValue,
                    });
                    postTTSSettingsToWebView({
                      showParagraphHighlight: newValue,
                    });
                  }}
                />
              </View>
              <View style={styles.switchItem}>
                <Text style={[styles.switchLabel, { color: theme.onSurface }]}>
                  Background playback
                </Text>
                <Switch
                  value={ttsBackgroundPlayback}
                  onValueChange={() =>
                    setChapterGeneralSettings({
                      ttsBackgroundPlayback: !ttsBackgroundPlayback,
                    })
                  }
                />
              </View>
            </View>

            {/* Auto-Download Settings */}
            <View style={styles.section}>
              <List.SubHeader theme={theme}>Auto-Download</List.SubHeader>
              <List.Item
                title="Download during TTS"
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
            </View>
          </>
        )}

        <View style={styles.bottomSpacing} />
      </BottomSheetScrollView>

      <Portal>
        <VoicePickerModal
          visible={voiceModalVisible}
          onDismiss={hideVoiceModal}
          voices={voices}
          onVoiceSelect={(voice: TTSVoice) => {
            postTTSSettingsToWebView({ voice: voice.identifier });
          }}
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
      </Portal>
    </>
  );
});

export default ReaderTTSTab;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  section: {
    marginVertical: 4,
  },
  switchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  switchLabel: {
    fontSize: 16,
    flex: 1,
    marginRight: 12,
  },
  ttsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
  },
  sliderSection: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  sliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 16,
  },
  sliderValue: {
    fontSize: 16,
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
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 24,
  },
  resetButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resetButton: {
    alignSelf: 'flex-start',
  },
  bottomSpacing: {
    height: 24,
  },
});
