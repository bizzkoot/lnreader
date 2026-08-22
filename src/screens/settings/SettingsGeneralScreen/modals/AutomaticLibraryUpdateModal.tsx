import React from 'react';
import { StyleSheet, View } from 'react-native';
import AppText from '@components/AppText';
import { Portal } from 'react-native-paper';
import { ThemeColors } from '@theme/types';
import {
  useAppSettings,
  SUPPORTED_LIBRARY_UPDATE_INTERVAL_HOURS,
  SupportedLibraryUpdateIntervalHours,
} from '@hooks/persisted/useSettings';
import { scaleDimension } from '@theme/scaling';
import { getString } from '@strings/translations';
import { Modal } from '@components';
import { RadioButton } from '@components/RadioButton/RadioButton';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  theme: ThemeColors;
}

const AutomaticLibraryUpdateModal: React.FC<Props> = ({
  visible,
  onDismiss,
  theme,
}) => {
  const {
    automaticLibraryUpdateIntervalHours = 0,
    setAppSettings,
    uiScale = 1.0,
  } = useAppSettings() as ReturnType<typeof useAppSettings> & {
    uiScale?: number;
  };
  const resolvedUiScale = uiScale ?? 1.0;

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        modalHeader: {
          fontSize: scaleDimension(24, resolvedUiScale),
          marginBottom: 16,
          paddingHorizontal: 24,
        },
        optionsContainer: {
          paddingHorizontal: 8,
        },
      }),
    [resolvedUiScale],
  );

  const options: {
    label: string;
    value: SupportedLibraryUpdateIntervalHours;
  }[] = SUPPORTED_LIBRARY_UPDATE_INTERVAL_HOURS.map(value => ({
    label: getString(
      `generalSettingsScreen.${
        value === 0
          ? 'automaticUpdateOff'
          : value === 12
            ? 'automaticUpdateEvery12h'
            : value === 24
              ? 'automaticUpdateEvery24h'
              : value === 48
                ? 'automaticUpdateEvery48h'
                : value === 72
                  ? 'automaticUpdateEvery72h'
                  : 'automaticUpdateEveryWeek'
      }` as any,
    ),
    value,
  }));

  const handleSelect = (value: SupportedLibraryUpdateIntervalHours) => {
    setAppSettings({ automaticLibraryUpdateIntervalHours: value });
    onDismiss();
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss}>
        <AppText style={[styles.modalHeader, { color: theme.onSurface }]}>
          {getString('generalSettingsScreen.automaticUpdate')}
        </AppText>
        <View style={styles.optionsContainer}>
          {options.map(option => (
            <RadioButton
              key={String(option.value)}
              label={option.label}
              status={automaticLibraryUpdateIntervalHours === option.value}
              onPress={() => handleSelect(option.value)}
              theme={theme}
              labelStyle={{ fontSize: scaleDimension(16, resolvedUiScale) }}
            />
          ))}
        </View>
      </Modal>
    </Portal>
  );
};

export default AutomaticLibraryUpdateModal;
