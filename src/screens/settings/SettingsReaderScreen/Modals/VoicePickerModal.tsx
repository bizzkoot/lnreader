import React, { useState } from 'react';
import { Voice } from 'expo-speech';

import { Portal, TextInput, ActivityIndicator } from 'react-native-paper';
import { RadioButton } from '@components/RadioButton/RadioButton';

import {
  useChapterReaderSettings,
  useTheme,
  useAppSettings,
} from '@hooks/persisted';
import { TTSVoice } from '@services/TTSHighlight';
import { scaleDimension } from '@theme/scaling';
import { LegendList } from '@legendapp/list';
import { Modal } from '@components';
import { StyleSheet } from 'react-native';
import { useScaledDimensions } from '@hooks/useScaledDimensions';

interface VoicePickerModalProps {
  visible: boolean;
  onDismiss: () => void;
  voices: TTSVoice[];
  onVoiceSelect?: (voice: TTSVoice) => void;
}

const VoicePickerModal: React.FC<VoicePickerModalProps> = ({
  onDismiss,
  visible,
  voices,
  onVoiceSelect,
}) => {
  const theme = useTheme();
  const { iconSize } = useScaledDimensions();
  const [searchedVoices, setSearchedVoices] = useState<TTSVoice[]>([]);
  const [searchText, setSearchText] = useState('');
  const { setChapterReaderSettings, tts } = useChapterReaderSettings();

  const { uiScale = 1.0 } = useAppSettings();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        containerStyle: {
          flex: 1,
        },
        paddingHorizontal: { paddingHorizontal: scaleDimension(12, uiScale) },
        marginTop: { marginTop: scaleDimension(16, uiScale) },
      }),
    [uiScale],
  );

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.containerStyle]}
      >
        <LegendList
          recycleItems
          ListHeaderComponent={
            <TextInput
              mode="outlined"
              underlineColor={theme.outline}
              theme={{ colors: { ...theme } }}
              onChangeText={text => {
                setSearchText(text);
                setSearchedVoices(
                  voices.filter(voice =>
                    voice.name
                      .toLocaleLowerCase()
                      .includes(text.toLocaleLowerCase()),
                  ),
                );
              }}
              value={searchText}
              placeholder="Search voice"
              style={{ fontSize: scaleDimension(16, uiScale) }}
            />
          }
          ListHeaderComponentStyle={styles.paddingHorizontal}
          data={searchText ? searchedVoices : voices}
          extraData={tts?.voice}
          renderItem={({ item }) => {
            // Add quality badge to label for non-default voices
            let labelWithBadge = item.name;
            if (item.identifier !== 'default') {
              // Import and use classifyVoiceQuality locally
              // Quality thresholds: 400+ = Neural, 200-399 = Enhanced, <200 = Standard
              const quality =
                typeof item.quality === 'number'
                  ? item.quality
                  : typeof item.quality === 'string'
                    ? parseInt(item.quality, 10)
                    : 0;
              const qualityLabel =
                quality >= 400
                  ? 'Neural'
                  : quality >= 200
                    ? 'Enhanced'
                    : 'Standard';
              labelWithBadge = `${item.name} (${qualityLabel})`;
            }

            return (
              <RadioButton
                key={item.identifier}
                status={item.identifier === tts?.voice?.identifier}
                onPress={() => {
                  setChapterReaderSettings({
                    tts: { ...tts, voice: item as Voice },
                  });
                  onVoiceSelect?.(item);
                }}
                label={labelWithBadge}
                theme={theme}
                labelStyle={{ fontSize: scaleDimension(16, uiScale) }}
              />
            );
          }}
          keyExtractor={(item, index) =>
            item.identifier || `voice_${index}_${item.name}`
          }
          estimatedItemSize={scaleDimension(64, uiScale)}
          ListEmptyComponent={
            <ActivityIndicator
              size={iconSize.md}
              style={styles.marginTop}
              color={theme.primary}
            />
          }
        />
      </Modal>
    </Portal>
  );
};

export default VoicePickerModal;
