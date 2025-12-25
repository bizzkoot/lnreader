import React, { memo, useMemo } from 'react';
import {
  StyleSheet,
  View,
  useWindowDimensions,
  Pressable,
  Image,
  ImageStyle,
  ViewStyle,
} from 'react-native';

import AppText from '@components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import ListView from './ListView';

import { useDeviceOrientation } from '@hooks';
import { coverPlaceholderColor } from '../theme/colors';
import { DisplayModes } from '@screens/library/constants/constants';
import { DBNovelInfo, NovelInfo } from '@database/types';
import { NovelItem, ImageRequestInit } from '@plugins/types';
import { ThemeColors } from '@theme/types';
import { useLibrarySettings } from '@hooks/persisted';
import { getUserAgent } from '@hooks/persisted/useUserAgent';
import { getString } from '@strings/translations';
import SourceScreenSkeletonLoading from '@screens/browse/loadingAnimation/SourceScreenSkeletonLoading';
import { defaultCover } from '@plugins/helpers/constants';
import { ActivityIndicator } from 'react-native-paper';
import { useScaledDimensions } from '@hooks/useScaledDimensions';
import { useAppSettings } from '@hooks/persisted/useSettings';

interface UnreadBadgeProps {
  chaptersDownloaded: number;
  chaptersUnread: number;
  showDownloadBadges: boolean;
  theme: ThemeColors;
}

interface DownloadBadgeProps {
  chaptersDownloaded: number;
  chaptersUnread: number;
  showUnreadBadges: boolean;
  theme: ThemeColors;
}

type CoverItemDB = DBNovelInfo & {
  completeRow?: number;
};

type CoverItemLibrary = NovelInfo & {
  completeRow?: number;
};

type CoverItemPlugin = NovelItem & {
  completeRow?: number;
};

interface INovelCover<TNovel> {
  item: TNovel;
  onPress: () => void;
  libraryStatus: boolean;
  theme: ThemeColors;
  isSelected: boolean;
  addSkeletonLoading?: boolean;
  inActivity?: boolean;
  onLongPress: (item: TNovel) => void;
  selectedNovelIds: number[];
  globalSearch?: boolean;
  imageRequestInit?: ImageRequestInit;
}

function isFromDB(
  item: CoverItemLibrary | CoverItemPlugin | CoverItemDB,
): item is CoverItemDB {
  return 'chaptersDownloaded' in item;
}

function NovelCover<
  TNovel extends CoverItemLibrary | CoverItemPlugin | CoverItemDB,
>({
  item,
  onPress,
  libraryStatus,
  theme,
  isSelected,
  addSkeletonLoading,
  inActivity,
  onLongPress,
  globalSearch,
  selectedNovelIds,
  imageRequestInit,
}: INovelCover<TNovel>) {
  const {
    displayMode = DisplayModes.Comfortable,
    showDownloadBadges = true,
    showUnreadBadges = true,
    novelsPerRow = 3,
  } = useLibrarySettings();

  const window = useWindowDimensions();
  const { uiScale = 1.0 } = useAppSettings();
  const scaledDimensions = useScaledDimensions();
  const scaledStyles = useMemo(
    () => getScaledStyles(scaledDimensions),
    [scaledDimensions],
  );

  const orientation = useDeviceOrientation();

  const numColumns = useMemo(
    () => (orientation === 'landscape' ? 6 : novelsPerRow),
    [orientation, novelsPerRow],
  );

  // Base cover dimensions (before scaling)
  const baseCoverWidth = useMemo(() => {
    if (globalSearch) {
      return window.width / 3 - 32; // Base padding of 16dp per side
    }
    return window.width / numColumns - 32;
  }, [globalSearch, window.width, numColumns]);

  // Apply scale to cover dimensions
  const coverHeight = useMemo(() => {
    return baseCoverWidth * (4 / 3) * uiScale;
  }, [baseCoverWidth, uiScale]);

  const coverWidth = useMemo(() => {
    if (globalSearch) {
      return baseCoverWidth * uiScale;
    }
    return undefined;
  }, [globalSearch, baseCoverWidth, uiScale]);

  const selectNovel = () => onLongPress(item);

  const uri = item.cover || defaultCover;
  const requestInit = imageRequestInit || ({} as ImageRequestInit);
  if (!requestInit.headers) {
    requestInit.headers = {
      'User-Agent': getUserAgent(),
    };
  }

  if (item.completeRow) {
    if (!addSkeletonLoading) {
      return <></>;
    }
    return (
      <SourceScreenSkeletonLoading
        theme={theme}
        completeRow={item.completeRow}
      />
    );
  }

  const flex = globalSearch ? 1 : 1 / numColumns;
  const margin = globalSearch ? 0 : 2;

  return displayMode !== DisplayModes.List || globalSearch ? (
    <View
      style={[
        {
          flex,
          width: coverWidth,
          margin,
        },
        styles.standardNovelCover,
        scaledStyles.novelCoverBorderRadius,
        isSelected && {
          backgroundColor: theme.primary,
          ...styles.selectedNovelCover,
        },
      ]}
    >
      <Pressable
        android_ripple={{ color: theme.rippleColor }}
        style={[styles.flexOne, scaledStyles.opacPadding]}
        onPress={
          selectedNovelIds && selectedNovelIds.length > 0
            ? selectNovel
            : onPress
        }
        onLongPress={selectNovel}
      >
        <View style={[styles.badgeContainer, scaledStyles.badgePosition]}>
          {libraryStatus ? (
            <InLibraryBadge theme={theme} scaledStyles={scaledStyles} />
          ) : null}
          {isFromDB(item) ? (
            <>
              {showDownloadBadges && item.chaptersDownloaded > 0 ? (
                <DownloadBadge
                  showUnreadBadges={showUnreadBadges}
                  chaptersDownloaded={item.chaptersDownloaded}
                  chaptersUnread={item.chaptersUnread}
                  theme={theme}
                  scaledStyles={scaledStyles}
                />
              ) : null}
              {showUnreadBadges && item.chaptersUnread > 0 ? (
                <UnreadBadge
                  theme={theme}
                  chaptersDownloaded={item.chaptersDownloaded}
                  chaptersUnread={item.chaptersUnread}
                  showDownloadBadges={showDownloadBadges}
                  scaledStyles={scaledStyles}
                />
              ) : null}
            </>
          ) : null}
          {inActivity ? (
            <InActivityBadge theme={theme} scaledStyles={scaledStyles} />
          ) : null}
        </View>
        <Image
          source={{ uri, ...requestInit }}
          style={[
            {
              height: coverHeight,
              backgroundColor: coverPlaceholderColor,
            },
            scaledStyles.standardBorderRadius,
            libraryStatus && styles.opacityPoint5,
          ]}
        />
        <View
          style={[
            styles.compactTitleContainer,
            scaledStyles.compactTitlePosition,
          ]}
        >
          {displayMode === DisplayModes.Compact ? (
            <CompactTitle novelName={item.name} scaledStyles={scaledStyles} />
          ) : null}
        </View>
        {displayMode === DisplayModes.Comfortable ? (
          <ComfortableTitle
            novelName={item.name}
            theme={theme}
            width={coverWidth}
            scaledStyles={scaledStyles}
          />
        ) : null}
      </Pressable>
    </View>
  ) : (
    <ListView
      item={item}
      downloadBadge={
        showDownloadBadges && isFromDB(item) && item.chaptersDownloaded ? (
          <DownloadBadge
            theme={theme}
            showUnreadBadges={showUnreadBadges}
            chaptersDownloaded={item.chaptersDownloaded}
            chaptersUnread={item.chaptersUnread}
            scaledStyles={scaledStyles}
          />
        ) : null
      }
      unreadBadge={
        showUnreadBadges && isFromDB(item) && item.chaptersUnread ? (
          <UnreadBadge
            theme={theme}
            chaptersDownloaded={item.chaptersDownloaded}
            chaptersUnread={item.chaptersUnread}
            showDownloadBadges={showDownloadBadges}
            scaledStyles={scaledStyles}
          />
        ) : null
      }
      inLibraryBadge={
        libraryStatus && (
          <InLibraryBadge theme={theme} scaledStyles={scaledStyles} />
        )
      }
      theme={theme}
      onPress={
        selectedNovelIds && selectedNovelIds.length > 0 ? selectNovel : onPress
      }
      onLongPress={selectNovel}
      isSelected={isSelected}
      scaledStyles={scaledStyles}
    />
  );
}

export default memo(NovelCover);

interface ScaledStyles {
  LeftBorderRadius: ViewStyle;
  RightBorderRadius: ViewStyle;
  activityBadge: ViewStyle;
  activityIndicatorSize: number;
  badgePosition: ViewStyle;
  badgeFontSize: number;
  compactTitlePosition: ViewStyle;
  downloadBadge: ViewStyle;
  extensionIcon: ImageStyle;
  inLibraryBadge: ViewStyle;
  linearGradient: ViewStyle;
  listViewPadding: ViewStyle;
  novelCoverBorderRadius: ViewStyle;
  opacPadding: ViewStyle;
  padding4: ViewStyle;
  standardBorderRadius: ViewStyle;
  titlePadding: ViewStyle;
  titleFontSize: number;
  titleBorderRadius: ViewStyle;
  unreadBadge: ViewStyle;
}

const ComfortableTitle = ({
  theme,
  novelName,
  width,
  scaledStyles,
}: {
  theme: ThemeColors;
  novelName: string;
  width?: number;
  scaledStyles: ScaledStyles;
}) => (
  <AppText
    numberOfLines={2}
    style={[
      styles.title,
      scaledStyles.titlePadding,
      {
        color: theme.onSurface,
        maxWidth: width,
        fontSize: scaledStyles.titleFontSize,
      },
    ]}
  >
    {novelName}
  </AppText>
);

const CompactTitle = ({
  novelName,
  scaledStyles,
}: {
  novelName: string;
  scaledStyles: ScaledStyles;
}) => (
  <View style={[styles.titleContainer, scaledStyles.titleBorderRadius]}>
    <LinearGradient
      colors={['transparent', 'rgba(0,0,0,0.7)']}
      style={scaledStyles.linearGradient}
    >
      <AppText
        numberOfLines={2}
        style={[
          styles.title,
          styles.compactTitle,
          scaledStyles.titlePadding,
          { fontSize: scaledStyles.titleFontSize },
        ]}
      >
        {novelName}
      </AppText>
    </LinearGradient>
  </View>
);

const InLibraryBadge = ({
  theme,
  scaledStyles,
}: {
  theme: ThemeColors;
  scaledStyles: ScaledStyles;
}) => (
  <AppText
    style={[
      scaledStyles.inLibraryBadge,
      {
        backgroundColor: theme.primary,
        color: theme.onPrimary,
      },
      scaledStyles.standardBorderRadius,
    ]}
  >
    {getString('novelScreen.inLibaray')}
  </AppText>
);

const InActivityBadge = ({
  theme,
  scaledStyles,
}: {
  theme: ThemeColors;
  scaledStyles: ScaledStyles;
}) => (
  <View
    style={[
      scaledStyles.activityBadge,
      {
        backgroundColor: theme.primary,
      },
      scaledStyles.standardBorderRadius,
    ]}
  >
    <ActivityIndicator
      animating={true}
      size={scaledStyles.activityIndicatorSize}
      color={theme.onPrimary}
    />
  </View>
);

interface BadgeProps {
  chaptersDownloaded: number;
  chaptersUnread: number;
  theme: ThemeColors;
  scaledStyles: ScaledStyles;
}
interface UnreadBadgeProps extends BadgeProps {
  showDownloadBadges: boolean;
}
interface DownloadBadgeProps extends BadgeProps {
  showUnreadBadges: boolean;
}

const UnreadBadge: React.FC<UnreadBadgeProps> = ({
  chaptersDownloaded,
  chaptersUnread,
  showDownloadBadges,
  theme,
  scaledStyles,
}: UnreadBadgeProps) => (
  <AppText
    style={[
      scaledStyles.unreadBadge,
      !chaptersDownloaded && scaledStyles.LeftBorderRadius,
      !showDownloadBadges && scaledStyles.standardBorderRadius,
      {
        backgroundColor: theme.primary,
        color: theme.onPrimary,
        fontSize: scaledStyles.badgeFontSize,
      },
    ]}
  >
    {chaptersUnread}
  </AppText>
);

const DownloadBadge: React.FC<DownloadBadgeProps> = ({
  chaptersDownloaded,
  showUnreadBadges,
  chaptersUnread,
  theme,
  scaledStyles,
}: DownloadBadgeProps) => (
  <AppText
    style={[
      scaledStyles.downloadBadge,
      !chaptersUnread && scaledStyles.RightBorderRadius,
      !showUnreadBadges && scaledStyles.standardBorderRadius,
      {
        backgroundColor: theme.tertiary,
        color: theme.onTertiary,
        fontSize: scaledStyles.badgeFontSize,
      },
    ]}
  >
    {chaptersDownloaded}
  </AppText>
);

const styles = StyleSheet.create({
  compactTitle: {
    color: 'rgba(255,255,255,1)',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  compactTitleContainer: {
    position: 'absolute',
  },
  badgeContainer: {
    flexDirection: 'row',
    position: 'absolute',
    zIndex: 1,
  },
  flexOne: {
    flex: 1,
  },
  listView: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
  },
  opacityPoint5: { opacity: 0.5 },
  selectedNovelCover: {
    opacity: 0.8,
  },
  standardNovelCover: {
    overflow: 'hidden',
  },
  title: {
    fontFamily: 'pt-sans-bold',
  },
  titleContainer: {
    flex: 1,
  },
});

// Scaled styles - created dynamically based on uiScale
const getScaledStyles = (scaled: ReturnType<typeof useScaledDimensions>) => ({
  LeftBorderRadius: {
    borderBottomLeftRadius: scaled.borderRadius.sm,
    borderTopLeftRadius: scaled.borderRadius.sm,
  },
  RightBorderRadius: {
    borderBottomRightRadius: scaled.borderRadius.sm,
    borderTopRightRadius: scaled.borderRadius.sm,
  },
  activityBadge: {
    marginHorizontal: scaled.margin.xs,
    padding: scaled.padding.xs + 1,
  },
  activityIndicatorSize: scaled.iconSize.sm,
  badgePosition: {
    left: scaled.padding.sm + 2,
    top: scaled.padding.sm + 2,
  },
  compactTitlePosition: {
    bottom: scaled.padding.xs,
    left: scaled.padding.xs,
    right: scaled.padding.xs,
  },
  downloadBadge: {
    borderBottomLeftRadius: scaled.borderRadius.sm,
    borderTopLeftRadius: scaled.borderRadius.sm,
    paddingHorizontal: scaled.padding.xs + 1,
    paddingTop: scaled.padding.xs / 2,
    fontFamily: 'pt-sans-bold',
  },
  extensionIcon: {
    borderRadius: scaled.borderRadius.sm,
    height: scaled.iconSize.xl + 6,
    width: scaled.iconSize.xl + 6,
  },
  inLibraryBadge: {
    paddingHorizontal: scaled.padding.xs,
    paddingVertical: scaled.padding.xs / 2,
  },
  linearGradient: {
    borderRadius: scaled.borderRadius.sm,
  },
  listViewPadding: {
    paddingHorizontal: scaled.padding.md / 1.33,
    paddingVertical: scaled.padding.sm,
  },
  opacPadding: {
    borderRadius: scaled.borderRadius.sm,
    padding: scaled.padding.xs + 0.8,
  },
  padding4: { padding: scaled.padding.xs },
  standardBorderRadius: {
    borderRadius: scaled.borderRadius.sm,
  },
  novelCoverBorderRadius: {
    borderRadius: scaled.borderRadius.sm + 2,
  },
  titlePadding: {
    padding: scaled.padding.sm,
  },
  titleFontSize: scaled.iconSize.sm - 2, // 14 at scale 1.0
  titleBorderRadius: {
    borderRadius: scaled.borderRadius.sm,
  },
  unreadBadge: {
    borderBottomRightRadius: scaled.borderRadius.sm,
    borderTopRightRadius: scaled.borderRadius.sm,
    paddingHorizontal: scaled.padding.xs,
    paddingTop: scaled.padding.xs / 2,
    fontFamily: 'pt-sans-bold',
  },
  badgeFontSize: scaled.iconSize.sm - 4,
});
