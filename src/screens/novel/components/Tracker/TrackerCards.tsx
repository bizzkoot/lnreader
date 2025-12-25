import React, { useCallback, useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { IconButton } from 'react-native-paper';

import { useAppSettings, useTheme } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import { getAniListScoreFormatting } from './constants';
import { AddTrackingCardProps, TrackedItemCardProps } from './types';
import { useScaledDimensions } from '@hooks/useScaledDimensions';
import AppText from '@components/AppText';

export const AddTrackingCard: React.FC<AddTrackingCardProps> = ({
  onPress,
  icon,
}) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();
  const borderColor = 'rgba(0, 0, 0, 0.12)';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        addCardContainer: {
          alignItems: 'center',
          flexDirection: 'row',
          margin: scaleDimension(16, uiScale),
        },
        trackerIcon: {
          height: scaleDimension(50, uiScale),
          width: scaleDimension(50, uiScale),
        },
        addCardPressableContainer: {
          borderRadius: scaleDimension(4, uiScale),
          flex: 1,
          flexDirection: 'row',
          marginHorizontal: scaleDimension(16, uiScale),
          overflow: 'hidden',
        },
        rippleContainer: {
          alignItems: 'center',
          flex: 1,
          paddingVertical: scaleDimension(8, uiScale),
        },
        addTrackingText: {
          fontSize: scaleDimension(16, uiScale),
          textAlignVertical: 'center',
        },
        cardContainer: {
          borderRadius: scaleDimension(8, uiScale),
          margin: scaleDimension(8, uiScale),
        },
        cardSurface: {
          borderRadius: scaleDimension(8, uiScale),
          margin: scaleDimension(8, uiScale),
        },
        dividerBorderBottom: {
          borderBottomColor: 'rgba(0, 0, 0, 0.12)',
        },
        dividerBorderRight: {
          borderRightColor: 'rgba(0, 0, 0, 0.12)',
        },
        dividerBorderLeft: {
          borderLeftColor: 'rgba(0, 0, 0, 0.12)',
        },
        flex1: {
          flex: 1,
        },
        listItem: {
          flex: 1,
          textAlign: 'center',
          textAlignVertical: 'center',
        },
        listItemContainer: {
          alignItems: 'center',
          borderTopRightRadius: scaleDimension(4, uiScale),
          flex: 1,
          flexDirection: 'row',
        },
        listItemLeft: {
          borderBottomLeftRadius: scaleDimension(4, uiScale),
          borderRightWidth: 1,
          flex: 1,
        },
        listItemRight: {
          borderBottomRightRadius: scaleDimension(4, uiScale),
          borderLeftWidth: 1,
          flex: 1,
        },
        titleContainer: {
          alignItems: 'center',
          borderBottomWidth: 1,
          flexDirection: 'row',
          padding: scaleDimension(4, uiScale),
        },
        trackedItemRow: {
          flexDirection: 'row',
          height: scaleDimension(50, uiScale),
        },
        trackerIconSmall: {
          borderRadius: scaleDimension(8, uiScale),
          height: scaleDimension(40, uiScale),
          width: scaleDimension(40, uiScale),
        },
        trackedItemCard: {
          margin: scaleDimension(16, uiScale),
          marginHorizontal: scaleDimension(16, uiScale),
        },
        trackerInfo: {
          flex: 1,
        },
        trackerHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: scaleDimension(8, uiScale),
        },
        trackerDetails: {
          gap: scaleDimension(8, uiScale),
        },
        trackerDetailItem: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingVertical: scaleDimension(8, uiScale),
          borderBottomWidth: 1,
          borderBottomColor: borderColor,
        },
        detailLabel: {
          fontSize: scaleDimension(14, uiScale),
        },
        detailValue: {
          fontSize: scaleDimension(14, uiScale),
        },
        trackerActions: {
          flexDirection: 'row',
          borderLeftWidth: 1,
          borderLeftColor: borderColor,
        },
        actionButton: {
          padding: scaleDimension(4, uiScale),
        },
      }),
    [uiScale],
  );

  return (
    <View style={styles.addCardContainer}>
      <Image source={icon} style={styles.trackerIcon} />
      <View style={styles.addCardPressableContainer}>
        <Pressable
          style={styles.rippleContainer}
          android_ripple={{
            color: theme.rippleColor,
            borderless: true,
          }}
          onPress={onPress}
        >
          <AppText style={[{ color: theme.primary }, styles.addTrackingText]}>
            Add Tracking
          </AppText>
        </Pressable>
      </View>
    </View>
  );
};

export const TrackedItemCard: React.FC<TrackedItemCardProps> = ({
  tracker,
  onUntrack,
  trackItem,
  onSetStatus,
  onSetChapters,
  onSetScore,
  getStatus,
  icon,
}) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();
  const { iconSize } = useScaledDimensions();
  const borderColor = 'rgba(0, 0, 0, 0.12)';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        trackedItemCard: {
          margin: scaleDimension(16, uiScale),
          marginHorizontal: scaleDimension(16, uiScale),
        },
        trackerInfo: {
          flex: 1,
        },
        trackerHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: scaleDimension(8, uiScale),
        },
        trackerIcon: {
          height: scaleDimension(40, uiScale),
          width: scaleDimension(40, uiScale),
        },
        trackerName: {
          fontSize: scaleDimension(16, uiScale),
          marginLeft: scaleDimension(8, uiScale),
        },
        trackerDetails: {
          gap: scaleDimension(8, uiScale),
        },
        trackerDetailItem: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingVertical: scaleDimension(8, uiScale),
          borderBottomWidth: 1,
          borderBottomColor: borderColor,
        },
        detailLabel: {
          fontSize: scaleDimension(14, uiScale),
        },
        detailValue: {
          fontSize: scaleDimension(14, uiScale),
        },
        trackerActions: {
          flexDirection: 'row',
          borderLeftWidth: 1,
          borderLeftColor: borderColor,
        },
        actionButton: {
          padding: scaleDimension(4, uiScale),
        },
        cardContainer: {
          borderRadius: scaleDimension(8, uiScale),
          margin: scaleDimension(8, uiScale),
        },
        cardSurface: {
          borderRadius: scaleDimension(8, uiScale),
          margin: scaleDimension(8, uiScale),
        },
        dividerBorderBottom: {
          borderBottomColor: borderColor,
        },
        dividerBorderRight: {
          borderRightColor: borderColor,
        },
        dividerBorderLeft: {
          borderLeftColor: borderColor,
        },
        flex1: {
          flex: 1,
        },
        listItem: {
          flex: 1,
          textAlign: 'center',
          textAlignVertical: 'center',
        },
        listItemContainer: {
          alignItems: 'center',
          borderTopRightRadius: scaleDimension(4, uiScale),
          flex: 1,
          flexDirection: 'row',
        },
        listItemLeft: {
          borderBottomLeftRadius: scaleDimension(4, uiScale),
          borderRightWidth: 1,
          flex: 1,
        },
        listItemRight: {
          borderBottomRightRadius: scaleDimension(4, uiScale),
          borderLeftWidth: 1,
          flex: 1,
        },
        titleContainer: {
          alignItems: 'center',
          borderBottomWidth: 1,
          flexDirection: 'row',
          padding: scaleDimension(4, uiScale),
        },
        trackedItemRow: {
          flexDirection: 'row',
          height: scaleDimension(50, uiScale),
        },
        trackerIconSmall: {
          borderRadius: scaleDimension(8, uiScale),
          height: scaleDimension(40, uiScale),
          width: scaleDimension(40, uiScale),
        },
      }),
    [uiScale],
  );

  const renderScore = useCallback(() => {
    if (trackItem.score === 0) {
      return '-';
    }

    if (tracker.name === 'AniList') {
      const formatting = getAniListScoreFormatting(
        tracker.auth.meta.scoreFormat,
        true,
      );
      return formatting.label(trackItem.score);
    }

    if (tracker.name === 'MangaUpdates') {
      // Show decimal for MangaUpdates if it has decimal places
      return Number.isInteger(trackItem.score)
        ? trackItem.score.toString()
        : trackItem.score.toFixed(1);
    }

    return trackItem.score;
  }, [tracker, trackItem.score]);

  const renderChapters = useCallback(() => {
    const total = trackItem.totalChapters ? trackItem.totalChapters : '-';
    return `${trackItem.progress}/${total}`;
  }, [trackItem.progress, trackItem.totalChapters]);

  return (
    <View style={[styles.cardSurface, { backgroundColor: theme.surface }]}>
      <View style={[styles.titleContainer, styles.dividerBorderBottom]}>
        <Image source={icon} style={styles.trackerIconSmall} />
        <View style={styles.listItemContainer}>
          <AppText
            style={[{ color: theme.onSurfaceVariant }, styles.listItem]}
            numberOfLines={2}
          >
            {trackItem.title}
          </AppText>
          <IconButton
            icon="close"
            iconColor={theme.onSurfaceVariant}
            size={iconSize.sm}
            onPress={onUntrack}
          />
        </View>
      </View>
      <View style={styles.trackedItemRow}>
        <Pressable
          style={[styles.dividerBorderRight, styles.listItemLeft]}
          android_ripple={{ color: theme.rippleColor }}
          onPress={onSetStatus}
        >
          <AppText style={[{ color: theme.onSurfaceVariant }, styles.listItem]}>
            {getStatus(trackItem.status)}
          </AppText>
        </Pressable>
        <Pressable
          style={styles.flex1}
          android_ripple={{ color: theme.rippleColor }}
          onPress={onSetChapters}
        >
          <AppText style={[{ color: theme.onSurfaceVariant }, styles.listItem]}>
            {renderChapters()}
          </AppText>
        </Pressable>
        <Pressable
          style={[styles.dividerBorderLeft, styles.listItemRight]}
          android_ripple={{ color: theme.rippleColor }}
          onPress={onSetScore}
        >
          <AppText style={[{ color: theme.onSurfaceVariant }, styles.listItem]}>
            {renderScore()}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
};
