import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Portal, Modal, Text, RadioButton } from 'react-native-paper';
import { ThemeColors } from '@theme/types';

interface TTSScrollBehaviorModalProps {
  visible: boolean;
  onDismiss: () => void;
  theme: ThemeColors;
  title: string;
  options: { label: string; value: string }[];
  currentValue: string;
  onSelect: (value: string) => void;
}

const TTSScrollBehaviorModal: React.FC<TTSScrollBehaviorModalProps> = ({
  visible,
  onDismiss,
  theme,
  title,
  options,
  currentValue,
  onSelect,
}) => {
  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.container,
          { backgroundColor: theme.overlay3 },
        ]}
      >
        <Text style={[styles.title, { color: theme.onSurface }]}>{title}</Text>
        <View style={styles.optionsContainer}>
          <RadioButton.Group
            onValueChange={value => {
              onSelect(value);
              onDismiss();
            }}
            value={currentValue}
          >
            {options.map(option => (
              <Pressable
                key={option.value}
                style={styles.optionRow}
                onPress={() => {
                  onSelect(option.value);
                  onDismiss();
                }}
              >
                <Text style={[styles.optionLabel, { color: theme.onSurface }]}>
                  {option.label}
                </Text>
                <RadioButton
                  value={option.value}
                  color={theme.primary}
                  uncheckedColor={theme.onSurfaceVariant}
                />
              </Pressable>
            ))}
          </RadioButton.Group>
        </View>
      </Modal>
    </Portal>
  );
};

export default TTSScrollBehaviorModal;

const styles = StyleSheet.create({
  container: {
    margin: 20,
    borderRadius: 28,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  optionsContainer: {
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  optionLabel: {
    fontSize: 16,
    flex: 1,
    marginRight: 16,
  },
});
