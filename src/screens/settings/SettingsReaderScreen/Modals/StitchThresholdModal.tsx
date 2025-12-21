import React from 'react';
import { StyleSheet } from 'react-native';
import { Portal } from 'react-native-paper';
import { Modal } from '@components';
import { RadioButton } from '@components/RadioButton/RadioButton';
import { useTheme, useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

interface StitchThresholdModalProps {
  visible: boolean;
  onDismiss: () => void;
  currentValue: 50 | 55 | 60 | 65 | 70 | 75 | 80 | 85 | 90 | 95;
  onSelect: (value: 50 | 55 | 60 | 65 | 70 | 75 | 80 | 85 | 90 | 95) => void;
}

const StitchThresholdModal: React.FC<StitchThresholdModalProps> = ({
  visible,
  onDismiss,
  currentValue,
  onSelect,
}) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();

  const options: {
    label: string;
    value: 50 | 55 | 60 | 65 | 70 | 75 | 80 | 85 | 90 | 95;
  }[] = [
    { label: '50% - Very Early', value: 50 },
    { label: '55%', value: 55 },
    { label: '60%', value: 60 },
    { label: '65%', value: 65 },
    { label: '70%', value: 70 },
    { label: '75%', value: 75 },
    { label: '80%', value: 80 },
    { label: '85%', value: 85 },
    { label: '90% - Balanced (Default)', value: 90 },
    { label: '95% - Late', value: 95 },
  ];

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        containerStyle: {
          paddingBottom: scaleDimension(16, uiScale),
        },
      }),
    [uiScale],
  );

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.containerStyle}
      >
        {options.map(option => (
          <RadioButton
            key={option.value}
            status={currentValue === option.value}
            onPress={() => {
              onSelect(option.value);
              onDismiss();
            }}
            label={option.label}
            theme={theme}
            labelStyle={{ fontSize: scaleDimension(16, uiScale) }}
          />
        ))}
      </Modal>
    </Portal>
  );
};

export default StitchThresholdModal;
