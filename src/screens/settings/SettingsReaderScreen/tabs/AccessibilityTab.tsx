import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Slider from '@react-native-community/slider';
import { Voice, VoiceQuality } from 'expo-speech';
import TTSHighlight, { TTSVoice } from '@services/TTSHighlight';
import {
  useTheme,
  useChapterGeneralSettings,
  useChapterReaderSettings,
} from '@hooks/persisted';
import { getString } from '@strings/translations';
import { List, Button } from '@components/index';
import SettingSwitch from '../../components/SettingSwitch';
import Switch from '@components/Switch/Switch';
import { useBoolean } from '@hooks';
import { Portal } from 'react-native-paper';
import VoicePickerModal from '../Modals/VoicePickerModal';
import TTSScrollBehaviorModal from '../Modals/TTSScrollBehaviorModal';

import AutoResumeModal from '../Modals/AutoResumeModal';

const AccessibilityTab: React.FC = () => {
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
    setChapterGeneralSettings,
  } = useChapterGeneralSettings();

  const { tts, setChapterReaderSettings } = useChapterReaderSettings();
  const [voices, setVoices] = useState<TTSVoice[]>([]);
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

  useEffect(() => {
    TTSHighlight.getVoices().then(res => {
      res.sort((a, b) => a.name.localeCompare(b.name));
      setVoices([{ name: 'System', language: 'System', identifier: 'default', quality: 'default' as any } as TTSVoice, ...res]);
    });
  }, []);

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
              <View style={styles.sliderSection}>
                <Text style={[styles.sliderLabel, { color: theme.onSurface }]}>
                  Voice rate: {tts?.rate?.toFixed(1) || '1.0'}
                </Text>
                <Slider
                  style={styles.slider}
                  value={tts?.rate || 1}
                  minimumValue={0.1}
                  maximumValue={5}
                  step={0.1}
                  minimumTrackTintColor={theme.primary}
                  maximumTrackTintColor={theme.surfaceVariant}
                  thumbTintColor={theme.primary}
                  onSlidingComplete={value =>
                    setChapterReaderSettings({ tts: { ...tts, rate: value } })
                  }
                />
              </View>
              <View style={styles.sliderSection}>
                <Text style={[styles.sliderLabel, { color: theme.onSurface }]}>
                  Voice pitch: {tts?.pitch?.toFixed(1) || '1.0'}
                </Text>
                <Slider
                  style={styles.slider}
                  value={tts?.pitch || 1}
                  minimumValue={0.1}
                  maximumValue={5}
                  step={0.1}
                  minimumTrackTintColor={theme.primary}
                  maximumTrackTintColor={theme.surfaceVariant}
                  thumbTintColor={theme.primary}
                  onSlidingComplete={value =>
                    setChapterReaderSettings({ tts: { ...tts, pitch: value } })
                  }
                />
              </View>
              <View style={styles.resetButtonContainer}>
                <Button
                  title={getString('common.reset')}
                  mode="outlined"
                  onPress={() => {
                    setChapterReaderSettings({
                      tts: {
                        pitch: 1,
                        rate: 1,
                        voice: { name: 'System', language: 'System', identifier: 'default', quality: 'Default' as VoiceQuality } as Voice,
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
          onSelect={value => setChapterGeneralSettings({ ttsAutoResume: value })}
        />
        <TTSScrollBehaviorModal
          visible={scrollPromptModalVisible}
          onDismiss={hideScrollPromptModal}
          theme={theme}
          title="Paused Scroll Behavior"
          currentValue={ttsScrollPrompt}
          onSelect={value => setChapterGeneralSettings({ ttsScrollPrompt: value })}
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
          currentValue={ttsScrollBehavior}
          onSelect={value => setChapterGeneralSettings({ ttsScrollBehavior: value })}
          options={[
            { label: 'Continue reading (Ignore scroll)', value: 'continue' },
            { label: 'Pause TTS when I scroll', value: 'pause-on-scroll' },
          ]}
        />
      </Portal>
    </>
  );
};

export default AccessibilityTab;

const styles = StyleSheet.create({
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
  },
  sliderLabel: {
    fontSize: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  slider: {
    height: 40,
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
