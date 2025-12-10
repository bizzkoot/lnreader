import React, { useMemo } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { ThemeColors } from '../../theme/types';
import Color from 'color';
import { MaterialDesignIconName } from '@type/icon';
import { useScaledDimensions } from '@hooks/useScaledDimensions';

// --- Dynamic style helpers ---

const getToggleButtonPressableStyle = (
  selected: boolean,
  theme: ThemeColors,
) => ({
  backgroundColor: selected
    ? Color(theme.primary).alpha(0.12).string()
    : 'transparent',
});

const getToggleColorButtonPressableStyle = (backgroundColor: string) => ({
  backgroundColor,
});

// --- Components ---

interface ToggleButtonProps {
  icon: MaterialDesignIconName;
  selected: boolean;
  theme: ThemeColors;
  color?: string;
  onPress: () => void;
}

export const ToggleButton: React.FC<ToggleButtonProps> = ({
  icon,
  selected,
  theme,
  color,
  onPress,
}) => {
  const { iconSize, padding, borderRadius, margin } = useScaledDimensions();

  const dynamicStyles = useMemo(
    () => ({
      toggleButtonContainer: {
        borderRadius: borderRadius.sm + 2,
        marginHorizontal: margin.sm - 2,
      },
      toggleButtonPressable: {
        padding: padding.sm,
      },
    }),
    [borderRadius.sm, margin.sm, padding.sm],
  );

  return (
    <View
      style={[
        styles.toggleButtonContainer,
        dynamicStyles.toggleButtonContainer,
      ]}
    >
      <Pressable
        android_ripple={{ color: theme.rippleColor }}
        style={[
          dynamicStyles.toggleButtonPressable,
          getToggleButtonPressableStyle(selected, theme),
        ]}
        onPress={onPress}
      >
        <MaterialCommunityIcons
          name={icon}
          color={selected ? theme.primary : color ? color : theme.onSurface}
          size={iconSize.md}
        />
      </Pressable>
    </View>
  );
};

interface ToggleColorButtonProps {
  selected: boolean;
  backgroundColor: string;
  textColor: string;
  onPress: () => void;
}

export const ToggleColorButton: React.FC<ToggleColorButtonProps> = ({
  selected,
  backgroundColor,
  textColor,
  onPress,
}) => {
  const { iconSize, padding, margin } = useScaledDimensions();

  const buttonSize = iconSize.md + padding.md;

  const dynamicStyles = useMemo(
    () => ({
      toggleColorButtonContainer: {
        borderRadius: buttonSize,
        marginHorizontal: margin.sm - 2,
        height: buttonSize,
        width: buttonSize,
      },
      toggleColorButtonPressable: {
        padding: padding.sm + 2,
      },
    }),
    [buttonSize, margin.sm, padding.sm],
  );

  return (
    <View
      style={[
        styles.toggleColorButtonContainer,
        dynamicStyles.toggleColorButtonContainer,
      ]}
    >
      <Pressable
        android_ripple={{ color: textColor }}
        style={[
          styles.toggleColorButtonPressable,
          dynamicStyles.toggleColorButtonPressable,
          getToggleColorButtonPressableStyle(backgroundColor),
        ]}
        onPress={onPress}
      >
        <MaterialCommunityIcons
          name={selected ? 'check' : 'format-color-text'}
          color={textColor}
          size={iconSize.md}
        />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  toggleButtonContainer: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleColorButtonContainer: {
    overflow: 'hidden',
  },
  toggleColorButtonPressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
