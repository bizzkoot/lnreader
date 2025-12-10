import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getString } from '@strings/translations';

import { Dialog, Portal } from 'react-native-paper';
import { ThemeColors } from '../../theme/types';
import Button from '../Button/Button';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

interface ConfirmationDialogProps {
  title?: string;
  message?: string;
  visible: boolean;
  theme: ThemeColors;
  onSubmit: () => void;
  onDismiss: () => void;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  title = getString('common.warning'),
  message,
  visible,
  onDismiss,
  theme,
  onSubmit,
}) => {
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        buttonCtn: {
          flexDirection: 'row-reverse',
          padding: scaleDimension(16, uiScale),
        },
        container: {
          borderRadius: scaleDimension(28, uiScale),
          shadowColor: 'transparent',
        },
        content: {
          fontSize: scaleDimension(16, uiScale),
          letterSpacing: 0,
        },
      }),
    [uiScale],
  );

  const handleOnSubmit = () => {
    onSubmit();
    onDismiss();
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={[styles.container, { backgroundColor: theme.overlay3 }]}
      >
        <Dialog.Title style={{ color: theme.onSurface }}>{title}</Dialog.Title>
        {message ? (
          <Dialog.Content>
            <Text style={[styles.content, { color: theme.onSurface }]}>
              {message}
            </Text>
          </Dialog.Content>
        ) : null}
        <View style={styles.buttonCtn}>
          <Button onPress={handleOnSubmit} title={getString('common.ok')} />
          <Button onPress={onDismiss} title={getString('common.cancel')} />
        </View>
      </Dialog>
    </Portal>
  );
};

export default ConfirmationDialog;
