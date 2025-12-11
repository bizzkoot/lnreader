import React from 'react';
import { StyleSheet, View } from 'react-native';
import AppText from '@components/AppText';

import { Portal } from 'react-native-paper';

import { ThemeColors } from '@theme/types';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import { getString } from '@strings/translations';
import { Modal } from '@components';
import { RadioButton } from '@components/RadioButton/RadioButton';

interface AutoDownloadModalProps {
  visible: boolean;
  onDismiss: () => void;
  theme: ThemeColors;
  type: 'remaining' | 'amount';
}

const AutoDownloadModal: React.FC<AutoDownloadModalProps> = ({
  visible,
  onDismiss,
  theme,
  type,
}) => {
  const {
    autoDownloadOnRemaining = 'disabled',
    autoDownloadAmount = '10',
    setAppSettings,
  } = useAppSettings();

  const remainingOptions: {
    label: string;
    value: 'disabled' | '5' | '10' | '15';
  }[] = [
    { label: 'Disabled', value: 'disabled' },
    { label: 'When 5 chapters remain', value: '5' },
    { label: 'When 10 chapters remain', value: '10' },
    { label: 'When 15 chapters remain', value: '15' },
  ];

  const amountOptions: { label: string; value: '5' | '10' | '15' | '20' }[] = [
    { label: '5 chapters', value: '5' },
    { label: '10 chapters', value: '10' },
    { label: '15 chapters', value: '15' },
    { label: '20 chapters', value: '20' },
  ];

  const currentValue =
    type === 'remaining' ? autoDownloadOnRemaining : autoDownloadAmount;
  const options = type === 'remaining' ? remainingOptions : amountOptions;

  const handleSelect = (value: string) => {
    if (type === 'remaining') {
      setAppSettings({
        autoDownloadOnRemaining: value as 'disabled' | '5' | '10' | '15',
      });
    } else {
      setAppSettings({
        autoDownloadAmount: value as '5' | '10' | '15' | '20',
      });
    }
    onDismiss();
  };

  const { uiScale = 1.0 } = useAppSettings();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        modalHeader: {
          fontSize: scaleDimension(24, uiScale),
          marginBottom: 16,
          paddingHorizontal: 24,
        },
        optionsContainer: {
          paddingHorizontal: 8,
        },
      }),
    [uiScale],
  );

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss}>
        <AppText style={[styles.modalHeader, { color: theme.onSurface }]}>
          {type === 'remaining'
            ? getString('generalSettingsScreen.autoDownloadOnRemaining')
            : getString('generalSettingsScreen.autoDownloadAmount')}
        </AppText>
        <View style={styles.optionsContainer}>
          {options.map(option => (
            <RadioButton
              key={option.value}
              label={option.label}
              status={currentValue === option.value}
              onPress={() => handleSelect(option.value)}
              theme={theme}
              labelStyle={{ fontSize: scaleDimension(16, uiScale) }}
            />
          ))}
        </View>
      </Modal>
    </Portal>
  );
};

export default AutoDownloadModal;
