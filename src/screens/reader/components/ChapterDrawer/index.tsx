import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppSettings, useTheme } from '@hooks/persisted';
import { Button, LoadingScreenV2 } from '@components/index';
import { scaleDimension } from '@theme/scaling';
import { EdgeInsets, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getString } from '@strings/translations';
import { ThemeColors } from '@theme/types';
import renderListChapter from './RenderListChapter';
import { useChapterContext } from '@screens/reader/ChapterContext';
import { useNovelContext } from '@screens/novel/NovelContext';
import { LegendList, LegendListRef, ViewToken } from '@legendapp/list';

type ButtonProperties = {
  text: string;
  index?: number;
};

type ButtonsProperties = {
  up: ButtonProperties;
  down: ButtonProperties;
};

const ChapterDrawer = () => {
  const { chapter, getChapter, setLoading } = useChapterContext();
  const { chapters, novelSettings, pages, setPageIndex } = useNovelContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { defaultChapterSort, uiScale = 1.0 } = useAppSettings();
  const listRef = useRef<LegendListRef | null>(null);
  // ChapterInfo is used via the hooks

  const styles = useMemo(
    () => createStylesheet(theme, insets, uiScale),
    [theme, insets, uiScale],
  );

  const { sort = defaultChapterSort } = novelSettings;
  const listAscending = sort === 'ORDER BY position ASC';

  const defaultButtonLayout: ButtonsProperties = useMemo(
    () => ({
      up: {
        text: getString('readerScreen.drawer.scrollToTop'),
        index: 0,
      },
      down: {
        text: getString('readerScreen.drawer.scrollToBottom'),
        index: undefined,
      },
    }),
    [],
  );

  useEffect(() => {
    let pageIndex = pages.indexOf(chapter.page);
    if (pageIndex === -1) {
      pageIndex = 0;
    }
    setPageIndex(pageIndex);
  }, [chapter, pages, setPageIndex]);

  const calculateScrollToIndex = useCallback(() => {
    if (chapters.length < 1) {
      return;
    }

    const indexOfCurrentChapter =
      chapters.findIndex(el => {
        return el.id === chapter.id;
      }) || 0;

    return indexOfCurrentChapter >= 2 ? indexOfCurrentChapter - 2 : 0;
  }, [chapters, chapter.id]);

  const scrollToIndex = useRef<number | undefined>(calculateScrollToIndex());

  const [footerBtnProps, setButtonProperties] =
    useState<ButtonsProperties>(defaultButtonLayout);

  const checkViewableItems = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const curChapter = getString(
        'readerScreen.drawer.scrollToCurrentChapter',
      );
      const newBtnLayout = Object.create(defaultButtonLayout);

      if (viewableItems.length === 0) return;
      const cKey = (scrollToIndex.current ?? 0) + 2;
      const vKey = parseInt(viewableItems[0].key, 10);
      const visible = vKey <= cKey && cKey <= vKey + viewableItems.length - 1;

      if (!visible && scrollToIndex.current !== undefined) {
        if (
          listAscending
            ? (viewableItems[0].index ?? 0) < scrollToIndex.current + 2
            : (viewableItems[0].index ?? 0) > scrollToIndex.current + 2
        ) {
          newBtnLayout.down = {
            text: curChapter,
            index: scrollToIndex.current,
          };
        } else {
          newBtnLayout.up = {
            text: curChapter,
            index: scrollToIndex.current,
          };
        }
      }
      if (cKey <= 2 && vKey <= 4) {
        newBtnLayout.up = {
          text: curChapter,
          index: scrollToIndex.current,
        };
      }
      setButtonProperties(newBtnLayout);
    },
    [defaultButtonLayout, listAscending],
  );
  const scroll = useCallback((index?: number) => {
    if (index !== undefined) {
      listRef.current?.scrollToIndex({
        index,
        animated: true,
      });
    } else {
      listRef.current?.scrollToEnd({
        animated: true,
      });
    }
  }, []);

  useEffect(() => {
    const next = calculateScrollToIndex();
    if (next !== undefined) {
      if (scrollToIndex.current === undefined) {
        scroll(next);
      }
      scrollToIndex.current = next;
    }
  }, [chapters, chapter.id, calculateScrollToIndex, scroll]);

  return (
    <View style={styles.drawer}>
      <Text style={styles.headerCtn}>{getString('common.chapters')}</Text>
      {scrollToIndex === undefined ? (
        <LoadingScreenV2 theme={theme} />
      ) : (
        <LegendList
          ref={listRef}
          recycleItems
          viewabilityConfig={{
            minimumViewTime: 100,
            viewAreaCoveragePercentThreshold: 95,
          }}
          onViewableItemsChanged={checkViewableItems}
          data={chapters}
          extraData={[chapter, scrollToIndex.current]}
          keyExtractor={item =>
            `chapter_${item.id}_${item.position ?? 'no_pos'}`
          }
          renderItem={val =>
            renderListChapter({
              item: val.item,
              styles,
              theme,
              chapterId: chapter.id,
              onPress: () => {
                setLoading(true);
                getChapter(val.item);
              },
            })
          }
          estimatedItemSize={scaleDimension(60, uiScale)}
          initialScrollIndex={scrollToIndex.current}
        />
      )}
      <View style={styles.footer}>
        <Button
          mode="contained"
          style={styles.button}
          title={footerBtnProps.up.text}
          onPress={() => scroll(footerBtnProps.up.index)}
        />
        <Button
          mode="contained"
          style={styles.button}
          title={footerBtnProps.down.text}
          onPress={() => scroll(footerBtnProps.down.index)}
        />
      </View>
    </View>
  );
};

const createStylesheet = (
  theme: ThemeColors,
  insets: EdgeInsets,
  uiScale: number,
) => {
  return StyleSheet.create({
    button: {
      marginBottom: scaleDimension(12, uiScale),
      marginHorizontal: scaleDimension(16, uiScale),
      marginTop: scaleDimension(4, uiScale),
    },
    chapterCtn: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: scaleDimension(20, uiScale),
      paddingVertical: scaleDimension(10, uiScale),
    },
    chapterNameCtn: {
      color: theme.onSurface,
      fontSize: scaleDimension(12, uiScale),
      marginBottom: scaleDimension(2, uiScale),
    },
    drawer: {
      backgroundColor: theme.surface,
      flex: 1,
      paddingTop: scaleDimension(48, uiScale),
    },
    drawerElementContainer: {
      borderRadius: scaleDimension(50, uiScale),
      margin: scaleDimension(4, uiScale),
      marginLeft: scaleDimension(16, uiScale),
      marginRight: scaleDimension(16, uiScale),
      minHeight: scaleDimension(48, uiScale),
      overflow: 'hidden',
    },
    footer: {
      borderTopColor: theme.outline,
      borderTopWidth: 1,
      marginTop: scaleDimension(4, uiScale),
      paddingBottom: insets.bottom,
      paddingTop: scaleDimension(8, uiScale),
    },
    headerCtn: {
      borderBottomColor: theme.outline,
      borderBottomWidth: 1,
      color: theme.onSurface,
      fontSize: scaleDimension(16, uiScale),
      fontWeight: '500',
      marginBottom: scaleDimension(4, uiScale),
      padding: scaleDimension(16, uiScale),
    },
    releaseDateCtn: {
      color: theme.onSurfaceVariant,
      fontSize: scaleDimension(10, uiScale),
    },
  });
};

export default ChapterDrawer;
