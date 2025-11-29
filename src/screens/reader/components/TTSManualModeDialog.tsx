import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';
import { ThemeColors } from '@theme/types';
import Button from '@components/Button/Button';

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

const styles = StyleSheet.create({
  container: {
    borderRadius: 28,
    shadowColor: 'transparent',
  },
  content: {
    fontSize: 16,
    letterSpacing: 0,
  },
  buttonCtn: {
    flexDirection: 'column',
    padding: 16,
    gap: 8,
  },
});
