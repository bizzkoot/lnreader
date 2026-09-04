import React, {
  useRef,
  useCallback,
  useState,
  useEffect,
  useMemo,
} from 'react';
import {
  useAppSettings,
  useChapterGeneralSettings,
  useTheme,
} from '@hooks/persisted';

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
import { scaleDimension } from '@theme/scaling';
import { getString } from '@strings/translations';
import KeepScreenAwake from './components/KeepScreenAwake';
import { ChapterContextProvider, useChapterContext } from './ChapterContext';
import { useNovelContext } from '@screens/novel/NovelContext';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { useScaledDimensions } from '@hooks/useScaledDimensions';
import { useBackHandler } from '@hooks/index';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  const { bottom, left, right } = useSafeAreaInsets();
  const { statusBarHeight } = useNovelContext();
  const scaledDimensions = useScaledDimensions();
  const { uiScale = 1.0 } = useAppSettings();
  const {
    novel,
    chapter,
    paragraphHighlightOffset,
    adjustHighlightOffset,
    resetHighlightOffset,
  } = useChapterContext();
  const readerSheetRef = useRef<BottomSheetModalMethods>(null);
  const theme = useTheme();
  const {
    pageReader = false,
    keepScreenOn,
    searchReturnBehavior = 'countdown',
  } = useChapterGeneralSettings();
  const [bookmarked, setBookmarked] = useState(chapter.bookmark);

  useEffect(() => {
    setBookmarked(chapter.bookmark);
  }, [chapter]);

  const { hidden, setHidden, loading, error, webViewRef, hideHeader, refetch } =
    useChapterContext();

  // ── In-chapter search state ──────────────────────────────────────────
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchResult, setSearchResult] = useState<ReaderSearchResult>(
    EMPTY_READER_SEARCH_RESULT,
  );
  const searchQueryRef = useRef('');
  // Anchor-preservation + countdown return (5s). Search never mutates last-read while open.
  const [showReturnBanner, setShowReturnBanner] = useState(false);
  const [returnCountdown, setReturnCountdown] = useState(5);
  const returnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const returnBehaviorRef = useRef(searchReturnBehavior);
  useEffect(() => {
    returnBehaviorRef.current = searchReturnBehavior;
  }, [searchReturnBehavior]);

  const bannerStyles = useMemo(
    () =>
      StyleSheet.create({
        returnBanner: {
          position: 'absolute',
          bottom: Math.max(16, bottom + scaledDimensions.margin.sm),
          left: scaledDimensions.margin.md,
          right: scaledDimensions.margin.md,
          borderRadius: scaledDimensions.borderRadius.lg,
          borderWidth: 1,
          paddingHorizontal: scaledDimensions.padding.md,
          paddingVertical: scaledDimensions.padding.sm,
          elevation: 4,
          zIndex: 5,
        },
        returnBannerText: {
          fontSize: scaleDimension(14, uiScale),
          fontWeight: '500',
          marginBottom: scaledDimensions.margin.xs,
          textAlign: 'center',
        },
        returnBannerActions: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
        },
        returnBannerButton: {
          paddingHorizontal: scaledDimensions.padding.md,
          paddingVertical: scaledDimensions.padding.xs + 2,
          borderRadius: scaledDimensions.borderRadius.xl,
          minWidth: scaledDimensions.buttonHeight.lg * 2,
          alignItems: 'center',
          marginHorizontal: scaledDimensions.margin.xs,
        },
        returnBannerButtonText: {
          fontSize: scaleDimension(13, uiScale),
          fontWeight: '600',
        },
      }),
    [bottom, scaledDimensions, uiScale],
  );

  const clearReturnTimer = useCallback(() => {
    if (returnTimerRef.current) {
      clearInterval(returnTimerRef.current);
      returnTimerRef.current = null;
    }
  }, []);

  const dismissReturnBanner = useCallback(() => {
    clearReturnTimer();
    setShowReturnBanner(false);
    setReturnCountdown(5);
    // Clear anchor — user chose to stay where search left them.
    // Set a brief bypass so the immediate saveProgress is not dropped by the
    // isSearchActive gate (React state commitment is async).
    webViewRef?.current?.injectJavaScript(
      `(function(){
        try {
          window.__searchAnchorY = null;
          window.__searchAnchorPage = null;
          window.__searchAnchorPIdx = null;
          window.__isSearching = false;
          window.__searchSaveBypassUntil = Date.now() + 1500;
          if (window.reader && typeof window.reader.saveProgress === 'function') {
            window.reader.saveProgress();
          }
        } catch(e) {}
      })(); true;`,
    );
  }, [clearReturnTimer, webViewRef]);

  const executeReturnToAnchor = useCallback(() => {
    clearReturnTimer();
    setShowReturnBanner(false);
    setReturnCountdown(5);
    webViewRef?.current?.injectJavaScript(
      `(function(){
        try {
          var y = window.__searchAnchorY;
          var p = window.__searchAnchorPage;
          var isPage = !!(window.reader && window.reader.generalSettings && window.reader.generalSettings.val && window.reader.generalSettings.val.pageReader && window.pageReader && p != null);

          if (window.tts && window.tts.reading && window.tts.currentElement && typeof window.tts.scrollToElement === 'function') {
            // Priority 1: Only when TTS is actively reading; otherwise anchor (y/p) is authoritative.
            window.tts.scrollToElement(window.tts.currentElement);
          } else if (isPage) {
            // Priority 2: Paged reader mode
            window.pageReader.movePage(p);
          } else if (y != null) {
            // Priority 3: Scroll mode
            window.scrollTo({ top: y, behavior: 'smooth' });
          }
          window.__searchAnchorY = null;
          window.__searchAnchorPage = null;
          window.__searchAnchorPIdx = null;
          window.__isSearching = false;
          window.__searchSaveBypassUntil = 0;
        } catch(e) {}
      })(); true;`,
    );
  }, [clearReturnTimer, webViewRef]);

  // Countdown effect
  useEffect(() => {
    if (!showReturnBanner) return;
    returnTimerRef.current = setInterval(() => {
      setReturnCountdown(prev => {
        if (prev <= 1) {
          clearReturnTimer();
          executeReturnToAnchor();
          return 5;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearReturnTimer();
  }, [showReturnBanner, clearReturnTimer, executeReturnToAnchor]);

  // Cleanup timer on unmount / chapter change
  useEffect(() => {
    return () => clearReturnTimer();
  }, [clearReturnTimer]);
  useEffect(() => {
    dismissReturnBanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.id]);

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
    webViewRef?.current?.injectJavaScript(
      'try{window.readerSearch.clear();}catch(e){} true;',
    );
  }, [webViewRef]);

  const handleToggleSearch = useCallback(() => {
    setSearchVisible(prev => {
      const next = !prev;
      if (prev) {
        // Closing via toggle (same as handleCloseSearch but without banner — toggle is explicit dismiss)
        dismissReturnBanner();
        webViewRef?.current?.injectJavaScript(
          `(function(){
            try {
              window.__isSearching = false;
              window.__searchAnchorY = null;
              window.__searchAnchorPage = null;
              window.__searchAnchorPIdx = null;
            } catch(e) {}
          })(); true;`,
        );
        handleClearSearch();
      } else {
        // Opening: capture anchor before any search scroll mutates position
        webViewRef?.current?.injectJavaScript(
          `(function(){
            try {
              var y = window.scrollY || window.pageYOffset || (document.documentElement && document.documentElement.scrollTop) || (document.body && document.body.scrollTop) || 0;
              var p = (window.pageReader && window.pageReader.page) ? window.pageReader.page.val : null;
              var pIdx = (window.reader && typeof window.reader.getVisibleElementIndex === 'function') ? window.reader.getVisibleElementIndex() : -1;
              window.__searchAnchorY = y;
              window.__searchAnchorPage = p;
              window.__searchAnchorPIdx = pIdx;
              window.__isSearching = true;
            } catch(e) {}
          })(); true;`,
        );
        if (hidden) {
          setHidden(false);
          webViewRef?.current?.injectJavaScript(
            'reader.hidden.val = false; true;',
          );
        }
        clearReturnTimer();
        setShowReturnBanner(false);
        setReturnCountdown(5);
      }
      return next;
    });
  }, [
    handleClearSearch,
    hidden,
    setHidden,
    webViewRef,
    dismissReturnBanner,
    clearReturnTimer,
  ]);

  const handleCloseSearch = useCallback(() => {
    // Capture whether we had an anchor before clearing
    const behavior = returnBehaviorRef.current;
    webViewRef?.current?.injectJavaScript(
      'try{window.__isSearching=false;}catch(e){} true;',
    );
    setSearchVisible(false);
    handleClearSearch();
    if (behavior === 'stay') {
      dismissReturnBanner();
      return;
    }
    if (behavior === 'immediate') {
      executeReturnToAnchor();
      return;
    }
    // countdown (default): show banner, auto-return in 5s unless dismissed
    setReturnCountdown(5);
    setShowReturnBanner(true);
  }, [
    handleClearSearch,
    executeReturnToAnchor,
    dismissReturnBanner,
    webViewRef,
  ]);

  // Clear search on chapter change
  useEffect(() => {
    handleClearSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.id]);

  // ── Back handler: search & return banner take priority over drawer ───
  useBackHandler(() => {
    if (searchVisible) {
      handleCloseSearch();
      return true;
    }
    if (showReturnBanner) {
      dismissReturnBanner();
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
          isSearchActive={searchVisible || showReturnBanner}
        />
      )}
      <ReaderBottomSheetV2
        bottomSheetRef={readerSheetRef}
        novel={novel}
        paragraphHighlightOffset={paragraphHighlightOffset}
        adjustHighlightOffset={adjustHighlightOffset}
        resetHighlightOffset={resetHighlightOffset}
      />
      {searchVisible && (
        <ReaderSearchbar
          theme={theme}
          searchResult={searchResult}
          onSearch={handleSearch}
          onNext={handleSearchNext}
          onPrevious={handleSearchPrevious}
          onClose={handleCloseSearch}
          statusBarHeight={statusBarHeight}
        />
      )}
      {!hidden && !searchVisible && (
        <ReaderAppbar
          goBack={navigation.goBack}
          theme={theme}
          bookmarked={bookmarked}
          setBookmarked={setBookmarked}
          searchVisible={searchVisible}
          onToggleSearch={handleToggleSearch}
        />
      )}
      {!hidden && !searchVisible && (
        <ReaderFooter
          readerSheetRef={readerSheetRef}
          scrollToStart={scrollToStart}
          navigation={navigation}
          openDrawer={openDrawerI}
        />
      )}
      {showReturnBanner && (
        <View
          style={[
            bannerStyles.returnBanner,
            {
              backgroundColor: theme.surface,
              borderColor: theme.outline,
            },
          ]}
        >
          <Text
            style={[bannerStyles.returnBannerText, { color: theme.onSurface }]}
          >
            {getString('readerScreen.search.returnBannerCountdown', {
              seconds: returnCountdown,
            })}
          </Text>
          <View style={bannerStyles.returnBannerActions}>
            <Pressable
              onPress={executeReturnToAnchor}
              style={[
                bannerStyles.returnBannerButton,
                { backgroundColor: theme.primary },
              ]}
              accessibilityRole="button"
              accessibilityLabel={getString('readerScreen.search.returnNow')}
            >
              <Text
                style={[
                  bannerStyles.returnBannerButtonText,
                  { color: theme.onPrimary },
                ]}
              >
                {getString('readerScreen.search.returnNow')}
              </Text>
            </Pressable>
            <Pressable
              onPress={dismissReturnBanner}
              style={[
                bannerStyles.returnBannerButton,
                { backgroundColor: theme.surfaceVariant },
              ]}
              accessibilityRole="button"
              accessibilityLabel={getString('readerScreen.search.stayHere')}
            >
              <Text
                style={[
                  bannerStyles.returnBannerButtonText,
                  { color: theme.onSurfaceVariant },
                ]}
              >
                {getString('readerScreen.search.stayHere')}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
};

export default Chapter;

const styles = StyleSheet.create({
  container: { flex: 1 },
  drawer: { backgroundColor: 'transparent' },
});
