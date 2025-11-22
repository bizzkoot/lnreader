import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';
import { ThemeColors } from '@theme/types';
import Button from '@components/Button/Button';

interface TTSResumeDialogProps {
    visible: boolean;
    theme: ThemeColors;
    onResume: () => void;
    onRestart: () => void;
    onDismiss: () => void;
}

const TTSResumeDialog: React.FC<TTSResumeDialogProps> = ({
    visible,
    theme,
    onResume,
    onRestart,
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
                    Resume TTS
                </Dialog.Title>
                <Dialog.Content>
                    <Text style={[styles.content, { color: theme.onSurface }]}>
                        Do you want to resume reading from where you left off?
                    </Text>
                </Dialog.Content>
                <View style={styles.buttonCtn}>
                    <Button
                        onPress={() => {
                            onResume();
                            onDismiss();
                        }}
                        title="Resume"
                    />
                    <Button
                        onPress={() => {
                            onRestart();
                            onDismiss();
                        }}
                        title="Restart"
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
    },
    buttonCtn: {
        flexDirection: 'row-reverse',
        padding: 16,
        gap: 8,
    },
});
