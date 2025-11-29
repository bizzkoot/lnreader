import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { ThemeColors } from '@theme/types';

interface ToastProps {
  visible: boolean;
  message: string;
  theme: ThemeColors;
  duration?: number;
  onHide: () => void;
}

const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  theme,
  duration = 3000,
  onHide,
}) => {
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(duration),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onHide();
      });
    }
  }, [visible, fadeAnim, duration, onHide]);

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.toast,
          {
            backgroundColor: theme.surface,
            opacity: fadeAnim,
          },
        ]}
      >
        <Text style={[styles.text, { color: theme.onSurface }]}>{message}</Text>
      </Animated.View>
    </View>
  );
};

export default Toast;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  toast: {
    padding: 12,
    borderRadius: 8,
    shadowColor: 'transparent',
    elevation: 2,
  },
  text: {
    fontSize: 14,
    textAlign: 'center',
  },
});
