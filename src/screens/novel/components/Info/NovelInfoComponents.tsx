import React, { useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  View,
  Pressable,
  ImageBackground,
  Image,
  ImageURISource,
} from 'react-native';
import color from 'color';
import { IconButton, Portal } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Chip } from '../../../../components';
import { coverPlaceholderColor } from '../../../../theme/colors';
import { ThemeColors } from '@theme/types';
import { getString } from '@strings/translations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScaledDimensions } from '@hooks/useScaledDimensions';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import AppText from '@components/AppText';

interface CoverImageProps {
  children: React.ReactNode;
  source: ImageURISource;
  theme: ThemeColors;
  hideBackdrop: boolean;
}

interface NovelThumbnailProps {
  source: ImageURISource;
  theme: ThemeColors;
  setCustomNovelCover: () => Promise<void>;
  saveNovelCover: () => Promise<void>;
}

interface NovelTitleProps {
  theme: ThemeColors;
  children: React.ReactNode;
  onLongPress: () => void;
  onPress: () => void;
}

const NovelInfoContainer = ({ children }: { children: React.ReactNode }) => {
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        novelInfoContainer: {
          flexDirection: 'row',
          margin: scaleDimension(16, uiScale),
          marginBottom: 0,
          marginTop: scaleDimension(28, uiScale),
          paddingTop: scaleDimension(90, uiScale),
        },
      }),
    [uiScale],
  );

  return <View style={styles.novelInfoContainer}>{children}</View>;
};

const CoverImage = ({
  children,
  source,
  theme,
  hideBackdrop,
}: CoverImageProps) => {
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        coverImage: {},
        flex1: {
          flex: 1,
        },
        linearGradient: {
          flex: 1,
        },
      }),
    [uiScale],
  );

  if (hideBackdrop) {
    return <View>{children}</View>;
  } else {
    return (
      <ImageBackground source={source} style={styles.coverImage}>
        <View
          style={[
            { backgroundColor: color(theme.background).alpha(0.7).string() },
            styles.flex1,
          ]}
        >
          {source.uri ? (
            <LinearGradient
              colors={['rgba(0,0,0,0)', theme.background]}
              locations={[0, 1]}
              style={styles.linearGradient}
            >
              {children}
            </LinearGradient>
          ) : (
            children
          )}
        </View>
      </ImageBackground>
    );
  }
};

const NovelThumbnail = ({
  source,
  theme,
  setCustomNovelCover,
  saveNovelCover,
}: NovelThumbnailProps) => {
  const [expanded, setExpanded] = useState(false);
  const { top, right } = useSafeAreaInsets();
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        novelThumbnailContainer: {
          height: scaleDimension(150, uiScale),
          marginHorizontal: scaleDimension(4, uiScale),
          width: scaleDimension(100, uiScale),
        },
        novelThumbnail: {
          backgroundColor: coverPlaceholderColor,
          borderRadius: scaleDimension(6, uiScale),
          height: scaleDimension(150, uiScale),
          width: scaleDimension(100, uiScale),
        },
        absoluteIcon: {
          position: 'absolute',
        },
        expandedOverlay: {
          position: 'absolute',
          width: '100%',
          height: '100%',
          flex: 1,
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.7)',
        },
        flex1: {
          flex: 1,
        },
        zIndex: { zIndex: 10 },
      }),
    [uiScale],
  );

  return (
    <Pressable
      onPress={() => setExpanded(!expanded)}
      style={styles.novelThumbnailContainer}
    >
      {!expanded ? (
        <Image source={source} style={styles.novelThumbnail} />
      ) : (
        <Portal>
          <IconButton
            icon="content-save"
            style={[
              styles.absoluteIcon,
              styles.zIndex,
              { top: top + 6, right: right + 6 },
            ]}
            iconColor={theme.onBackground}
            onPress={saveNovelCover}
          />
          <IconButton
            icon="pencil-outline"
            style={[
              styles.absoluteIcon,
              styles.zIndex,
              { top: top + 6, right: right + 60 },
            ]}
            iconColor={theme.onBackground}
            onPress={setCustomNovelCover}
          />
          <Pressable
            style={[styles.expandedOverlay]}
            onPress={() => setExpanded(false)}
          >
            <Image source={source} resizeMode="contain" style={styles.flex1} />
          </Pressable>
        </Portal>
      )}
    </Pressable>
  );
};

const NovelTitle = ({
  theme,
  children,
  onLongPress,
  onPress,
}: NovelTitleProps) => {
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        novelTitle: {
          fontSize: scaleDimension(20, uiScale),
        },
      }),
    [uiScale],
  );

  return (
    <AppText
      onLongPress={onLongPress}
      onPress={onPress}
      style={[{ color: theme.onBackground }, styles.novelTitle]}
      numberOfLines={4}
    >
      {children}
    </AppText>
  );
};

const NovelInfo = ({
  theme,
  children,
}: {
  theme: ThemeColors;
  children: React.ReactNode;
}) => {
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        novelInfo: {
          fontSize: scaleDimension(14, uiScale),
          marginBottom: scaleDimension(4, uiScale),
        },
      }),
    [uiScale],
  );

  return (
    <AppText
      style={[{ color: theme.onSurfaceVariant }, styles.novelInfo]}
      numberOfLines={1}
    >
      {children}
    </AppText>
  );
};

const FollowButton = ({
  theme,
  onPress,
  followed,
}: {
  theme: ThemeColors;
  onPress: () => void;
  followed: boolean;
}) => {
  const { iconSize } = useScaledDimensions();
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        followButtonContainer: {
          borderRadius: scaleDimension(4, uiScale),
          overflow: 'hidden',
          flex: 1,
        },
        followButtonPressable: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingBottom: scaleDimension(8, uiScale),
        },
        followButtonText: {
          fontSize: scaleDimension(12, uiScale),
        },
        iconButton: {
          margin: 0,
        },
      }),
    [uiScale],
  );

  return (
    <View style={styles.followButtonContainer}>
      <Pressable
        android_ripple={{
          color: color(theme.primary).alpha(0.12).string(),
          borderless: false,
        }}
        onPress={onPress}
        style={styles.followButtonPressable}
      >
        <IconButton
          icon={followed ? 'heart' : 'heart-outline'}
          iconColor={followed ? theme.primary : theme.outline}
          size={iconSize.md}
          style={styles.iconButton}
        />
        <AppText
          style={[
            { color: followed ? theme.primary : theme.outline },
            styles.followButtonText,
          ]}
        >
          {followed
            ? getString('novelScreen.inLibaray')
            : getString('novelScreen.addToLibaray')}
        </AppText>
      </Pressable>
    </View>
  );
};

const TrackerButton = ({
  theme,
  isTracked,
  onPress,
}: {
  theme: ThemeColors;
  onPress: () => void;
  isTracked: boolean;
}) => {
  const { iconSize } = useScaledDimensions();
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        followButtonContainer: {
          borderRadius: scaleDimension(4, uiScale),
          overflow: 'hidden',
          flex: 1,
        },
        followButtonPressable: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingBottom: scaleDimension(8, uiScale),
        },
        followButtonText: {
          fontSize: scaleDimension(12, uiScale),
        },
        iconButton: {
          margin: 0,
        },
      }),
    [uiScale],
  );

  return (
    <View style={styles.followButtonContainer}>
      <Pressable
        android_ripple={{
          color: theme.rippleColor,
          borderless: false,
        }}
        onPress={onPress}
        style={styles.followButtonPressable}
      >
        <IconButton
          icon={isTracked ? 'check' : 'sync'}
          iconColor={isTracked ? theme.primary : theme.outline}
          size={iconSize.md}
          style={styles.iconButton}
        />
        <AppText
          style={[
            { color: isTracked ? theme.primary : theme.outline },
            styles.followButtonText,
          ]}
        >
          {isTracked
            ? getString('novelScreen.tracked')
            : getString('novelScreen.tracking')}
        </AppText>
      </Pressable>
    </View>
  );
};

const NovelGenres = ({
  theme,
  genres,
}: {
  theme: ThemeColors;
  genres: string;
}) => {
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        genreContainer: {
          paddingBottom: scaleDimension(4, uiScale),
          paddingHorizontal: scaleDimension(16, uiScale),
        },
      }),
    [uiScale],
  );

  const data = genres.split(/,\s*/);

  return (
    <FlatList
      contentContainerStyle={styles.genreContainer}
      horizontal
      data={data}
      keyExtractor={(item, index) => 'genre' + index}
      renderItem={({ item }) => <Chip label={item} theme={theme} />}
      showsHorizontalScrollIndicator={false}
    />
  );
};

export {
  NovelInfoContainer,
  CoverImage,
  NovelThumbnail,
  NovelTitle,
  NovelInfo,
  FollowButton,
  TrackerButton,
  NovelGenres,
};
