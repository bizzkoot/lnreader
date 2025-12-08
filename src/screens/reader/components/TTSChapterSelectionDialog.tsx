import React, { useMemo } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Dialog, Portal, Text, TouchableRipple } from 'react-native-paper';
import { ThemeColors } from '@theme/types';
import Button from '@components/Button/Button';
import { useBackHandler } from '@hooks/index';

interface TTSChapterSelectionDialogProps {
  visible: boolean;
  theme: ThemeColors;
  conflictingChapters: Array<{
    id: number;
    name: string;
    paragraph: number;
  }>;
  currentChapter: {
    id: number;
    name: string;
    paragraph: number;
  };
  onSelectChapter: (chapterId: number) => void;
  onDismiss: () => void;
}

const TTSChapterSelectionDialog: React.FC<TTSChapterSelectionDialogProps> = ({
  visible,
  theme,
  conflictingChapters,
  currentChapter,
  onSelectChapter,
  onDismiss,
}) => {
  // Handle Android back button
  useBackHandler(() => {
    if (visible) {
      onDismiss();
      return true;
    }
    return false;
  });

  const conflictsToShow = useMemo(() => {
    return conflictingChapters.slice(0, 3);
  }, [conflictingChapters]);

  const hasOverflow = conflictingChapters.length > 3;

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={[styles.container, { backgroundColor: theme.overlay3 }]}
      >
        <Dialog.Title style={{ color: theme.onSurface }}>
          Resume Reading?
        </Dialog.Title>
        <Dialog.Content>
          <Text style={[styles.message, { color: theme.onSurfaceVariant }]}>
            You have other active reading sessions. Choose where to continue
            TTS.
          </Text>

          {hasOverflow && (
            <Text style={[styles.warning, { color: theme.error }]}>
              Note: You have more than 3 active chapters. Please clean up your
              reading list.
            </Text>
          )}

          <ScrollView style={styles.scrollContainer}>
            <View style={styles.optionsContainer}>
              {/* Conflicts List */}
              {conflictsToShow.map(chapter => (
                <TouchableRipple
                  key={chapter.id}
                  onPress={() => onSelectChapter(chapter.id)}
                  style={[styles.optionButton, { borderColor: theme.outline }]}
                  borderless
                  rippleColor={theme.rippleColor}
                >
                  <View style={styles.optionContent}>
                    <Text
                      style={[styles.optionTitle, { color: theme.primary }]}
                    >
                      {chapter.name}
                    </Text>
                    <Text
                      style={[
                        styles.optionSubtitle,
                        { color: theme.onSurfaceVariant },
                      ]}
                    >
                      Resume from Para {chapter.paragraph}
                    </Text>
                  </View>
                </TouchableRipple>
              ))}

              {/* Current Chapter Option (Separated visually) */}
              <View
                style={[styles.divider, { backgroundColor: theme.outline }]}
              />

              <TouchableRipple
                onPress={() => onSelectChapter(currentChapter.id)}
                style={[
                  styles.optionButton,
                  { borderColor: theme.primary }, // Highlight current
                  { backgroundColor: theme.surfaceVariant },
                ]}
                borderless
                rippleColor={theme.rippleColor}
              >
                <View style={styles.optionContent}>
                  <Text style={[styles.optionTitle, { color: theme.primary }]}>
                    {currentChapter.name} (Start Here)
                  </Text>
                  <Text
                    style={[
                      styles.optionSubtitle,
                      { color: theme.onSurfaceVariant },
                    ]}
                  >
                    Current Position
                  </Text>
                </View>
              </TouchableRipple>
            </View>
          </ScrollView>
        </Dialog.Content>
        <Dialog.Actions>
          <Button
            title="Cancel"
            onPress={onDismiss}
            mode="text"
            textColor={theme.onSurfaceVariant}
          />
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

export default TTSChapterSelectionDialog;

const styles = StyleSheet.create({
  container: {
    borderRadius: 28,
    maxHeight: '80%', // Ensure it doesn't overflow screen
  },
  message: {
    fontSize: 16,
    marginBottom: 12,
  },
  warning: {
    fontSize: 14,
    marginBottom: 12,
    fontWeight: 'bold',
  },
  scrollContainer: {
    maxHeight: 400, // Limit internal scroll height
  },
  optionsContainer: {
    gap: 12,
    paddingBottom: 8,
  },
  optionButton: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  optionContent: {
    flexDirection: 'column',
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 14,
  },
  divider: {
    height: 1,
    width: '100%',
    marginVertical: 4,
  },
});
