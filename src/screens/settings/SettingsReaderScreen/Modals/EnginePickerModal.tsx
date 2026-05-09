import React, { useEffect, useState } from 'react';
import { Portal, ActivityIndicator } from 'react-native-paper';
import { RadioButton } from '@components/RadioButton/RadioButton';
import {
  useTheme,
  useAppSettings,
  useChapterReaderSettings,
} from '@hooks/persisted';
import TTSHighlight, { TTSEngine } from '@services/TTSHighlight';
import TTSAudioManager from '@services/TTSAudioManager';
import { scaleDimension } from '@theme/scaling';
import { Modal } from '@components';
import { StyleSheet, ScrollView, Dimensions } from 'react-native';

interface EnginePickerModalProps {
  visible: boolean;
  onDismiss: () => void;
  onEngineSelected?: (engine: TTSEngine) => void;
  currentEngine?: string;
}

const EnginePickerModal: React.FC<EnginePickerModalProps> = ({
  onDismiss,
  visible,
  onEngineSelected,
  currentEngine: currentEngineProp,
}) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();
  const { setChapterReaderSettings, tts } = useChapterReaderSettings();
  const [engines, setEngines] = useState<TTSEngine[]>([]);

  useEffect(() => {
    if (visible) {
      TTSHighlight.getEngines()
        .then(engineList => {
          setEngines(engineList);
        })
        .catch(() => {
          setEngines([]);
        });
    }
  }, [visible]);

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

  const currentEngine = currentEngineProp || tts?.engine || 'default';

  const engineList: TTSEngine[] = [
    { name: 'default', label: 'System Default' },
    ...engines,
  ];

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.containerStyle]}
      >
        {engineList.length === 0 ? (
          <ActivityIndicator
            size={scaleDimension(24, uiScale)}
            style={styles.marginTop}
            color={theme.primary}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.paddingHorizontal}>
            {engineList.map(item => (
              <RadioButton
                key={item.name}
                status={item.name === currentEngine}
                onPress={() => {
                  const engineName = item.name === 'default' ? '' : item.name;
                  if (item.name !== currentEngine) {
                    TTSAudioManager.switchEngine(engineName);
                    if (!onEngineSelected) {
                      setChapterReaderSettings({
                        tts: {
                          ...tts,
                          engine:
                            item.name === 'default' ? undefined : item.name,
                          voice: undefined,
                        },
                      });
                    }
                    onEngineSelected?.(item);
                  } else {
                    onDismiss();
                  }
                }}
                label={item.label || item.name}
                theme={theme}
                labelStyle={{ fontSize: scaleDimension(16, uiScale) }}
              />
            ))}
          </ScrollView>
        )}
      </Modal>
    </Portal>
  );
};

export default EnginePickerModal;
