import React, { useEffect, useState, useMemo } from 'react';
import { StyleSheet, View, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { ThemeColors } from '@theme/types';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

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
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          position: 'absolute',
          bottom: scaleDimension(100, uiScale),
          left: scaleDimension(20, uiScale),
          right: scaleDimension(20, uiScale),
          zIndex: 1000,
        },
        toast: {
          padding: scaleDimension(12, uiScale),
          borderRadius: scaleDimension(8, uiScale),
          shadowColor: 'transparent',
          elevation: 2,
        },
        text: {
          fontSize: scaleDimension(14, uiScale),
          textAlign: 'center',
        },
      }),
    [uiScale],
  );

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
