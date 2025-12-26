import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { TextInput } from 'react-native-paper';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { defaultTo } from 'lodash-es';
import {
  useAppSettings,
  useChapterGeneralSettings,
  useTheme,
} from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import { getString } from '@strings/translations';
import { List, Button } from '@components/index';
import SettingSwitch from '../../components/SettingSwitch';
import { useBoolean } from '@hooks';
import ContinuousScrollingModal from '../Modals/ContinuousScrollingModal';
import ChapterBoundaryModal from '../Modals/ChapterBoundaryModal';
import TransitionThresholdModal from '../Modals/TransitionThresholdModal';
import StitchThresholdModal from '../Modals/StitchThresholdModal';

const NavigationTab: React.FC = () => {
  const theme = useTheme();
  const {
    useVolumeButtons = false,
    volumeButtonsOffset = null,
    verticalSeekbar = true,
    swipeGestures = false,
    pageReader = false,
    autoScroll = false,
    autoScrollInterval = 10,
    autoScrollOffset = null,
    tapToScroll = false,
    autoMarkShortChapters = true,
    continuousScrolling = 'disabled',
    continuousScrollBoundary = 'bordered',
    continuousScrollTransitionThreshold = 15,
    continuousScrollStitchThreshold = 90,
    setChapterGeneralSettings,
  } = useChapterGeneralSettings();

  const { height: screenHeight } = useWindowDimensions();

  const areAutoScrollSettingsDefault =
    autoScrollInterval === 10 && autoScrollOffset === null;

  const { uiScale = 1.0 } = useAppSettings();

  const {
    value: continuousScrollingModalVisible,
    setTrue: showContinuousScrollingModal,
    setFalse: hideContinuousScrollingModal,
  } = useBoolean();

  const {
    value: chapterBoundaryModalVisible,
    setTrue: showChapterBoundaryModal,
    setFalse: hideChapterBoundaryModal,
  } = useBoolean();

  const {
    value: transitionThresholdModalVisible,
    setTrue: showTransitionThresholdModal,
    setFalse: hideTransitionThresholdModal,
  } = useBoolean();

  const {
    value: stitchThresholdModalVisible,
    setTrue: showStitchThresholdModal,
    setFalse: hideStitchThresholdModal,
  } = useBoolean();

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
        inputContainer: {
          paddingHorizontal: 16,
          paddingVertical: 8,
        },
        textInput: {
          fontSize: scaleDimension(14, uiScale),
        },
        buttonContainer: {
          marginHorizontal: 16,
          marginVertical: 8,
        },
        button: {
          marginVertical: 8,
        },
        bottomSpacing: {
          height: 24,
        },
      }),
    [uiScale],
  );

  return (
    <BottomSheetScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.section}>
        <List.SubHeader theme={theme}>Navigation Controls</List.SubHeader>
        <SettingSwitch
          label={getString('readerScreen.bottomSheet.volumeButtonsScroll')}
          value={useVolumeButtons}
          onPress={() =>
            setChapterGeneralSettings({ useVolumeButtons: !useVolumeButtons })
          }
          theme={theme}
        />
        {useVolumeButtons && (
          <View style={styles.inputContainer}>
            <TextInput
              label={getString('readerSettings.volumeButtonsOffset')}
              mode="outlined"
              keyboardType="numeric"
              defaultValue={defaultTo(
                volumeButtonsOffset,
                Math.round(screenHeight * 0.75),
              ).toString()}
              onChangeText={text => {
                if (text) {
                  setChapterGeneralSettings({
                    volumeButtonsOffset: Number(text),
                  });
                }
              }}
              style={styles.textInput}
              theme={{ colors: { ...theme } }}
            />
          </View>
        )}
        <SettingSwitch
          label={getString('readerScreen.bottomSheet.verticalSeekbar')}
          description={getString('readerSettings.verticalSeekbarDesc')}
          value={verticalSeekbar}
          onPress={() =>
            setChapterGeneralSettings({ verticalSeekbar: !verticalSeekbar })
          }
          theme={theme}
        />
        <SettingSwitch
          label={getString('readerScreen.bottomSheet.swipeGestures')}
          value={swipeGestures}
          onPress={() =>
            setChapterGeneralSettings({ swipeGestures: !swipeGestures })
          }
          theme={theme}
        />
        <SettingSwitch
          label={getString('readerScreen.bottomSheet.tapToScroll')}
          value={tapToScroll}
          onPress={() =>
            setChapterGeneralSettings({ tapToScroll: !tapToScroll })
          }
          theme={theme}
        />
      </View>

      <View style={styles.section}>
        <List.SubHeader theme={theme}>Reading Mode</List.SubHeader>
        <SettingSwitch
          label={getString('readerScreen.bottomSheet.pageReader')}
          value={pageReader}
          onPress={() => setChapterGeneralSettings({ pageReader: !pageReader })}
          theme={theme}
        />
      </View>

      <View style={styles.section}>
        <List.SubHeader theme={theme}>Chapter Navigation</List.SubHeader>
        <SettingSwitch
          label="Auto-mark short chapters as read"
          description="Automatically mark chapters that fit on one screen as 100% read when navigating"
          value={autoMarkShortChapters}
          onPress={() =>
            setChapterGeneralSettings({
              autoMarkShortChapters: !autoMarkShortChapters,
            })
          }
          theme={theme}
        />
        <List.Item
          title="Continuous scrolling"
          description={
            continuousScrolling === 'disabled'
              ? 'Disabled (tap/swipe to navigate)'
              : continuousScrolling === 'always'
                ? 'Always load next chapter automatically'
                : 'Ask before loading next chapter'
          }
          onPress={showContinuousScrollingModal}
          theme={theme}
        />
        {continuousScrolling !== 'disabled' && (
          <>
            <List.InfoItem
              title={`When you scroll past ${continuousScrollTransitionThreshold}% in the next chapter, the previous chapter is removed. The screen will briefly fade out (~200ms) while the view redraws to your current reading position.`}
              theme={theme}
            />
            <List.Item
              title="Stitch next chapter threshold"
              description={`Fetch and append next chapter at ${continuousScrollStitchThreshold}% scroll`}
              onPress={showStitchThresholdModal}
              theme={theme}
            />
            <List.Item
              title="Chapter boundary"
              description={
                continuousScrollBoundary === 'bordered'
                  ? 'Bordered: Shows chapter markers with gap'
                  : 'Stitched: Seamless flow without gaps'
              }
              onPress={showChapterBoundaryModal}
              theme={theme}
            />
            <List.Item
              title="Auto-trim threshold"
              description={`Remove previous chapter after scrolling ${continuousScrollTransitionThreshold}% into next chapter`}
              onPress={showTransitionThresholdModal}
              theme={theme}
            />
          </>
        )}
      </View>

      <View style={styles.section}>
        <List.SubHeader theme={theme}>
          {getString('readerScreen.bottomSheet.autoscroll')}
        </List.SubHeader>
        <SettingSwitch
          label={getString('readerScreen.bottomSheet.autoscroll')}
          value={autoScroll}
          onPress={() => setChapterGeneralSettings({ autoScroll: !autoScroll })}
          theme={theme}
        />
        {autoScroll && (
          <>
            <View style={styles.inputContainer}>
              <TextInput
                label={getString('readerSettings.autoScrollInterval')}
                mode="outlined"
                keyboardType="numeric"
                defaultValue={defaultTo(autoScrollInterval, 10).toString()}
                onChangeText={text => {
                  if (text) {
                    setChapterGeneralSettings({
                      autoScrollInterval: Number(text),
                    });
                  }
                }}
                style={styles.textInput}
                theme={{ colors: { ...theme } }}
              />
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                label={getString('readerSettings.autoScrollOffset')}
                mode="outlined"
                keyboardType="numeric"
                defaultValue={defaultTo(
                  autoScrollOffset,
                  Math.round(screenHeight),
                ).toString()}
                onChangeText={text => {
                  if (text) {
                    setChapterGeneralSettings({
                      autoScrollOffset: Number(text),
                    });
                  }
                }}
                style={styles.textInput}
                theme={{ colors: { ...theme } }}
              />
            </View>
            {!areAutoScrollSettingsDefault && (
              <View style={styles.buttonContainer}>
                <Button
                  style={styles.button}
                  title={getString('common.reset')}
                  onPress={() => {
                    setChapterGeneralSettings({ autoScrollInterval: 10 });
                    setChapterGeneralSettings({ autoScrollOffset: null });
                  }}
                />
              </View>
            )}
          </>
        )}
      </View>

      <View style={styles.bottomSpacing} />

      <ContinuousScrollingModal
        visible={continuousScrollingModalVisible}
        onDismiss={hideContinuousScrollingModal}
        currentValue={continuousScrolling}
        onSelect={value => {
          setChapterGeneralSettings({ continuousScrolling: value });
        }}
      />
      <ChapterBoundaryModal
        visible={chapterBoundaryModalVisible}
        onDismiss={hideChapterBoundaryModal}
        currentValue={continuousScrollBoundary}
        onSelect={value => {
          setChapterGeneralSettings({ continuousScrollBoundary: value });
        }}
      />
      <TransitionThresholdModal
        visible={transitionThresholdModalVisible}
        onDismiss={hideTransitionThresholdModal}
        currentValue={continuousScrollTransitionThreshold}
        onSelect={value => {
          setChapterGeneralSettings({
            continuousScrollTransitionThreshold: value,
          });
        }}
      />
      <StitchThresholdModal
        visible={stitchThresholdModalVisible}
        onDismiss={hideStitchThresholdModal}
        currentValue={continuousScrollStitchThreshold}
        onSelect={value => {
          setChapterGeneralSettings({
            continuousScrollStitchThreshold: value,
          });
        }}
      />
    </BottomSheetScrollView>
  );
};

export default NavigationTab;
