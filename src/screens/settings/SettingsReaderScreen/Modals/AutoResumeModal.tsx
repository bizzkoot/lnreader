import React from 'react';
import { StyleSheet } from 'react-native';
import { Portal } from 'react-native-paper';
import { Modal } from '@components';
import { RadioButton } from '@components/RadioButton/RadioButton';
import { useTheme } from '@hooks/persisted';

interface AutoResumeModalProps {
    visible: boolean;
    onDismiss: () => void;
    currentValue: 'always' | 'prompt' | 'never';
    onSelect: (value: 'always' | 'prompt' | 'never') => void;
}

const AutoResumeModal: React.FC<AutoResumeModalProps> = ({
    visible,
    onDismiss,
    currentValue,
    onSelect,
}) => {
    const theme = useTheme();

    const options: { label: string; value: 'always' | 'prompt' | 'never' }[] = [
        { label: 'Always resume', value: 'always' },
        { label: 'Ask every time', value: 'prompt' },
        { label: 'Never resume', value: 'never' },
    ];

    return (
        <Portal>
            <Modal
                visible={visible}
                onDismiss={onDismiss}
                contentContainerStyle={styles.containerStyle}
            >
                {options.map(option => (
                    <RadioButton
                        key={option.value}
                        status={currentValue === option.value}
                        onPress={() => {
                            onSelect(option.value);
                            onDismiss();
                        }}
                        label={option.label}
                        theme={theme}
                    />
                ))}
            </Modal>
        </Portal>
    );
};

export default AutoResumeModal;

const styles = StyleSheet.create({
    containerStyle: {
        paddingBottom: 16,
    },
});
