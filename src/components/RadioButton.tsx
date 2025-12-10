import { ThemeColors } from '@theme/types';
import React, { useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { RadioButton as MaterialRadioButton } from 'react-native-paper';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

interface RadioButtonGroupProps {
  children?: React.ReactNode;
  value: string | number;
  onValueChange: (value: string) => void;
}

interface RadioButtonProps {
  value: string | number;
  label: string;
  theme: ThemeColors;
  labelStyle?: StyleSheet.AbsoluteFillStyle;
}

export const RadioButtonGroup = ({
  children,
  value,
  onValueChange,
}: RadioButtonGroupProps) => (
  <MaterialRadioButton.Group
    onValueChange={onValueChange}
    value={String(value)}
  >
    {children}
  </MaterialRadioButton.Group>
);

export const RadioButton = ({
  value,
  label,
  theme,
  labelStyle,
}: RadioButtonProps) => {
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        radioButtonContainer: {
          alignItems: 'center',
          flexDirection: 'row',
          paddingVertical: scaleDimension(8, uiScale),
        },
        radioButtonLabel: {
          fontSize: scaleDimension(16, uiScale),
          marginLeft: scaleDimension(16, uiScale),
        },
      }),
    [uiScale],
  );

  return (
    <View style={styles.radioButtonContainer}>
      <MaterialRadioButton
        value={String(value)}
        color={theme.primary}
        uncheckedColor={theme.onSurfaceVariant}
      />
      <Text
        style={[
          styles.radioButtonLabel,
          { color: theme.onSurface },
          labelStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};
