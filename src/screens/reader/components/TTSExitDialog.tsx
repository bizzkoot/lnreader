import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';
import { ThemeColors } from '@theme/types';
import Button from '@components/Button/Button';
import { useBackHandler } from '@hooks/index';
import { useScaledDimensions } from '@hooks/useScaledDimensions';

interface TTSExitDialogProps {
  visible: boolean;
  theme: ThemeColors;
  ttsParagraph: number;
  readerParagraph: number;
  onExitTTS: () => void;
  onExitReader: () => void;
  onCancel: () => void;
}

const TTSExitDialog: React.FC<TTSExitDialogProps> = ({
  visible,
  theme,
  ttsParagraph,
  readerParagraph,
  onExitTTS,
  onExitReader,
  onCancel,
}) => {
  const scaledDimensions = useScaledDimensions();
  const styles = useMemo(() => getStyles(scaledDimensions), [scaledDimensions]);

  // Handle Android back button press -> Cancel
  useBackHandler(() => {
    if (visible) {
      onCancel();
      return true; // Consume event
    }
    return false;
  });

  const paragraphDiff = Math.abs(ttsParagraph - readerParagraph);
  const isScrolledAhead = readerParagraph > ttsParagraph;

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onCancel}
        style={[styles.container, { backgroundColor: theme.overlay3 }]}
      >
        <Dialog.Title style={{ color: theme.onSurface }}>
          Save Reading Progress
        </Dialog.Title>
        <Dialog.Content>
          <Text style={[styles.content, { color: theme.onSurface }]}>
            Your scroll position differs from where you stopped TTS by{' '}
            {paragraphDiff} paragraphs.
            {isScrolledAhead
              ? " You've scrolled ahead of the TTS position."
              : ' The TTS was ahead of your scroll position.'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.onSurfaceVariant }]}>
            Which position would you like to save?
          </Text>
        </Dialog.Content>
        <View style={styles.buttonCtn}>
          <Button
            onPress={onExitTTS}
            title={`TTS Position (Paragraph ${ttsParagraph + 1})`}
          />
          <Button
            onPress={onExitReader}
            title={`Scroll Position (Paragraph ${readerParagraph + 1})`}
            textColor={theme.onSurface}
            mode="outlined"
          />
          <Button
            onPress={onCancel}
            title="Cancel"
            textColor={theme.onSurfaceVariant}
            mode="text"
          />
        </View>
      </Dialog>
    </Portal>
  );
};

export default TTSExitDialog;

const getStyles = (scaled: ReturnType<typeof useScaledDimensions>) =>
  StyleSheet.create({
    container: {
      borderRadius: scaled.borderRadius.lg + 12,
    },
    content: {
      marginBottom: scaled.margin.sm,
    },
    subtitle: {
      marginBottom: scaled.margin.md,
    },
    buttonCtn: {
      flexDirection: 'column',
      paddingHorizontal: scaled.padding.md,
      paddingBottom: scaled.padding.md,
      gap: 8,
    },
  });
