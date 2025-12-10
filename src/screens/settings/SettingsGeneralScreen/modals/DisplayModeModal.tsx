import {
  DisplayModes,
  displayModesList,
} from '@screens/library/constants/constants';
import React from 'react';
import { Text, StyleSheet } from 'react-native';

import { Portal } from 'react-native-paper';

import { RadioButton } from '@components/RadioButton/RadioButton';

import { ThemeColors } from '@theme/types';
import { useLibrarySettings, useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import { getString } from '@strings/translations';
import { Modal } from '@components';

interface DisplayModeModalProps {
  displayMode: DisplayModes;
  displayModalVisible: boolean;
  hideDisplayModal: () => void;
  theme: ThemeColors;
}

const DisplayModeModal: React.FC<DisplayModeModalProps> = ({
  theme,
  displayMode,
  hideDisplayModal,
  displayModalVisible,
}) => {
  const { setLibrarySettings } = useLibrarySettings();
  const { uiScale = 1.0 } = useAppSettings();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        modalHeader: {
          fontSize: scaleDimension(24, uiScale),
          marginBottom: 10,
        },
      }),
    [uiScale],
  );

  return (
    <Portal>
      <Modal visible={displayModalVisible} onDismiss={hideDisplayModal}>
        <Text style={[styles.modalHeader, { color: theme.onSurface }]}>
          {getString('generalSettingsScreen.displayMode')}
        </Text>
        {displayModesList.map(mode => (
          <RadioButton
            key={mode.value}
            status={displayMode === mode.value}
            onPress={() => setLibrarySettings({ displayMode: mode.value })}
            label={mode.label}
            theme={theme}
            labelStyle={{ fontSize: scaleDimension(16, uiScale) }}
          />
        ))}
      </Modal>
    </Portal>
  );
};

export default DisplayModeModal;
