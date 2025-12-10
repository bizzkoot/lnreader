import React, { useMemo } from 'react';
import { Text, StyleSheet } from 'react-native';

import { Portal } from 'react-native-paper';

import { RadioButton } from '@components/RadioButton/RadioButton';
import { ThemeColors } from '@theme/types';
import { getString } from '@strings/translations';
import { useAppSettings, useBrowseSettings } from '@hooks/persisted/index';
import { Modal } from '@components';
import { scaleDimension } from '@theme/scaling';

interface DisplayModeModalProps {
  globalSearchConcurrency: number;
  modalVisible: boolean;
  hideModal: () => void;
  theme: ThemeColors;
}

const ConcurrentSearchesModal: React.FC<DisplayModeModalProps> = ({
  theme,
  globalSearchConcurrency,
  hideModal,
  modalVisible,
}) => {
  const { setBrowseSettings } = useBrowseSettings();
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        modalHeader: {
          fontSize: scaleDimension(24, uiScale),
          marginBottom: scaleDimension(10, uiScale),
          paddingHorizontal: scaleDimension(24, uiScale),
        },
      }),
    [uiScale],
  );

  return (
    <Portal>
      <Modal visible={modalVisible} onDismiss={hideModal}>
        <Text style={[styles.modalHeader, { color: theme.onSurface }]}>
          {getString('browseSettingsScreen.concurrentSearches')}
        </Text>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(concurrency => (
          <RadioButton
            key={concurrency}
            status={globalSearchConcurrency === concurrency}
            onPress={() =>
              setBrowseSettings({ globalSearchConcurrency: concurrency })
            }
            label={concurrency.toString()}
            theme={theme}
          />
        ))}
      </Modal>
    </Portal>
  );
};

export default ConcurrentSearchesModal;
