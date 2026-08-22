import React from 'react';
import { StyleSheet, View } from 'react-native';
import AppText from '@components/AppText';
import { Portal } from 'react-native-paper';
import { ThemeColors } from '@theme/types';
import { useAppSettings } from '@hooks/persisted/useSettings';
import { scaleDimension } from '@theme/scaling';
import { getString } from '@strings/translations';
import { Modal } from '@components';
import { RadioButton } from '@components/RadioButton/RadioButton';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  theme: ThemeColors;
}

const INACTIVITY_TIMEOUT_OPTIONS: { labelKey: string; value: number }[] = [
  { labelKey: 'generalSettingsScreen.inactivityNever', value: 0 },
  { labelKey: 'generalSettingsScreen.inactivity2min', value: 120000 },
  { labelKey: 'generalSettingsScreen.inactivity5min', value: 300000 },
  { labelKey: 'generalSettingsScreen.inactivity10min', value: 600000 },
  { labelKey: 'generalSettingsScreen.inactivity15min', value: 900000 },
];

const InactivityTimeoutModal: React.FC<Props> = ({
  visible,
  onDismiss,
  theme,
}) => {
  const {
    readingTimeInactivityTimeoutMs = 0,
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

  const handleSelect = (value: number) => {
    setAppSettings({ readingTimeInactivityTimeoutMs: value });
    onDismiss();
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss}>
        <AppText style={[styles.modalHeader, { color: theme.onSurface }]}>
          {getString('generalSettingsScreen.inactivityTimeout')}
        </AppText>
        <View style={styles.optionsContainer}>
          {INACTIVITY_TIMEOUT_OPTIONS.map(option => (
            <RadioButton
              key={String(option.value)}
              // @ts-ignore
              label={getString(option.labelKey)}
              status={readingTimeInactivityTimeoutMs === option.value}
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

export default InactivityTimeoutModal;
