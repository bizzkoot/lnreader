import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import React, { useEffect } from 'react';
import Animated, {
  interpolateColor,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useDerivedValue,
} from 'react-native-reanimated';
import { useTheme } from '@hooks/persisted';
import { useScaledDimensions } from '@hooks/useScaledDimensions';

interface SwitchProps {
  value: boolean;
  onValueChange?: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

const Switch = ({ value, size, onValueChange, style }: SwitchProps) => {
  const theme = useTheme();
  const scaledDimensions = useScaledDimensions();

  // Use scaled icon size as default
  const switchSize = size ?? scaledDimensions.iconSize.md - 2;
  // Value for Switch Animation
  // const switchTranslate = useSharedValue(value ? switchSize : switchSize / 6);

  // Background color animation progress
  const progress = useSharedValue(value ? switchSize : 0);

  // Animate switch movement
  const customSpringStyles = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: withSpring(value ? switchSize : switchSize / 6, {
          mass: 1,
          damping: 15,
          stiffness: 120,
          overshootClamping: false,
        }),
      },
    ],
  }));

  // Precompute background color animation
  const backgroundColor = useDerivedValue(
    () =>
      interpolateColor(
        progress.value,
        [0, switchSize],
        [theme.outline, theme.primary],
      ),
    [value],
  );

  const backgroundColorStyle = useAnimatedStyle(() => ({
    backgroundColor: backgroundColor.value,
  }));

  useEffect(() => {
    progress.value = withTiming(value ? switchSize : 0);
  }, [progress, switchSize, value]);

  return (
    <Pressable onPress={onValueChange}>
      <Animated.View
        style={[
          styles.container,
          style,
          {
            width: switchSize * 2 + switchSize / 6,
            height: switchSize + switchSize / 3,
            borderRadius: switchSize,
          },
          backgroundColorStyle,
        ]}
      >
        <Animated.View
          style={[
            styles.circle,
            customSpringStyles,
            { height: switchSize, width: switchSize, borderRadius: switchSize },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
};

export default React.memo(Switch);

const styles = StyleSheet.create({
  circle: {
    backgroundColor: 'white',
    elevation: 4,
    shadowColor: 'black',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2.5,
  },
  container: {
    justifyContent: 'center',
  },
});
