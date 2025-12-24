import { useTheme, useAppSettings } from '@hooks/persisted';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  Dimensions,
  ViewStyle,
} from 'react-native';
import { Portal } from 'react-native-paper';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeOut,
  FadeOutUp,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { scaleDimension } from '@theme/scaling';
import AppText from '@components/AppText';

const { width: screenWidth } = Dimensions.get('window');

interface MenuProps {
  visible: boolean;
  onDismiss: () => void;
  anchor: React.ReactNode;
  contentStyle?: ViewStyle;
  children: React.ReactNode;
}

interface MenuItemProps {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
  titleStyle?: ViewStyle;
}

const Menu: React.FC<MenuProps> & { Item: React.FC<MenuItemProps> } = ({
  visible,
  onDismiss,
  anchor,
  contentStyle,
  children,
}) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();
  const anchorRef = useRef<View>(null);
  const [anchorLayout, setAnchorLayout] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [isMeasured, setIsMeasured] = useState(false);

  const backdropStyle = {
    backgroundColor: theme.isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.1)',
  };

  const scaledValues = useMemo(
    () => ({
      menuOffset: scaleDimension(8, uiScale),
      menuPadding: scaleDimension(16, uiScale),
      menuMinWidth: scaleDimension(200, uiScale),
      menuMaxPadding: scaleDimension(32, uiScale),
      menuMaxWidth: scaleDimension(220, uiScale),
    }),
    [uiScale],
  );

  const menuAnimatedStyle = useAnimatedStyle(() => ({
    shadowColor: theme.isDark ? '#000' : theme.shadow,
    position: 'absolute' as const,
    left: Math.max(
      scaledValues.menuPadding,
      Math.min(anchorLayout.x, screenWidth - scaledValues.menuMaxWidth),
    ),
    top: anchorLayout.y + anchorLayout.height + scaledValues.menuOffset,
    width: Math.min(
      scaledValues.menuMinWidth,
      screenWidth - scaledValues.menuMaxPadding,
    ),
    zIndex: 1001,
  }));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        menuContainer: {
          borderRadius: scaleDimension(8, uiScale),
          elevation: 8,
          shadowOffset: {
            width: 0,
            height: 2,
          },
          shadowOpacity: 0.25,
          shadowRadius: 6,
          overflow: 'hidden',
        },
        backdrop: {
          position: 'absolute' as const,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        },
      }),
    [uiScale],
  );

  // Create entering animations
  const backdropEntering = FadeIn.duration(150);
  const menuEntering = FadeInUp.duration(150)
    .springify()
    .damping(30)
    .stiffness(500)
    .mass(0.3)
    .withInitialValues({
      transform: [{ translateY: -10 }],
    });

  // Create exiting animations
  const backdropExiting = FadeOut.duration(150);
  const menuExiting = FadeOutUp.duration(150)
    .springify()
    .damping(30)
    .stiffness(500)
    .mass(0.3);

  const measureAnchor = React.useCallback(() => {
    if (anchorRef.current) {
      anchorRef.current.measure((x, y, width, height, pageX, pageY) => {
        setAnchorLayout({ x: pageX, y: pageY, width, height });
        setIsMeasured(true);
      });
    }
  }, []);

  // Measure anchor on mount
  useEffect(() => {
    setTimeout(measureAnchor, 0);
  }, [measureAnchor]);

  if (!visible) {
    return (
      <View ref={anchorRef} collapsable={false} onLayout={measureAnchor}>
        {anchor}
      </View>
    );
  }

  return (
    <>
      <View ref={anchorRef} collapsable={false} onLayout={measureAnchor}>
        {anchor}
      </View>

      {visible && isMeasured && (
        <Portal>
          {/* Backdrop */}
          <Pressable style={StyleSheet.absoluteFillObject} onPress={onDismiss}>
            <Animated.View
              style={[styles.backdrop, backdropStyle]}
              entering={backdropEntering}
              exiting={backdropExiting}
            />
          </Pressable>

          {/* Menu */}
          <Animated.View
            style={[
              styles.menuContainer,
              menuAnimatedStyle,
              { backgroundColor: theme.surface },
              contentStyle,
            ]}
            entering={menuEntering}
            exiting={menuExiting}
          >
            {children}
          </Animated.View>
        </Portal>
      )}
    </>
  );
};

const MenuItem: React.FC<MenuItemProps> = ({
  title,
  onPress,
  style,
  titleStyle,
}) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        menuItem: {
          paddingHorizontal: scaleDimension(16, uiScale),
          paddingVertical: scaleDimension(12, uiScale),
          minHeight: scaleDimension(48, uiScale),
          justifyContent: 'center',
        },
        menuItemText: {
          fontSize: scaleDimension(16, uiScale),
          fontWeight: '400',
        },
      }),
    [uiScale],
  );

  return (
    <Pressable
      style={[styles.menuItem, style]}
      onPress={onPress}
      android_ripple={{ color: theme.rippleColor, foreground: true }}
    >
      <AppText
        style={[
          styles.menuItemText,
          {
            color: theme.onSurface,
          },
          titleStyle,
        ]}
      >
        {title}
      </AppText>
    </Pressable>
  );
};

Menu.Item = MenuItem;

export default Menu;
