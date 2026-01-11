import React, {
  createContext,
  useContext,
  useMemo,
  useRef,
  useCallback,
  useState,
  useEffect,
} from 'react';
import { ChapterInfo, NovelInfo } from '@database/types';
import WebView from 'react-native-webview';
import useChapter from './hooks/useChapter';

type ChapterContextType = ReturnType<typeof useChapter> & {
  novel: NovelInfo;
  webViewRef: React.RefObject<WebView<{}> | null>;
  savedParagraphIndex?: number;
  // Paragraph highlight offset (ephemeral, chapter-scoped)
  paragraphHighlightOffsetRef: React.MutableRefObject<number>;
  paragraphHighlightOffset: number;
  adjustHighlightOffset: (delta: number) => void;
  resetHighlightOffset: () => void;
};

const defaultValue = {} as ChapterContextType;

const ChapterContext = createContext<ChapterContextType>(defaultValue);

export function ChapterContextProvider({
  children,
  novel,
  initialChapter,
}: {
  children: React.JSX.Element;
  novel: NovelInfo;
  initialChapter: ChapterInfo;
}) {
  const webViewRef = useRef<WebView>(null);
  const chapterHookContent = useChapter(webViewRef, initialChapter, novel);

  // Paragraph highlight offset state (ephemeral, resets on chapter change)
  const paragraphHighlightOffsetRef = useRef<number>(0);
  const [paragraphHighlightOffset, setParagraphHighlightOffset] = useState(0);

  // Reset offset when chapter changes
  useEffect(() => {
    paragraphHighlightOffsetRef.current = 0;
    setParagraphHighlightOffset(0);
  }, [chapterHookContent.chapter.id]);

  const adjustHighlightOffset = useCallback((delta: number) => {
    paragraphHighlightOffsetRef.current += delta;
    // Clamp to reasonable range (-10 to +10)
    paragraphHighlightOffsetRef.current = Math.max(
      -10,
      Math.min(10, paragraphHighlightOffsetRef.current),
    );
    setParagraphHighlightOffset(paragraphHighlightOffsetRef.current);
  }, []);

  const resetHighlightOffset = useCallback(() => {
    paragraphHighlightOffsetRef.current = 0;
    setParagraphHighlightOffset(0);
  }, []);

  const contextValue = useMemo(
    () => ({
      novel,
      webViewRef,
      ...chapterHookContent,
      paragraphHighlightOffsetRef,
      paragraphHighlightOffset,
      adjustHighlightOffset,
      resetHighlightOffset,
    }),
    [
      novel,
      webViewRef,
      chapterHookContent,
      paragraphHighlightOffset,
      adjustHighlightOffset,
      resetHighlightOffset,
    ],
  );

  return (
    <ChapterContext.Provider value={contextValue}>
      {children}
    </ChapterContext.Provider>
  );
}

export const useChapterContext = () => {
  return useContext(ChapterContext);
};
