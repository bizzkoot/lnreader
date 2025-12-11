import { ThemeColors } from '@theme/types';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@components/AppText';
import { IconButton } from 'react-native-paper';
import { useScaledDimensions } from '@hooks/useScaledDimensions';
import { useAppSettings } from '@hooks/persisted/useSettings';
import { scaleDimension } from '@theme/scaling';

interface ErrorAction {
  name: string;
  icon: string;
  onPress: () => void;
}

interface ErrorViewProps {
  errorName: string;
  actions: ErrorAction[];
  theme: ThemeColors;
}

// Dynamic style helpers
const getOutlineColor = (theme: ThemeColors) => ({ color: theme.outline });
const getRipple = (theme: ThemeColors) => ({
  color: theme.rippleColor,
  borderless: false,
});
const getActionTextColor = (theme: ThemeColors) => ({ color: theme.outline });

export const ErrorView = ({ errorName, actions, theme }: ErrorViewProps) => {
  const { iconSize } = useScaledDimensions();
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        emptyViewContainer: {
          alignItems: 'center',
          flex: 1,
          justifyContent: 'center',
        },
        emptyViewIcon: {
          fontSize: scaleDimension(45, uiScale),
        },
        emptyViewText: {
          fontWeight: 'bold',
          marginTop: scaleDimension(10, uiScale),
          paddingHorizontal: scaleDimension(30, uiScale),
          textAlign: 'center',
        },
        actionsRow: {
          flexDirection: 'row',
        },
        actionContainer: {
          borderRadius: scaleDimension(4, uiScale),
          overflow: 'hidden',
          margin: scaleDimension(16, uiScale),
        },
        actionPressable: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingBottom: scaleDimension(8, uiScale),
          paddingHorizontal: scaleDimension(20, uiScale),
          minWidth: scaleDimension(100, uiScale),
        },
        iconButton: {
          margin: 0,
        },
        actionText: {
          fontSize: scaleDimension(12, uiScale),
        },
      }),
    [uiScale],
  );

  return (
    <View style={styles.emptyViewContainer}>
      <Text style={[styles.emptyViewIcon, getOutlineColor(theme)]}>
        {/* {icons[Math.floor(Math.random() * 5)]} */}
        ಥ_ಥ
      </Text>
      <Text style={[styles.emptyViewText, getOutlineColor(theme)]}>
        {errorName}
      </Text>
      <View style={styles.actionsRow}>
        {actions.map(action => (
          <View key={action.name} style={styles.actionContainer}>
            <Pressable
              android_ripple={getRipple(theme)}
              onPress={action.onPress}
              style={styles.actionPressable}
            >
              <IconButton
                icon={action.icon}
                size={iconSize.md}
                style={styles.iconButton}
              />
              <Text style={[styles.actionText, getActionTextColor(theme)]}>
                {action.name}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
};
