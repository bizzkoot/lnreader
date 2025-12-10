/* eslint-disable react-native/no-inline-styles */
import React, { useCallback, useMemo } from 'react';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { ThemeColors } from '@theme/types';
import Animated from 'react-native-reanimated';
import { useScaledDimensions } from '@hooks/useScaledDimensions';
import { useAppSettings } from '@hooks/persisted';

interface CustomBottomTabBarProps extends BottomTabBarProps {
  theme: ThemeColors;
  showLabelsInNav: boolean;
  renderIcon: ({
    color,
    route,
  }: {
    route: { name: string };
    color: string;
  }) => React.ReactNode;
}

function CustomBottomTabBar({
  navigation,
  state,
  descriptors,
  insets,
  theme,
  showLabelsInNav,
  renderIcon,
}: CustomBottomTabBarProps) {
  const scaledDimensions = useScaledDimensions();
  const { padding, margin, iconSize, borderRadius } = scaledDimensions;
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () => getStyles(padding, margin, iconSize, borderRadius, uiScale),
    [padding, margin, iconSize, borderRadius, uiScale],
  );
  const getLabelText = useCallback(
    (route: any) => {
      if (!showLabelsInNav && route.name !== state.routeNames[state.index]) {
        return '';
      }

      const { options } = descriptors[route.key];
      const label =
        typeof options.tabBarLabel === 'string'
          ? options.tabBarLabel
          : typeof options.title === 'string'
            ? options.title
            : route.name;

      return label;
    },
    [descriptors, showLabelsInNav, state.index, state.routeNames],
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surface2 || theme.surface,
          paddingBottom: insets?.bottom || 0,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const label = getLabelText(route);
        const isFocused = state.index === index;
        const showLabel = (showLabelsInNav || isFocused) && label;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        const iconColor = isFocused
          ? theme.onPrimaryContainer
          : theme.onSurfaceVariant;

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.pressable}
          >
            {/* Icon */}
            <Animated.View
              style={[
                styles.iconContainer,
                {
                  transitionProperty: ['width', 'backgroundColor'],
                  transitionDuration: 250,
                  transitionTimingFunction: 'ease-in-out',
                  marginBottom: showLabel ? margin.xs : margin.lg - 4,
                  width: isFocused ? iconSize.lg + 20 : iconSize.lg,
                  backgroundColor: isFocused
                    ? theme.primaryContainer
                    : 'transparent',
                },
              ]}
            >
              {renderIcon({ color: iconColor, route })}
            </Animated.View>

            {/* Label */}
            {showLabel ? (
              <Text
                style={[
                  styles.label,
                  {
                    color: theme.onSurfaceVariant,
                    fontWeight: '700',
                  },
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export default CustomBottomTabBar;
export type { CustomBottomTabBarProps };

const getStyles = (
  padding: ReturnType<typeof useScaledDimensions>['padding'],
  margin: ReturnType<typeof useScaledDimensions>['margin'],
  iconSize: ReturnType<typeof useScaledDimensions>['iconSize'],
  borderRadius: ReturnType<typeof useScaledDimensions>['borderRadius'],
  uiScale: number,
) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      paddingVertical: padding.xs,
      paddingHorizontal: 0,
      minHeight: iconSize.xl + iconSize.lg,
    },
    pressable: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: padding.xs + 2,
      paddingHorizontal: padding.xs,
      position: 'relative',
    },
    iconContainer: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: padding.xs / 2,
      borderRadius: borderRadius.lg + 8,
    },
    label: {
      fontSize: Math.round(12 * uiScale),
      lineHeight: Math.round(16 * uiScale),
      textAlign: 'center',
    },
  });
