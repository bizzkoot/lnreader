import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Portal, Modal, RadioButton } from 'react-native-paper';
import AppText from '@components/AppText';
import { ThemeColors } from '@theme/types';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

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
  const { uiScale = 1.0 } = useAppSettings();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: {
          margin: 20,
          borderRadius: 28,
          padding: 24,
        },
        title: {
          fontSize: scaleDimension(20, uiScale),
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
          fontSize: scaleDimension(16, uiScale),
          flex: 1,
          marginRight: 16,
        },
      }),
    [uiScale],
  );

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
        <AppText style={[styles.title, { color: theme.onSurface }]}>
          {title}
        </AppText>
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
                <AppText
                  style={[styles.optionLabel, { color: theme.onSurface }]}
                >
                  {option.label}
                </AppText>
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
