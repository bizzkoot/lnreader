import React, { useMemo } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { Checkbox as PaperCheckbox } from 'react-native-paper';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';

import { ThemeColors } from '../../theme/types';
import { useScaledDimensions } from '@hooks/useScaledDimensions';

interface CheckboxProps {
  label: string;
  status: boolean | 'indeterminate';
  onPress?: () => void;
  disabled?: boolean;
  theme: ThemeColors;
  viewStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  status,
  theme,
  disabled,
  onPress,
  viewStyle,
  labelStyle,
}) => {
  const { padding, margin } = useScaledDimensions();

  const dynamicStyles = useMemo(
    () => ({
      pressable: {
        paddingHorizontal: padding.md,
        paddingVertical: padding.sm - 2,
      },
      defaultLabel: {
        marginLeft: margin.md - 4,
      },
    }),
    [padding.md, padding.sm, margin.md],
  );

  return (
    <Pressable
      android_ripple={{ color: theme.rippleColor }}
      style={[styles.pressable, dynamicStyles.pressable, viewStyle]}
      onPress={onPress}
      disabled={disabled}
    >
      <PaperCheckbox
        status={
          status === 'indeterminate'
            ? 'indeterminate'
            : status
              ? 'checked'
              : 'unchecked'
        }
        onPress={onPress}
        color={theme.primary}
        theme={{
          colors: { disabled: theme.onSurfaceVariant },
        }}
        uncheckedColor={theme.onSurfaceVariant}
        disabled={disabled}
      />
      <Text
        style={[
          dynamicStyles.defaultLabel,
          { color: theme.onSurface },
          labelStyle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

interface SortItemProps {
  label: string;
  status?: string;
  onPress: () => void;
  theme: ThemeColors;
}
export const SortItem = ({ label, status, onPress, theme }: SortItemProps) => {
  const { iconSize, padding } = useScaledDimensions();

  const dynamicStyles = useMemo(
    () => ({
      pressable: {
        paddingHorizontal: padding.md,
        paddingVertical: padding.sm - 2,
      },
      sortItem: {
        paddingVertical: padding.md,
        paddingLeft: padding.md * 4,
      },
      icon: {
        left: padding.md + padding.sm,
      },
    }),
    [padding.md, padding.sm],
  );

  return (
    <Pressable
      android_ripple={{ color: theme.rippleColor }}
      style={[
        styles.pressable,
        dynamicStyles.pressable,
        styles.sortItem,
        dynamicStyles.sortItem,
      ]}
      onPress={onPress}
    >
      {status ? (
        <MaterialCommunityIcons
          name={status === 'asc' ? 'arrow-up' : 'arrow-down'}
          color={theme.primary}
          size={iconSize.md - 3}
          style={[styles.icon, dynamicStyles.icon]}
        />
      ) : null}
      <Text style={{ color: theme.onSurface }}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  icon: {
    alignSelf: 'center',
    position: 'absolute',
  },
  pressable: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  sortItem: {},
});
