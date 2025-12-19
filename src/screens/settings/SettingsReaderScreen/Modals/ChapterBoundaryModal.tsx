import React from 'react';
import { StyleSheet } from 'react-native';
import { Portal } from 'react-native-paper';
import { Modal } from '@components';
import { RadioButton } from '@components/RadioButton/RadioButton';
import { useTheme, useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

interface ChapterBoundaryModalProps {
  visible: boolean;
  onDismiss: () => void;
  currentValue: 'stitched' | 'bordered';
  onSelect: (value: 'stitched' | 'bordered') => void;
}

const ChapterBoundaryModal: React.FC<ChapterBoundaryModalProps> = ({
  visible,
  onDismiss,
  currentValue,
  onSelect,
}) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();

  const options: { label: string; value: 'stitched' | 'bordered' }[] = [
    { label: 'Bordered', value: 'bordered' },
    { label: 'Stitched', value: 'stitched' },
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

export default ChapterBoundaryModal;
