import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';
import { ThemeColors } from '@theme/types';
import Button from '@components/Button/Button';
import { useBackHandler } from '@hooks/index';

interface TTSResumeDialogProps {
  visible: boolean;
  theme: ThemeColors;
  onResume: () => void;
  onRestart: () => void;
  onRestartChapter: () => void;
  onDismiss: () => void;
}

const TTSResumeDialog: React.FC<TTSResumeDialogProps> = ({
  visible,
  theme,
  onResume,
  onRestart,
  onRestartChapter,
  onDismiss,
}) => {
  // FIX Case 5.2: Handle Android back button press
  // When back is pressed while dialog visible, just dismiss (user can re-open TTS later)
  useBackHandler(() => {
    if (visible) {
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
          Resume TTS
        </Dialog.Title>
        <Dialog.Content>
          <Text style={[styles.content, { color: theme.onSurface }]}>
            Choose a starting point:
          </Text>
        </Dialog.Content>
        <View style={styles.buttonCtn}>
          <Button
            onPress={() => {
              onResume();
              onDismiss();
            }}
            title="Resume"
            icon="play"
            mode="contained"
          />
          <Button
            onPress={() => {
              onRestart();
              onDismiss();
            }}
            title="Start from Top"
            icon="format-vertical-align-top"
            mode="outlined"
          />
          <Button
            onPress={() => {
              onRestartChapter();
              onDismiss();
            }}
            title="Restart Chapter"
            icon="restart"
            mode="text"
            textColor={theme.error}
          />
        </View>
      </Dialog>
    </Portal>
  );
};

export default TTSResumeDialog;

const styles = StyleSheet.create({
  container: {
    borderRadius: 28,
    shadowColor: 'transparent',
  },
  content: {
    fontSize: 16,
    letterSpacing: 0,
    marginBottom: 8,
  },
  buttonCtn: {
    flexDirection: 'column',
    padding: 16,
    gap: 12,
  },
});
