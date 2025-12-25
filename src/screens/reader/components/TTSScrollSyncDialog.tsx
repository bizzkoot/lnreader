import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';
import { ThemeColors } from '@theme/types';
import Button from '@components/Button/Button';
import { useBackHandler } from '@hooks/index';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

interface TTSScrollSyncDialogProps {
  visible: boolean;
  theme: ThemeColors;
  currentIndex: number;
  visibleIndex: number;
  currentChapterName?: string;
  visibleChapterName?: string;
  isStitched?: boolean;
  onSyncToVisible: () => void;
  onKeepCurrent: () => void;
  onDismiss: () => void;
}

const TTSScrollSyncDialog: React.FC<TTSScrollSyncDialogProps> = ({
  visible,
  theme,
  currentIndex,
  visibleIndex,
  currentChapterName,
  visibleChapterName,
  isStitched,
  onSyncToVisible,
  onKeepCurrent,
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
          lineHeight: scaleDimension(24, uiScale),
          letterSpacing: 0,
        },
        boldText: {
          fontWeight: 'bold',
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
  // When back is pressed while dialog visible, call safe default action (keep current position)
  useBackHandler(() => {
    if (visible) {
      onKeepCurrent();
      onDismiss();
      return true; // Consume the event
    }
    return false;
  });

  const isAhead = visibleIndex > currentIndex;
  const directionText = isAhead ? 'ahead' : 'back';

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={[styles.container, { backgroundColor: theme.overlay3 }]}
      >
        <Dialog.Title style={{ color: theme.onSurface }}>
          Change TTS Reading Position?
        </Dialog.Title>
        <Dialog.Content>
          {isStitched && currentChapterName && visibleChapterName ? (
            <Text style={[styles.content, { color: theme.onSurface }]}>
              You have scrolled{' '}
              <Text style={[styles.boldText, { color: theme.onSurface }]}>
                {directionText}
              </Text>{' '}
              to:{'\n'}
              <Text style={[styles.boldText, { color: theme.primary }]}>
                • {visibleChapterName}
              </Text>
              {'\n'}• Paragraph {visibleIndex + 1}
              {'\n\n'}
              TTS was paused at:{'\n'}
              <Text style={[styles.boldText, { color: theme.primary }]}>
                • {currentChapterName}
              </Text>
              {'\n'}• Paragraph {currentIndex + 1}
              {'\n\n'}
              Continue from current position or resume where you paused?
            </Text>
          ) : (
            <Text style={[styles.content, { color: theme.onSurface }]}>
              You have scrolled{' '}
              <Text style={[styles.boldText, { color: theme.onSurface }]}>
                {directionText}
              </Text>{' '}
              to paragraph {visibleIndex + 1}.{'\n\n'}
              Do you want to continue reading from here, or go back to where you
              paused (paragraph {currentIndex + 1})?
            </Text>
          )}
        </Dialog.Content>
        <View style={styles.buttonCtn}>
          <Button
            onPress={() => {
              onSyncToVisible();
              onDismiss();
            }}
            title={
              isStitched && visibleChapterName
                ? `Continue: ${visibleChapterName.length > 35 ? visibleChapterName.substring(0, 32) + '...' : visibleChapterName}`
                : `Continue from Here (Para ${visibleIndex + 1})`
            }
          />
          <Button
            onPress={() => {
              onKeepCurrent();
              onDismiss();
            }}
            title={
              isStitched && currentChapterName
                ? `Resume: ${currentChapterName.length > 35 ? currentChapterName.substring(0, 32) + '...' : currentChapterName}`
                : `Resume from Saved (Para ${currentIndex + 1})`
            }
            mode="outlined"
          />
        </View>
      </Dialog>
    </Portal>
  );
};

export default TTSScrollSyncDialog;
