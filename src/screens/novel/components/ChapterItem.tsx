import React, { memo, ReactNode, useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import color from 'color';
import {
  ChapterBookmarkButton,
  DownloadButton,
} from './Chapter/ChapterDownloadButtons';
import { ThemeColors } from '@theme/types';
import { ChapterInfo } from '@database/types';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { getString } from '@strings/translations';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import AppText from '@components/AppText';

interface ChapterItemProps {
  isDownloading?: boolean;
  isBookmarked?: boolean;
  chapter: ChapterInfo;
  theme: ThemeColors;
  showChapterTitles: boolean;
  isSelected?: boolean;
  downloadChapter: () => void;
  deleteChapter: () => void;
  onSelectPress?: (chapter: ChapterInfo) => void;
  onSelectLongPress?: (chapter: ChapterInfo) => void;
  navigateToChapter: (chapter: ChapterInfo) => void;
  setChapterDownloaded?: (value: boolean) => void;
  left?: ReactNode;
  isLocal: boolean;
  isUpdateCard?: boolean;
  novelName: string;
}

const ChapterItem: React.FC<ChapterItemProps> = ({
  isDownloading,
  isBookmarked,
  chapter,
  theme,
  showChapterTitles,
  downloadChapter,
  deleteChapter,
  isSelected,
  onSelectPress,
  onSelectLongPress,
  navigateToChapter,
  setChapterDownloaded,
  isLocal,
  left,
  isUpdateCard,
  novelName,
}) => {
  const { id, name, unread, releaseTime, bookmark, chapterNumber, progress } =
    chapter;
  const { uiScale = 1.0 } = useAppSettings();

  isBookmarked ??= bookmark;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        chapterCardContainer: {
          alignItems: 'center',
          flexDirection: 'row',
          height: scaleDimension(64, uiScale),
          justifyContent: 'space-between',
          paddingHorizontal: scaleDimension(16, uiScale),
          paddingVertical: scaleDimension(8, uiScale),
        },
        row: {
          alignItems: 'center',
          flex: 1,
          flexDirection: 'row',
        },
        text: {
          fontSize: scaleDimension(12, uiScale),
        },
        unreadIcon: {
          marginRight: scaleDimension(4, uiScale),
        },
        contentContainer: {
          flex: 1,
        },
        chapterNameRow: {
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
        },
        infoRow: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        progressText: {
          marginTop: scaleDimension(4, uiScale),
        },
        progressTextWithReleaseTime: {
          marginLeft: scaleDimension(5, uiScale),
        },
        chapterNameText: {
          flex: 1,
        },
      }),
    [uiScale],
  );

  return (
    <View key={'chapterItem' + id}>
      <Pressable
        style={[
          styles.chapterCardContainer,
          isSelected && {
            backgroundColor: color(theme.primary).alpha(0.12).string(),
          },
        ]}
        onPress={() => {
          if (onSelectPress) {
            onSelectPress(chapter);
          } else {
            navigateToChapter(chapter);
          }
        }}
        onLongPress={() => onSelectLongPress?.(chapter)}
        android_ripple={{ color: theme.rippleColor }}
      >
        <View style={styles.row}>
          {left}
          {isBookmarked ? <ChapterBookmarkButton theme={theme} /> : null}
          <View style={styles.contentContainer}>
            {isUpdateCard ? (
              <AppText
                style={{
                  fontSize: scaleDimension(14, uiScale),
                  color: unread ? theme.onSurface : theme.outline,
                }}
                numberOfLines={1}
              >
                {novelName}
              </AppText>
            ) : null}
            <View style={styles.chapterNameRow}>
              {unread ? (
                <MaterialCommunityIcons
                  name="circle"
                  color={theme.primary}
                  size={scaleDimension(8, uiScale)}
                  style={styles.unreadIcon}
                />
              ) : null}

              <AppText
                style={[
                  {
                    fontSize: scaleDimension(isUpdateCard ? 12 : 14, uiScale),
                    color: !unread
                      ? theme.outline
                      : bookmark
                        ? theme.primary
                        : theme.onSurface,
                  },
                  styles.chapterNameText,
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {showChapterTitles
                  ? name
                  : getString('novelScreen.chapterChapnum', {
                      num: chapterNumber,
                    })}
              </AppText>
            </View>
            <View style={styles.infoRow}>
              {releaseTime && !isUpdateCard ? (
                <AppText
                  style={[
                    {
                      color: !unread
                        ? theme.outline
                        : bookmark
                          ? theme.primary
                          : theme.onSurfaceVariant,
                      marginTop: scaleDimension(4, uiScale),
                    },
                    styles.text,
                  ]}
                  numberOfLines={1}
                >
                  {releaseTime}
                </AppText>
              ) : null}
              {!isUpdateCard && progress && progress > 0 && chapter.unread ? (
                <AppText
                  style={[
                    {
                      color: theme.outline,
                    },
                    styles.text,
                    styles.progressText,
                    chapter.releaseTime && styles.progressTextWithReleaseTime,
                  ]}
                  numberOfLines={1}
                >
                  {chapter.releaseTime ? '•  ' : null}
                  {getString('novelScreen.progress', { progress })}
                </AppText>
              ) : null}
            </View>
          </View>
        </View>
        {!isLocal ? (
          <DownloadButton
            isDownloading={isDownloading}
            isDownloaded={chapter.isDownloaded}
            chapterId={chapter.id}
            theme={theme}
            setChapterDownloaded={setChapterDownloaded}
            deleteChapter={deleteChapter}
            downloadChapter={downloadChapter}
          />
        ) : null}
      </Pressable>
    </View>
  );
};

export default memo(ChapterItem, (prevProps, nextProps) => {
  // Return true if props are equal (skip re-render)
  // Return false if props changed (re-render)
  return (
    prevProps.chapter.id === nextProps.chapter.id &&
    prevProps.chapter.progress === nextProps.chapter.progress &&
    prevProps.chapter.unread === nextProps.chapter.unread &&
    prevProps.chapter.bookmark === nextProps.chapter.bookmark &&
    prevProps.chapter.isDownloaded === nextProps.chapter.isDownloaded &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isDownloading === nextProps.isDownloading &&
    prevProps.isBookmarked === nextProps.isBookmarked &&
    prevProps.showChapterTitles === nextProps.showChapterTitles
  );
});
