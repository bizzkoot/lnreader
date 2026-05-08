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
import { LegendList } from '@legendapp/list';
import { Modal } from '@components';
import { StyleSheet } from 'react-native';

interface EnginePickerModalProps {
  visible: boolean;
  onDismiss: () => void;
  onEngineSelected?: (engine: TTSEngine) => void;
}

const EnginePickerModal: React.FC<EnginePickerModalProps> = ({
  onDismiss,
  visible,
  onEngineSelected,
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
          flex: 1,
        },
        paddingHorizontal: { paddingHorizontal: scaleDimension(12, uiScale) },
        marginTop: { marginTop: scaleDimension(16, uiScale) },
      }),
    [uiScale],
  );

  const currentEngine = tts?.engine || 'default';

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
        <LegendList
          recycleItems
          data={engineList}
          extraData={currentEngine}
          renderItem={({ item }) => (
            <RadioButton
              key={item.name}
              status={item.name === currentEngine}
              onPress={() => {
                const engineName = item.name === 'default' ? '' : item.name;
                if (item.name !== currentEngine) {
                  TTSAudioManager.switchEngine(engineName);
                }
                onEngineSelected?.(item);
              }}
              label={item.label || item.name}
              theme={theme}
              labelStyle={{ fontSize: scaleDimension(16, uiScale) }}
            />
          )}
          keyExtractor={item => item.name}
          estimatedItemSize={scaleDimension(64, uiScale)}
          ListEmptyComponent={
            <ActivityIndicator
              size={scaleDimension(24, uiScale)}
              style={styles.marginTop}
              color={theme.primary}
            />
          }
        />
      </Modal>
    </Portal>
  );
};

export default EnginePickerModal;
