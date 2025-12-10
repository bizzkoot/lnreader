import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  Text,
  ViewStyle,
  StyleProp,
} from 'react-native';
import Switch from './Switch';
import { ThemeColors } from '../../theme/types';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

interface SwitchItemProps {
  value: boolean;
  label: string;
  description?: string;
  onPress: () => void;
  theme: ThemeColors;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

const SwitchItem: React.FC<SwitchItemProps> = ({
  label,
  description,
  onPress,
  theme,
  value,
  size,
  style,
}) => {
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingVertical: scaleDimension(12, uiScale),
        },
        description: {
          fontSize: scaleDimension(12, uiScale),
          lineHeight: 20,
        },
        label: {
          fontSize: scaleDimension(16, uiScale),
        },
        labelContainer: {
          flex: 1,
          justifyContent: 'center',
        },
        switch: {
          marginLeft: scaleDimension(8, uiScale),
        },
      }),
    [uiScale],
  );

  return (
    <Pressable
      android_ripple={{ color: theme.rippleColor }}
      style={[styles.container, style]}
      onPress={onPress}
    >
      <View style={styles.labelContainer}>
        <Text style={[{ color: theme.onSurface }, styles.label]}>{label}</Text>
        {description ? (
          <Text style={[styles.description, { color: theme.onSurfaceVariant }]}>
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onPress}
        style={styles.switch}
        size={size}
      />
    </Pressable>
  );
};

export default SwitchItem;
