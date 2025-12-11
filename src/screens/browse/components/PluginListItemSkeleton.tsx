import React, { memo, useCallback, useMemo } from 'react';
import {
  Pressable,
  Image,
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Text as PaperText } from 'react-native-paper';

import { PluginItem } from '@plugins/types';
import { ThemeColors } from '@theme/types';
import { getString } from '@strings/translations';
import { IconButtonV2 } from '@components';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import { useScaledDimensions } from '@hooks/useScaledDimensions';

interface PluginListItemSkeletonProps {
  item: PluginItem;
  theme: ThemeColors;
}

export const PluginListItemSkeleton = memo(
  ({ item, theme }: PluginListItemSkeletonProps) => {
    const { uiScale = 1.0 } = useAppSettings();
    const { iconSize } = useScaledDimensions();

    const styles = useMemo(() => createStyles(uiScale), [uiScale]);

    const containerStyle = useMemo(
      () => [styles.container, { backgroundColor: theme.surface }],
      [theme.surface, styles],
    );
    const iconStyle = useMemo(
      () => [styles.icon, { backgroundColor: theme.surface }],
      [theme.surface, styles],
    );
    const nameStyle = useMemo(
      () => [{ color: theme.onSurface }, styles.name],
      [theme.onSurface, styles],
    );
    const additionStyle = useMemo(
      () => [{ color: theme.onSurfaceVariant }, styles.addition],
      [theme.onSurfaceVariant, styles],
    );

    const CogButton = useCallback(
      () => (
        <IconButtonV2
          name="cog-outline"
          size={iconSize.sm}
          color={theme.primary}
          theme={theme}
        />
      ),
      [theme, iconSize.sm],
    );

    const DownloadButton = useCallback(
      () => (
        <IconButtonV2
          name="download-outline"
          size={iconSize.sm}
          color={theme.primary}
          theme={theme}
        />
      ),
      [theme, iconSize.sm],
    );

    const LatestButton = useCallback(() => {
      const viewStyle: StyleProp<ViewStyle> = {
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 64,
        paddingBottom: 1,
      };
      const textStyle: StyleProp<TextStyle> = {
        color: theme.primary,
      };
      return (
        <View style={viewStyle}>
          <PaperText
            variant="labelLarge"
            style={[styles.buttonGroup, textStyle]}
          >
            {getString('browseScreen.latest')}
          </PaperText>
        </View>
      );
    }, [theme]);

    return (
      <Pressable
        style={containerStyle}
        android_ripple={{ color: theme.rippleColor }}
      >
        <View style={[styles.center, styles.row]}>
          <Image source={{ uri: item.iconUrl }} style={iconStyle} />
          <View style={styles.details}>
            <Text numberOfLines={1} style={nameStyle}>
              {item.name}
            </Text>
            <Text numberOfLines={1} style={additionStyle}>
              {`${item.lang} - ${item.version}`}
            </Text>
          </View>
        </View>
        <View style={styles.flex} />
        {item.hasSettings ? <CogButton /> : null}
        {item.hasUpdate || __DEV__ ? <DownloadButton /> : null}
        <LatestButton />
      </Pressable>
    );
  },
);

const createStyles = (uiScale: number) =>
  StyleSheet.create({
    addition: {
      fontSize: scaleDimension(12, uiScale),
      lineHeight: scaleDimension(20, uiScale),
    },
    buttonGroup: {
      alignItems: 'center',
      flexDirection: 'row',
    },
    center: { alignItems: 'center' },
    container: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    details: {
      marginLeft: 16,
    },
    flex: { flex: 1 },
    icon: {
      borderRadius: 4,
      height: scaleDimension(40, uiScale),
      width: scaleDimension(40, uiScale),
    },
    name: {
      fontWeight: '500',
      lineHeight: 20,
    },
    row: {
      flexDirection: 'row',
    },
  });
