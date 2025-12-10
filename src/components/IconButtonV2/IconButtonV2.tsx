import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import Color from 'color';

import { ThemeColors } from '../../theme/types';
import { MaterialDesignIconName } from '@type/icon';
import { useScaledDimensions } from '@hooks/useScaledDimensions';

type Props = {
  name: MaterialDesignIconName;
  color?: string;
  size?: number;
  disabled?: boolean;
  padding?: number;
  onPress?: () => void;
  theme: ThemeColors;
  style?: ViewStyle;
};

const IconButton: React.FC<Props> = ({
  name,
  color,
  size,
  padding,
  onPress,
  disabled,
  theme,
  style,
}) => {
  const scaledDimensions = useScaledDimensions();

  const iconSize = size ?? scaledDimensions.iconSize.md;
  const iconPadding = padding ?? scaledDimensions.padding.sm;

  const dynamicStyles = useMemo(
    () => ({
      container: {
        borderRadius: scaledDimensions.borderRadius.xl * 3, // 50 equivalent at scale 1.0
      },
      pressable: {
        padding: iconPadding,
      },
    }),
    [scaledDimensions.borderRadius.xl, iconPadding],
  );

  return (
    <View style={[styles.container, dynamicStyles.container, style]}>
      <Pressable
        style={dynamicStyles.pressable}
        onPress={onPress}
        disabled={disabled}
        android_ripple={
          onPress
            ? { color: Color(theme.primary).alpha(0.12).string() }
            : undefined
        }
      >
        <MaterialCommunityIcons
          name={name}
          size={iconSize}
          color={disabled ? theme.outline : color || theme.onSurface}
        />
      </Pressable>
    </View>
  );
};

export default React.memo(IconButton);

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
