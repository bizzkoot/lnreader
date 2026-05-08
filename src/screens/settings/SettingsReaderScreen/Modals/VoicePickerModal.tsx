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
import { Modal } from '@components';
import { StyleSheet, ScrollView, Dimensions } from 'react-native';
import { useScaledDimensions } from '@hooks/useScaledDimensions';

interface VoicePickerModalProps {
  visible: boolean;
  onDismiss: () => void;
  voices: TTSVoice[];
  onVoiceSelect?: (voice: TTSVoice) => void;
  currentVoiceIdentifier?: string;
}

const VoicePickerModal: React.FC<VoicePickerModalProps> = ({
  onDismiss,
  visible,
  voices,
  onVoiceSelect,
  currentVoiceIdentifier,
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
          maxHeight: Math.round(Dimensions.get('window').height * 0.65),
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
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.paddingHorizontal}
        >
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
          {(searchText ? searchedVoices : voices).length === 0 ? (
            <ActivityIndicator
              size={iconSize.md}
              style={styles.marginTop}
              color={theme.primary}
            />
          ) : (
            (searchText ? searchedVoices : voices).map((item, index) => (
              <RadioButton
                key={item.identifier || `voice_${index}_${item.name}`}
                status={
                  item.identifier ===
                  (currentVoiceIdentifier || tts?.voice?.identifier)
                }
                onPress={() => {
                  if (!onVoiceSelect) {
                    setChapterReaderSettings({
                      tts: { ...tts, voice: item as Voice },
                    });
                  }
                  onVoiceSelect?.(item);
                }}
                label={item.name}
                theme={theme}
                labelStyle={{ fontSize: scaleDimension(16, uiScale) }}
              />
            ))
          )}
        </ScrollView>
      </Modal>
    </Portal>
  );
};

export default VoicePickerModal;
