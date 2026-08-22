import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useChapterGeneralSettings, useTheme } from '@hooks/persisted';

import ReaderAppbar from './components/ReaderAppbar';
import ReaderFooter from './components/ReaderFooter';
import ReaderSearchbar from './components/ReaderSearchbar';

// Using refactored WebViewReader with TTS logic extracted to useTTSController hook
import WebViewReader from './components/WebViewReader';
import ReaderBottomSheetV2 from './components/ReaderBottomSheet/ReaderBottomSheet';
import ChapterDrawer from './components/ChapterDrawer';
import ChapterLoadingScreen from './ChapterLoadingScreen/ChapterLoadingScreen';
import { ErrorScreenV2 } from '@components';
import { ChapterScreenProps } from '@navigators/types';
import { getString } from '@strings/translations';
import KeepScreenAwake from './components/KeepScreenAwake';
import { ChapterContextProvider, useChapterContext } from './ChapterContext';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { useBackHandler } from '@hooks/index';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import { Drawer } from 'react-native-drawer-layout';
import { ReaderSearchResult, EMPTY_READER_SEARCH_RESULT } from './types';

const Chapter = ({ route, navigation }: ChapterScreenProps) => {
  const [open, setOpen] = useState(false);

  useBackHandler(() => {
    if (open) {
      setOpen(false);
      return true;
    }
    return false;
  });

  const openDrawer = useCallback(() => {
    setOpen(true);
  }, []);

  return (
    <ChapterContextProvider
      novel={route.params.novel}
      initialChapter={route.params.chapter}
    >
      <Drawer
        drawerStyle={styles.drawer}
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        renderDrawerContent={() => <ChapterDrawer />}
      >
        <ChapterContent
          route={route}
          navigation={navigation}
          openDrawer={openDrawer}
        />
      </Drawer>
    </ChapterContextProvider>
  );
};

type ChapterContentProps = ChapterScreenProps & {
  openDrawer: () => void;
};

export const ChapterContent = ({
  navigation,
  openDrawer,
}: ChapterContentProps) => {
  const { left, right } = useSafeAreaInsets();
  const {
    novel,
    chapter,
    paragraphHighlightOffset,
    adjustHighlightOffset,
    resetHighlightOffset,
  } = useChapterContext();
  const readerSheetRef = useRef<BottomSheetModalMethods>(null);
  const theme = useTheme();
  const { pageReader = false, keepScreenOn } = useChapterGeneralSettings();
  const [bookmarked, setBookmarked] = useState(chapter.bookmark);

  useEffect(() => {
    setBookmarked(chapter.bookmark);
  }, [chapter]);

  const { hidden, loading, error, webViewRef, hideHeader, refetch } =
    useChapterContext();

  // ── In-chapter search state ──────────────────────────────────────────
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchResult, setSearchResult] = useState<ReaderSearchResult>(
    EMPTY_READER_SEARCH_RESULT,
  );
  const searchQueryRef = useRef('');

  const handleSearch = useCallback(
    (query: string) => {
      searchQueryRef.current = query;
      webViewRef?.current?.injectJavaScript(
        `window.readerSearch.search(${JSON.stringify(query)}); true;`,
      );
    },
    [webViewRef],
  );

  const handleSearchNext = useCallback(() => {
    webViewRef?.current?.injectJavaScript(
      `window.readerSearch.next(${JSON.stringify(searchQueryRef.current)}); true;`,
    );
  }, [webViewRef]);

  const handleSearchPrevious = useCallback(() => {
    webViewRef?.current?.injectJavaScript(
      `window.readerSearch.previous(${JSON.stringify(searchQueryRef.current)}); true;`,
    );
  }, [webViewRef]);

  const handleClearSearch = useCallback(() => {
    searchQueryRef.current = '';
    setSearchResult(EMPTY_READER_SEARCH_RESULT);
    webViewRef?.current?.injectJavaScript('window.readerSearch.clear(); true;');
  }, [webViewRef]);

  const handleToggleSearch = useCallback(() => {
    setSearchVisible(prev => {
      if (prev) {
        handleClearSearch();
      }
      return !prev;
    });
  }, [handleClearSearch]);

  const handleCloseSearch = useCallback(() => {
    setSearchVisible(false);
    handleClearSearch();
  }, [handleClearSearch]);

  // Clear search on chapter change
  useEffect(() => {
    handleClearSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.id]);

  // ── Back handler: search takes priority over drawer ──────────────────
  useBackHandler(() => {
    if (searchVisible) {
      handleCloseSearch();
      return true;
    }
    return false;
  });

  const scrollToStart = () =>
    requestAnimationFrame(() => {
      webViewRef?.current?.injectJavaScript(
        !pageReader
          ? `(()=>{
                window.scrollTo({top:0,behavior:'smooth'})
              })()`
          : `(()=>{
              document.querySelector('chapter').setAttribute('data-page',0);
              document.querySelector("chapter").style.transform = 'translate(0%)';
            })()`,
      );
    });

  const openDrawerI = useCallback(() => {
    openDrawer();
    hideHeader();
  }, [hideHeader, openDrawer]);

  if (error) {
    return (
      <ErrorScreenV2
        error={error}
        actions={[
          {
            iconName: 'refresh',
            title: getString('common.retry'),
            onPress: refetch,
          },
          {
            iconName: 'earth',
            title: 'WebView',
            onPress: () =>
              navigation.navigate('WebviewScreen', {
                name: novel.name,
                url: chapter.path,
                pluginId: novel.pluginId,
              }),
          },
        ]}
      />
    );
  }
  return (
    <View
      style={[{ paddingLeft: left, paddingRight: right }, styles.container]}
    >
      {keepScreenOn ? <KeepScreenAwake /> : null}
      {loading ? (
        <ChapterLoadingScreen />
      ) : (
        <WebViewReader
          onPress={hideHeader}
          onSearchResult={setSearchResult}
          searchQuery={searchResult.query}
        />
      )}
      <ReaderBottomSheetV2
        bottomSheetRef={readerSheetRef}
        novel={novel}
        paragraphHighlightOffset={paragraphHighlightOffset}
        adjustHighlightOffset={adjustHighlightOffset}
        resetHighlightOffset={resetHighlightOffset}
      />
      {!hidden && (
        <>
          {searchVisible ? (
            <ReaderSearchbar
              theme={theme}
              searchResult={searchResult}
              onSearch={handleSearch}
              onNext={handleSearchNext}
              onPrevious={handleSearchPrevious}
              onClose={handleCloseSearch}
            />
          ) : (
            <ReaderAppbar
              goBack={navigation.goBack}
              theme={theme}
              bookmarked={bookmarked}
              setBookmarked={setBookmarked}
              searchVisible={searchVisible}
              onToggleSearch={handleToggleSearch}
            />
          )}
          {!searchVisible && (
            <ReaderFooter
              readerSheetRef={readerSheetRef}
              scrollToStart={scrollToStart}
              navigation={navigation}
              openDrawer={openDrawerI}
            />
          )}
        </>
      )}
    </View>
  );
};

export default Chapter;

const styles = StyleSheet.create({
  container: { flex: 1 },
  drawer: { backgroundColor: 'transparent' },
});
