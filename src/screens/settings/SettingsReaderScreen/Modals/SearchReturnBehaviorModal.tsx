import React from 'react';
import { StyleSheet } from 'react-native';
import { Portal } from 'react-native-paper';
import { Modal } from '@components';
import { RadioButton } from '@components/RadioButton/RadioButton';
import { useAppSettings, useTheme } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

import { getString } from '@strings/translations';

type SearchReturnBehavior = 'countdown' | 'immediate' | 'stay';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  currentValue: SearchReturnBehavior;
  onSelect: (value: SearchReturnBehavior) => void;
}

const SearchReturnBehaviorModal: React.FC<Props> = ({
  visible,
  onDismiss,
  currentValue,
  onSelect,
}) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();

  const options: {
    label: string;
    description: string;
    value: SearchReturnBehavior;
  }[] = [
    {
      label: getString('readerSettings.searchReturnBehavior.countdown'),
      description: getString(
        'readerSettings.searchReturnBehavior.countdownDesc',
      ),
      value: 'countdown',
    },
    {
      label: getString('readerSettings.searchReturnBehavior.immediate'),
      description: getString(
        'readerSettings.searchReturnBehavior.immediateDesc',
      ),
      value: 'immediate',
    },
    {
      label: getString('readerSettings.searchReturnBehavior.stay'),
      description: getString('readerSettings.searchReturnBehavior.stayDesc'),
      value: 'stay',
    },
  ];

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        containerStyle: { paddingBottom: scaleDimension(16, uiScale) },
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
            label={`${option.label} — ${option.description}`}
            theme={theme}
            labelStyle={{ fontSize: scaleDimension(14, uiScale) }}
          />
        ))}
      </Modal>
    </Portal>
  );
};

export default SearchReturnBehaviorModal;
