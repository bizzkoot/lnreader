import React from 'react';
import { StyleSheet } from 'react-native';
import { Portal } from 'react-native-paper';
import { Modal } from '@components';
import { RadioButton } from '@components/RadioButton/RadioButton';
import { useTheme, useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

interface AutoResumeModalProps {
  visible: boolean;
  onDismiss: () => void;
  currentValue: 'always' | 'prompt' | 'never';
  onSelect: (value: 'always' | 'prompt' | 'never') => void;
}

const AutoResumeModal: React.FC<AutoResumeModalProps> = ({
  visible,
  onDismiss,
  currentValue,
  onSelect,
}) => {
  const theme = useTheme();

  const { uiScale = 1.0 } = useAppSettings();

  const options: { label: string; value: 'always' | 'prompt' | 'never' }[] = [
    { label: 'Always resume', value: 'always' },
    { label: 'Ask every time', value: 'prompt' },
    { label: 'Never resume', value: 'never' },
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

export default AutoResumeModal;
