import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Dialog, Portal, Text, TouchableRipple } from 'react-native-paper';
import { ThemeColors } from '@theme/types';
import Button from '@components/Button/Button';
import { useBackHandler } from '@hooks/index';

interface TTSChapterSelectionDialogProps {
    visible: boolean;
    theme: ThemeColors;
    lastChapter: {
        name: string;
        paragraph: number;
    };
    currentChapter: {
        name: string;
        paragraph: number;
    };
    onSelectLastChapter: () => void;
    onSelectCurrentChapter: () => void;
    onDismiss: () => void;
}

const TTSChapterSelectionDialog: React.FC<TTSChapterSelectionDialogProps> = ({
    visible,
    theme,
    lastChapter,
    currentChapter,
    onSelectLastChapter,
    onSelectCurrentChapter,
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

    return (
        <Portal>
            <Dialog
                visible={visible}
                onDismiss={onDismiss}
                style={[styles.container, { backgroundColor: theme.overlay3 }]}
            >
                <Dialog.Title style={{ color: theme.onSurface }}>
                    Continue TTS Check
                </Dialog.Title>
                <Dialog.Content>
                    <Text style={[styles.message, { color: theme.onSurfaceVariant }]}>
                        You were listening to a different chapter. Where should we start?
                    </Text>

                    <View style={styles.optionsContainer}>
                        <TouchableRipple
                            onPress={onSelectLastChapter}
                            style={[styles.optionButton, { borderColor: theme.outline }]}
                            borderless
                            rippleColor={theme.rippleColor}
                        >
                            <View style={styles.optionContent}>
                                <Text style={[styles.optionTitle, { color: theme.primary }]}>
                                    {lastChapter.name} (Last TTS)
                                </Text>
                                <Text style={[styles.optionSubtitle, { color: theme.onSurfaceVariant }]}>
                                    Saved at Para {lastChapter.paragraph}
                                </Text>
                            </View>
                        </TouchableRipple>

                        <TouchableRipple
                            onPress={onSelectCurrentChapter}
                            style={[styles.optionButton, { borderColor: theme.outline }]}
                            borderless
                            rippleColor={theme.rippleColor}
                        >
                            <View style={styles.optionContent}>
                                <Text style={[styles.optionTitle, { color: theme.primary }]}>
                                    {currentChapter.name} (Current)
                                </Text>
                                <Text style={[styles.optionSubtitle, { color: theme.onSurfaceVariant }]}>
                                    Current Position
                                </Text>
                            </View>
                        </TouchableRipple>
                    </View>
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
    },
    message: {
        fontSize: 16,
        marginBottom: 16,
    },
    optionsContainer: {
        gap: 12,
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
});
