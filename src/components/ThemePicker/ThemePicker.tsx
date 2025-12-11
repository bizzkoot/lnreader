import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from '@components/AppText';
import { overlay } from 'react-native-paper';
import color from 'color';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { ThemeColors } from '@theme/types';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

interface ThemePickerProps {
  theme: ThemeColors;
  currentTheme: ThemeColors;
  onPress: () => void;
  horizontal?: boolean;
}

export const ThemePicker = ({
  theme,
  currentTheme,
  onPress,
  horizontal = false,
}: ThemePickerProps) => {
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingBottom: scaleDimension(8, uiScale),
          width: '33%',
        },
        horizontalContainer: {
          width: undefined,
          marginHorizontal: scaleDimension(4, uiScale),
        },
        card: {
          borderWidth: scaleDimension(3.6, uiScale),
          width: scaleDimension(95, uiScale),
          height: scaleDimension(140, uiScale),
          borderRadius: scaleDimension(16, uiScale),
          overflow: 'hidden',
          // Shadow for iOS
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
          // Elevation for Android
          elevation: 2,
        },
        flex1: {
          flex: 1,
        },
        checkIcon: {
          position: 'absolute',
          top: scaleDimension(5, uiScale),
          right: scaleDimension(5, uiScale),
          borderRadius: 50,
          padding: scaleDimension(1.6, uiScale),
          zIndex: 1,
        },
        topBar: {
          height: scaleDimension(20, uiScale),
          justifyContent: 'center',
          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
        },
        topBarAccent: {
          width: scaleDimension(44, uiScale),
          height: scaleDimension(10, uiScale),
          marginLeft: scaleDimension(8, uiScale),
          borderRadius: 50,
        },
        content: {
          padding: scaleDimension(8, uiScale),
        },
        titleBar: {
          height: scaleDimension(18, uiScale),
          borderRadius: scaleDimension(4, uiScale),
        },
        row: {
          paddingVertical: scaleDimension(4, uiScale),
          flexDirection: 'row',
        },
        rowAccent: {
          height: scaleDimension(10, uiScale),
          width: scaleDimension(44, uiScale),
          borderRadius: 50,
        },
        rowAccentSmall: {
          height: scaleDimension(10, uiScale),
          width: scaleDimension(16, uiScale),
          marginLeft: scaleDimension(4, uiScale),
          borderRadius: 50,
        },
        rowAccentShort: {
          height: scaleDimension(10, uiScale),
          width: scaleDimension(24, uiScale),
          borderRadius: 50,
        },
        bottomBar: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: scaleDimension(24, uiScale),
          justifyContent: 'center',
        },
        bottomBarContent: {
          flex: 1,
          justifyContent: 'space-between',
          alignItems: 'center',
          flexDirection: 'row',
          paddingHorizontal: scaleDimension(16, uiScale),
        },
        dot: {
          height: scaleDimension(12, uiScale),
          width: scaleDimension(12, uiScale),
          borderRadius: 50,
        },
        opacityDot: {
          opacity: 0.54,
        },
        themeName: {
          fontSize: scaleDimension(12, uiScale),
          paddingVertical: scaleDimension(4, uiScale),
        },
        marginLeft: { marginLeft: scaleDimension(4, uiScale) },
      }),
    [uiScale],
  );

  const iconSize = useMemo(() => scaleDimension(15, uiScale), [uiScale]);

  return (
    <View style={[styles.container, horizontal && styles.horizontalContainer]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.background,
            borderColor:
              currentTheme.id === theme.id
                ? theme.primary
                : currentTheme.background,
          },
        ]}
      >
        <Pressable style={styles.flex1} onPress={onPress}>
          {currentTheme.id === theme.id ? (
            <MaterialCommunityIcons
              name="check"
              color={theme.onPrimary}
              size={iconSize}
              style={[styles.checkIcon, { backgroundColor: theme.primary }]}
            />
          ) : null}
          <View
            style={[
              styles.topBar,
              {
                backgroundColor: overlay(2, theme.surface),
              },
            ]}
          >
            <View
              style={[
                styles.topBarAccent,
                { backgroundColor: theme.onSurface },
              ]}
            />
          </View>
          <View style={styles.content}>
            <View
              style={[
                styles.titleBar,
                { backgroundColor: theme.onSurfaceVariant },
              ]}
            />
            <View style={styles.row}>
              <View
                style={[styles.rowAccent, { backgroundColor: theme.onSurface }]}
              />
              <View
                style={[
                  styles.rowAccentSmall,
                  { backgroundColor: theme.primary },
                ]}
              />
            </View>
            <View style={styles.row}>
              <View
                style={[
                  styles.rowAccentShort,
                  { backgroundColor: theme.onSurfaceVariant },
                ]}
              />
              <View
                style={[
                  styles.rowAccentShort,
                  styles.marginLeft,
                  { backgroundColor: theme.onSurfaceVariant },
                ]}
              />
            </View>
          </View>
          <View
            style={[
              styles.bottomBar,
              {
                backgroundColor: color(theme.primary).alpha(0.08).string(),
              },
            ]}
          >
            <View style={styles.bottomBarContent}>
              <View
                style={[
                  styles.dot,
                  styles.opacityDot,
                  { backgroundColor: theme.onSurface },
                ]}
              />
              <View style={[styles.dot, { backgroundColor: theme.primary }]} />
              <View
                style={[
                  styles.dot,
                  styles.opacityDot,
                  { backgroundColor: theme.onSurface },
                ]}
              />
            </View>
          </View>
        </Pressable>
      </View>
      <Text style={[styles.themeName, { color: currentTheme.onSurface }]}>
        {theme.name}
      </Text>
    </View>
  );
};
