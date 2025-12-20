import React from 'react';
import { StyleSheet } from 'react-native';
import { Portal } from 'react-native-paper';
import { Modal } from '@components';
import { RadioButton } from '@components/RadioButton/RadioButton';
import { useTheme, useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

interface TransitionThresholdModalProps {
  visible: boolean;
  onDismiss: () => void;
  currentValue: 5 | 10 | 15 | 20;
  onSelect: (value: 5 | 10 | 15 | 20) => void;
}

const TransitionThresholdModal: React.FC<TransitionThresholdModalProps> = ({
  visible,
  onDismiss,
  currentValue,
  onSelect,
}) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();

  const options: { label: string; value: 5 | 10 | 15 | 20 }[] = [
    { label: '5% - Very Early', value: 5 },
    { label: '10% - Early', value: 10 },
    { label: '15% - Balanced (Default)', value: 15 },
    { label: '20% - Late', value: 20 },
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

export default TransitionThresholdModal;
