import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import AppText from '@components/AppText';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Slider from '@react-native-community/slider';
import { VoiceQuality, Voice } from 'expo-speech';
import TTSHighlight, { TTSVoice } from '@services/TTSHighlight';
import {
  useTheme,
  useChapterGeneralSettings,
  useChapterReaderSettings,
  useAppSettings,
} from '@hooks/persisted';
import { List, Button } from '@components/index';
import { useBoolean } from '@hooks';
import { Portal } from 'react-native-paper';
import VoicePickerModal from '@screens/settings/SettingsReaderScreen/Modals/VoicePickerModal';
import TTSScrollBehaviorModal from '@screens/settings/SettingsReaderScreen/Modals/TTSScrollBehaviorModal';
import Switch from '@components/Switch/Switch';
import { useChapterContext } from '../../ChapterContext';
import { scaleDimension } from '@theme/scaling';
import {
  getNovelTtsSettings,
  setNovelTtsSettings,
} from '@services/tts/novelTtsSettings';
import { NovelInfo } from '@database/types';

interface ReaderTTSTabProps {
  novel: NovelInfo;
}

const ReaderTTSTab: React.FC<ReaderTTSTabProps> = React.memo(({ novel }) => {
  const debugLog = useCallback((...args: any[]) => {
    if (!__DEV__) return;
    // eslint-disable-next-line no-console
    console.log('[ReaderTTSTab][NovelTTS]', ...args);
  }, []);
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();
  // webViewRef comes from context; novel is passed as prop to work around Portal context issue
  const { webViewRef } = useChapterContext();
  const {
    TTSEnable = false,
    showParagraphHighlight = true,
    ttsBackgroundPlayback = true,
    ttsAutoDownload = 'disabled',
    ttsAutoDownloadAmount = '10',
    setChapterGeneralSettings,
  } = useChapterGeneralSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
        },
        contentContainer: {
          paddingBottom: scaleDimension(24, uiScale),
        },
        section: {
          marginVertical: scaleDimension(4, uiScale),
        },
        switchItem: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: scaleDimension(16, uiScale),
          paddingVertical: scaleDimension(12, uiScale),
        },
        switchLabel: {
          fontSize: scaleDimension(16, uiScale),
          flex: 1,
          marginRight: scaleDimension(12, uiScale),
        },
        ttsHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingRight: scaleDimension(16, uiScale),
        },
        sliderSection: {
          paddingVertical: scaleDimension(8, uiScale),
          paddingHorizontal: scaleDimension(16, uiScale),
        },
        sliderLabelRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: scaleDimension(8, uiScale),
        },
        sliderLabel: {
          fontSize: scaleDimension(16, uiScale),
        },
        sliderValue: {
          fontSize: scaleDimension(16, uiScale),
          fontWeight: '600',
          minWidth: scaleDimension(48, uiScale),
          textAlign: 'right',
        },
        sliderContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: scaleDimension(8, uiScale),
        },
        slider: {
          flex: 1,
          height: scaleDimension(40, uiScale),
        },
        sliderButton: {
          width: scaleDimension(36, uiScale),
          height: scaleDimension(36, uiScale),
          borderRadius: scaleDimension(18, uiScale),
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(128, 128, 128, 0.1)',
        },
        sliderButtonText: {
          fontSize: scaleDimension(20, uiScale),
          fontWeight: '500',
          lineHeight: scaleDimension(24, uiScale),
        },
        resetButtonContainer: {
          paddingHorizontal: scaleDimension(16, uiScale),
          paddingVertical: scaleDimension(8, uiScale),
        },
        resetButton: {
          alignSelf: 'flex-start',
        },
        bottomSpacing: {
          height: scaleDimension(24, uiScale),
        },
      }),
    [uiScale],
  );

  const { tts, setChapterReaderSettings } = useChapterReaderSettings();
  const effectiveTts = useMemo(() => tts ?? { rate: 1, pitch: 1 }, [tts]);
  const [voices, setVoices] = useState<TTSVoice[]>([]);

  // novel can be undefined during tab pre-rendering (react-native-tab-view renders all tabs)
  // novel is passed as prop and is guaranteed to exist
  const novelId = novel.id;
  const [useNovelTtsSettings, setUseNovelTtsSettings] = useState(false);

  // DEBUG: Log novel object details on every render
  useEffect(() => {
    debugLog('========== NOVEL ID FLOW DEBUG ==========');
    debugLog('novel object:', novel ? 'EXISTS' : 'UNDEFINED');
    debugLog('  novel.id:', novel.id);
    debugLog('  novel.name:', novel.name);
    debugLog('  novel.pluginId:', novel.pluginId);
    debugLog('  novel.isLocal:', novel.isLocal);
    debugLog('novelId extracted:', novelId, '(type:', typeof novelId, ')');
    debugLog('==========================================');
  }, [novel, novelId, debugLog]);

  useEffect(() => {
    debugLog('novelId useEffect triggered', { novelId, type: typeof novelId });

    const stored = getNovelTtsSettings(novelId);
    debugLog('read stored novel tts settings', { novelId, stored });
    setUseNovelTtsSettings(stored?.enabled === true);

    // If enabled and has saved settings, sync UI/global reader settings to match.
    // This keeps sliders/voice reflecting the novel override.
    if (stored?.enabled && stored.tts) {
      setChapterReaderSettings({ tts: stored.tts });
    }
  }, [novelId, setChapterReaderSettings, debugLog]);

  const persistNovelTtsEnabled = useCallback(
    (enabled: boolean) => {
      if (typeof novelId !== 'number') return;

      const previous = getNovelTtsSettings(novelId);

      debugLog('persistNovelTtsEnabled', {
        novelId,
        enabled,
        previous,
      });

      setNovelTtsSettings(novelId, {
        enabled,
        tts: previous?.tts ?? effectiveTts,
      });

      debugLog('after persistNovelTtsEnabled write', {
        novelId,
        next: getNovelTtsSettings(novelId),
      });
    },
    [debugLog, novelId, effectiveTts],
  );

  const setTtsSettings = useCallback(
    (nextTts: NonNullable<typeof tts>) => {
      setChapterReaderSettings({ tts: nextTts });

      if (useNovelTtsSettings && typeof novelId === 'number') {
        const previous = getNovelTtsSettings(novelId);
        setNovelTtsSettings(novelId, {
          enabled: true,
          tts: {
            ...previous?.tts,
            ...nextTts,
          },
        });
      }
    },
    [novelId, setChapterReaderSettings, useNovelTtsSettings],
  );

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

  const handleVoiceSelect = useCallback(
    (selected: TTSVoice) => {
      setTtsSettings({
        ...tts,
        voice: selected as unknown as Voice,
      });
      postTTSSettingsToWebView({ voice: selected.identifier });
    },
    [postTTSSettingsToWebView, setTtsSettings, tts],
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

    const next = {
      pitch: 1,
      rate: 1,
      voice: {
        name: 'System',
        language: 'System',
        identifier: 'default',
        quality: 'Default' as VoiceQuality,
      } as Voice,
    };

    setTtsSettings(next);
    postTTSSettingsToWebView({ rate: 1, pitch: 1, voice: 'default' });
  }, [setTtsSettings, postTTSSettingsToWebView]);

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
            <List.SubHeader theme={theme}>AppText to Speech</List.SubHeader>
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
            {/* Per-novel TTS toggle */}
            <View style={styles.section}>
              <View style={styles.switchItem}>
                <AppText
                  style={[styles.switchLabel, { color: theme.onSurface }]}
                >
                  Use settings for this novel
                </AppText>
                <Switch
                  value={useNovelTtsSettings}
                  onValueChange={() => {
                    if (typeof novelId !== 'number') {
                      debugLog('toggle blocked: invalid novelId', {
                        novelId,
                        type: typeof novelId,
                      });
                      return;
                    }

                    const enabled = !useNovelTtsSettings;

                    debugLog('toggle pressed', {
                      novelId,
                      prev: useNovelTtsSettings,
                      next: enabled,
                    });

                    setUseNovelTtsSettings(enabled);
                    persistNovelTtsEnabled(enabled);

                    if (enabled && tts) {
                      // Capture current global TTS as novel baseline immediately.
                      setNovelTtsSettings(novelId, {
                        enabled: true,
                        tts,
                      });

                      debugLog('saved baseline tts on enable', {
                        novelId,
                        tts,
                        next: getNovelTtsSettings(novelId),
                      });
                    }

                    // When turning ON, capture current global TTS as novel baseline.
                    // When turning OFF, we just stop persisting novel overrides.
                  }}
                />
              </View>
            </View>

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
                  <AppText
                    style={[styles.sliderLabel, { color: theme.onSurface }]}
                  >
                    Speed
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
                      setTtsSettings({ ...tts, rate: newValue });
                      postTTSSettingsToWebView({ rate: newValue });
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
                      setTtsSettings({ ...tts, rate: value });
                      postTTSSettingsToWebView({ rate: value });
                    }}
                  />
                  <Pressable
                    style={styles.sliderButton}
                    onPress={() => {
                      const newValue = Math.min(3, localRate + 0.1);
                      setLocalRate(newValue);
                      setTtsSettings({ ...tts, rate: newValue });
                      postTTSSettingsToWebView({ rate: newValue });
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
              </View>

              {/* Voice Pitch Slider */}
              <View style={styles.sliderSection}>
                <View style={styles.sliderLabelRow}>
                  <AppText
                    style={[styles.sliderLabel, { color: theme.onSurface }]}
                  >
                    Pitch
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
                      setTtsSettings({ ...tts, pitch: newValue });
                      postTTSSettingsToWebView({ pitch: newValue });
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
                      setTtsSettings({ ...tts, pitch: value });
                      postTTSSettingsToWebView({ pitch: value });
                    }}
                  />
                  <Pressable
                    style={styles.sliderButton}
                    onPress={() => {
                      const newValue = Math.min(2, localPitch + 0.1);
                      setLocalPitch(newValue);
                      setTtsSettings({ ...tts, pitch: newValue });
                      postTTSSettingsToWebView({ pitch: newValue });
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
                <AppText
                  style={[styles.switchLabel, { color: theme.onSurface }]}
                >
                  Highlight paragraph
                </AppText>
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
                <AppText
                  style={[styles.switchLabel, { color: theme.onSurface }]}
                >
                  Background playback
                </AppText>
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
          onVoiceSelect={handleVoiceSelect}
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
