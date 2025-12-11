import React, { useEffect, useRef, useMemo } from 'react';
import { MD3ThemeType } from '@theme/types';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Menu, overlay } from 'react-native-paper';
import { getString } from '@strings/translations';
import { isChapterDownloaded } from '@database/queries/ChapterQueries';
import { useBoolean } from '@hooks/index';
import { IconButtonV2 } from '@components';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import Color from 'color';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

interface DownloadButtonProps {
  chapterId: number;
  isDownloaded: boolean;
  isDownloading?: boolean;
  theme: MD3ThemeType;
  deleteChapter: () => void;
  downloadChapter: () => void;
  setChapterDownloaded?: (value: boolean) => void;
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({
  chapterId,
  isDownloaded,
  isDownloading,
  theme,
  deleteChapter,
  downloadChapter,
  setChapterDownloaded,
}) => {
  const [downloaded, setDownloaded] = React.useState<boolean | undefined>(
    isDownloaded,
  );

  const {
    value: deleteChapterMenuVisible,
    setTrue: showDeleteChapterMenu,
    setFalse: hideDeleteChapterMenu,
  } = useBoolean();

  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return; // Skip the first render as it leads to 'Maximum update depth exceeded.' error
    }
    if (!isDownloading) {
      const isDownloadedValue = isChapterDownloaded(chapterId);
      setDownloaded(isDownloadedValue);
      setChapterDownloaded?.(isDownloadedValue);
    }
  }, [chapterId, isDownloading, setChapterDownloaded]);
  if (isDownloading || downloaded === undefined) {
    return <ChapterDownloadingButton theme={theme} />;
  }
  return downloaded ? (
    <Menu
      visible={deleteChapterMenuVisible}
      onDismiss={hideDeleteChapterMenu}
      anchor={
        <DeleteChapterButton theme={theme} onPress={showDeleteChapterMenu} />
      }
      contentStyle={{ backgroundColor: overlay(2, theme.surface) }}
    >
      <Menu.Item
        onPress={() => {
          deleteChapter();
          hideDeleteChapterMenu();
          setDownloaded(false);
        }}
        title={getString('common.delete')}
        titleStyle={{ color: theme.onSurface }}
      />
    </Menu>
  ) : (
    <DownloadChapterButton
      theme={theme}
      onPress={() => {
        downloadChapter();
        setDownloaded(undefined);
      }}
    />
  );
};

interface theme {
  theme: MD3ThemeType;
}
type buttonPropType = theme & {
  onPress: () => void;
};
export const ChapterDownloadingButton: React.FC<theme> = ({ theme }) => {
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          borderRadius: 50,
          width: scaleDimension(40, uiScale),
          height: scaleDimension(40, uiScale),
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        },
        activityIndicator: {
          margin: scaleDimension(3.5, uiScale),
          padding: scaleDimension(5, uiScale),
        },
      }),
    [uiScale],
  );

  return (
    <View style={styles.container}>
      <ActivityIndicator
        color={theme.outline}
        size={scaleDimension(25, uiScale)}
        style={styles.activityIndicator}
      />
    </View>
  );
};

const DownloadIcon: React.FC<theme> = ({ theme }) => {
  const { uiScale = 1.0 } = useAppSettings();
  const iconSize = useMemo(() => scaleDimension(25, uiScale), [uiScale]);

  return (
    <MaterialCommunityIcons
      name="arrow-down-circle-outline"
      size={iconSize}
      color={theme.outline}
    />
  );
};

export const DownloadChapterButton: React.FC<buttonPropType> = ({
  theme,
  onPress,
}) => {
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          borderRadius: 50,
          width: scaleDimension(40, uiScale),
          height: scaleDimension(40, uiScale),
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        },
        pressable: {
          width: scaleDimension(40, uiScale),
          height: scaleDimension(40, uiScale),
          alignItems: 'center',
          justifyContent: 'center',
        },
      }),
    [uiScale],
  );

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.pressable}
        onPress={onPress}
        android_ripple={{ color: Color(theme.primary).alpha(0.12).string() }}
      >
        <DownloadIcon theme={theme} />
      </Pressable>
    </View>
  );
};

const DeleteIcon: React.FC<theme> = ({ theme }) => {
  const { uiScale = 1.0 } = useAppSettings();
  const iconSize = useMemo(() => scaleDimension(25, uiScale), [uiScale]);

  return (
    <MaterialCommunityIcons
      name="check-circle"
      size={iconSize}
      color={theme.onSurface}
    />
  );
};

export const DeleteChapterButton: React.FC<buttonPropType> = ({
  theme,
  onPress,
}) => {
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          borderRadius: 50,
          width: scaleDimension(40, uiScale),
          height: scaleDimension(40, uiScale),
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        },
        pressable: {
          width: scaleDimension(40, uiScale),
          height: scaleDimension(40, uiScale),
          alignItems: 'center',
          justifyContent: 'center',
        },
      }),
    [uiScale],
  );

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.pressable}
        onPress={onPress}
        android_ripple={{ color: Color(theme.primary).alpha(0.12).string() }}
      >
        <DeleteIcon theme={theme} />
      </Pressable>
    </View>
  );
};

export const ChapterBookmarkButton: React.FC<theme> = ({ theme }) => {
  const { uiScale = 1.0 } = useAppSettings();

  const iconSize = useMemo(() => scaleDimension(18, uiScale), [uiScale]);
  const iconButtonStyle = useMemo(
    () => ({ marginLeft: scaleDimension(2, uiScale) }),
    [uiScale],
  );

  return (
    <IconButtonV2
      name="bookmark"
      theme={theme}
      color={theme.primary}
      size={iconSize}
      style={iconButtonStyle}
    />
  );
};
