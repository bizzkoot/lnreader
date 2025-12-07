import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';
import { ThemeColors } from '@theme/types';
import Button from '@components/Button/Button';
import { useBackHandler } from '@hooks/index';

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
    // Handle Android back button press -> Cancel
    useBackHandler(() => {
        if (visible) {
            onCancel();
            return true; // Consume event
        }
        return false;
    });

    return (
        <Portal>
            <Dialog
                visible={visible}
                onDismiss={onCancel}
                style={[styles.container, { backgroundColor: theme.overlay3 }]}
            >
                <Dialog.Title style={{ color: theme.onSurface }}>
                    TTS is Playing
                </Dialog.Title>
                <Dialog.Content>
                    <Text style={[styles.content, { color: theme.onSurface }]}>
                        You are exiting while Text-to-Speech is active. Which progress would you like to save?
                    </Text>
                </Dialog.Content>
                <View style={styles.buttonCtn}>
                    <Button
                        onPress={onExitTTS}
                        title={`Save TTS Position (Para ${ttsParagraph})`}
                    />
                    <Button
                        onPress={onExitReader}
                        title={`Save Reader Position (Para ${readerParagraph})`}
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

const styles = StyleSheet.create({
    container: {
        borderRadius: 28,
    },
    content: {
        fontSize: 16,
        marginBottom: 16,
    },
    buttonCtn: {
        flexDirection: 'column',
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 8,
    },
});
