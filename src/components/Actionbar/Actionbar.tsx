import { useTheme } from '@hooks/persisted';
import React from 'react';
import {
  Dimensions,
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { MaterialDesignIconName } from '@type/icon';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useScaledDimensions } from '@hooks/useScaledDimensions';

type Action = {
  icon: MaterialDesignIconName;
  onPress: () => void;
};

interface ActionbarProps {
  active: boolean;
  actions: Action[];
  viewStyle?: StyleProp<ViewStyle>;
}

const getStyles = (borderRadius: number) =>
  StyleSheet.create({
    actionbarContainer: {
      alignItems: 'center',
      borderTopLeftRadius: borderRadius,
      borderTopRightRadius: borderRadius,
      bottom: 0,
      elevation: 1,
      flexDirection: 'row',
      justifyContent: 'space-around',
      position: 'absolute',
      width: Dimensions.get('window').width,
    },
  });

export const Actionbar: React.FC<ActionbarProps> = ({
  active,
  actions,
  viewStyle,
}) => {
  const theme = useTheme();
  const { iconSize, borderRadius } = useScaledDimensions();

  const { bottom } = useSafeAreaInsets();

  if (!active) {
    return null;
  }
  const styles = getStyles(borderRadius.lg);

  return (
    <Animated.View
      entering={SlideInDown.duration(150)}
      exiting={SlideOutDown.duration(150)}
      style={[
        styles.actionbarContainer,
        {
          backgroundColor: theme.surface2,
          minHeight: iconSize.lg + bottom,
          paddingBottom: bottom,
        },
        viewStyle,
      ]}
    >
      {actions.map(({ icon, onPress }, id) => (
        <Pressable
          key={id}
          android_ripple={{
            radius: iconSize.lg,
            color: theme.rippleColor,
            borderless: true,
          }}
          onPress={onPress}
        >
          <MaterialCommunityIcons
            name={icon}
            color={theme.onSurface}
            size={iconSize.md}
          />
        </Pressable>
      ))}
    </Animated.View>
  );
};
