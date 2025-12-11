import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';
import { ThemeColors } from '@theme/types';
import Button from '@components/Button/Button';
import { useBackHandler } from '@hooks/index';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

interface TTSManualModeDialogProps {
  visible: boolean;
  theme: ThemeColors;
  onStopTTS: () => void;
  onContinueFollowing: () => void;
  onDismiss: () => void;
}

const TTSManualModeDialog: React.FC<TTSManualModeDialogProps> = ({
  visible,
  theme,
  onStopTTS,
  onContinueFollowing,
  onDismiss,
}) => {
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          borderRadius: scaleDimension(28, uiScale),
          shadowColor: 'transparent',
        },
        content: {
          fontSize: scaleDimension(16, uiScale),
          letterSpacing: 0,
        },
        buttonCtn: {
          flexDirection: 'column',
          padding: scaleDimension(16, uiScale),
          gap: scaleDimension(8, uiScale),
        },
      }),
    [uiScale],
  );

  // FIX Case 5.2: Handle Android back button press
  // When back is pressed while dialog visible, call safe default action (continue following)
  useBackHandler(() => {
    if (visible) {
      onContinueFollowing();
      onDismiss();
      return true; // Consume the event
    }
    return false;
  });

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={[styles.container, { backgroundColor: theme.overlay3 }]}
      >
        <Dialog.Title style={{ color: theme.onSurface }}>
          Switch to Manual Reading?
        </Dialog.Title>
        <Dialog.Content>
          <Text style={[styles.content, { color: theme.onSurface }]}>
            You scrolled away from the current TTS reading position. Would you
            like to stop TTS and continue reading manually, or let TTS continue
            following the text progression?
          </Text>
        </Dialog.Content>
        <View style={styles.buttonCtn}>
          <Button
            onPress={() => {
              onStopTTS();
              onDismiss();
            }}
            title="Stop TTS & Read Manually"
          />
          <Button
            onPress={() => {
              onContinueFollowing();
              onDismiss();
            }}
            title="Continue Following"
          />
        </View>
      </Dialog>
    </Portal>
  );
};

export default TTSManualModeDialog;
