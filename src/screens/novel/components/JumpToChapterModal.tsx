import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  TextInput as RNTextInput,
} from 'react-native';
import { getString } from '@strings/translations';
import { Button, Modal, SwitchItem } from '@components';

import { Portal } from 'react-native-paper';
import { useTheme, useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import { ChapterInfo, NovelInfo } from '@database/types';
import { NovelScreenProps } from '@navigators/types';
import {
  LegendList,
  LegendListRef,
  LegendListRenderItemProps,
} from '@legendapp/list';
import {
  getNovelChaptersByNumber,
  getNovelChaptersByName,
} from '@database/queries/ChapterQueries';
import { useScaledDimensions } from '@hooks/useScaledDimensions';
import AppText from '@components/AppText';

interface JumpToChapterModalProps {
  hideModal: () => void;
  modalVisible: boolean;
  navigation: NovelScreenProps['navigation'];
  novel: NovelInfo;
  chapters: ChapterInfo[];
  chapterListRef: React.RefObject<LegendListRef | null>;
  loadUpToBatch: (batch: number) => Promise<void>;
  totalChapters?: number;
}

const JumpToChapterModal = ({
  hideModal,
  modalVisible,
  chapters: loadedChapters,
  navigation,
  novel,
  chapterListRef,
  loadUpToBatch,
  totalChapters,
}: JumpToChapterModalProps) => {
  const minNumber = 1;
  const maxNumber = totalChapters ?? -1;
  const theme = useTheme();
  const { iconSize } = useScaledDimensions();
  const [mode, setMode] = useState(false);
  const [openChapter, setOpenChapter] = useState(false);

  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<ChapterInfo[]>([]);

  const inputRef = useRef<RNTextInput>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const { uiScale = 1.0 } = useAppSettings();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        dateCtn: {
          fontSize: scaleDimension(12, uiScale),
          marginTop: scaleDimension(2, uiScale),
        },
        errorText: {
          paddingTop: scaleDimension(12, uiScale),
        },
        flashlist: {
          borderBottomWidth: 1,
          borderTopWidth: 1,
          height: scaleDimension(300, uiScale),
          marginTop: scaleDimension(8, uiScale),
        },
        listContentCtn: {
          paddingVertical: scaleDimension(8, uiScale),
        },
        listElementContainer: {
          paddingVertical: scaleDimension(12, uiScale),
        },
        modalFooterCtn: {
          flexDirection: 'row-reverse',
          paddingTop: scaleDimension(8, uiScale),
        },
        modalTitle: {
          fontSize: scaleDimension(24, uiScale),
          marginBottom: scaleDimension(16, uiScale),
        },
        textInput: {
          borderRadius: scaleDimension(4, uiScale),
          borderStyle: 'solid',
          fontSize: scaleDimension(16, uiScale),
          paddingHorizontal: scaleDimension(16, uiScale),
          paddingVertical: scaleDimension(10, uiScale),
        },
      }),
    [uiScale],
  );

  const onDismiss = () => {
    hideModal();
    setText('');
    inputRef.current?.clear();
    inputRef.current?.blur();
    setInputFocused(false);
    setError('');
    setResult([]);
  };
  const navigateToChapter = (chap: ChapterInfo) => {
    onDismiss();
    navigation.navigate('Chapter', {
      novel: novel,
      chapter: chap,
    });
  };

  const scrollToChapter = async (chap: ChapterInfo) => {
    onDismiss();
    const loadedIndex = loadedChapters.findIndex(c => c.id === chap.id);

    if (loadedIndex >= 0) {
      chapterListRef.current?.scrollToIndex({
        animated: true,
        index: loadedIndex,
        viewPosition: 0.5,
      });
      return;
    }

    if ((chap.position ?? -1) >= 0) {
      const targetBatch = Math.floor(chap.position! / 300);
      await loadUpToBatch(targetBatch);
      setTimeout(() => {
        chapterListRef.current?.scrollToIndex({
          animated: true,
          index: chap.position!,
          viewPosition: 0.5,
        });
      }, 0);
    }
  };

  const executeFunction = (item: ChapterInfo) => {
    if (openChapter) {
      navigateToChapter(item);
    } else {
      scrollToChapter(item);
    }
  };

  const renderItem = ({ item }: LegendListRenderItemProps<ChapterInfo>) => {
    return (
      <Pressable
        android_ripple={{ color: theme.rippleColor }}
        onPress={() => executeFunction(item)}
        style={styles.listElementContainer}
      >
        <AppText
          numberOfLines={1}
          style={{
            color: theme.onSurface,
            fontSize: scaleDimension(14, uiScale),
          }}
        >
          {item.name}
        </AppText>
        {item?.releaseTime ? (
          <AppText
            numberOfLines={1}
            style={[{ color: theme.onSurfaceVariant }, styles.dateCtn]}
          >
            {item.releaseTime}
          </AppText>
        ) : null}
      </Pressable>
    );
  };

  const onSubmit = async () => {
    if (!mode) {
      const num = Number(text);
      if (num && num >= minNumber && num <= maxNumber) {
        const chapters = await getNovelChaptersByNumber(novel.id, num);
        if (chapters.length > 0) {
          const chapter = chapters[0];
          if (openChapter) {
            return navigateToChapter(chapter);
          }
          return scrollToChapter(chapter);
        }
      }
      return setError(
        getString('novelScreen.jumpToChapterModal.error.validChapterNumber') +
          ` (${num < minNumber ? '≥ ' + minNumber : '≤ ' + maxNumber})`,
      );
    } else {
      const chapters = await getNovelChaptersByName(
        novel.id,
        text.toLowerCase(),
      );

      if (!chapters.length) {
        setError(
          getString('novelScreen.jumpToChapterModal.error.validChapterName'),
        );
        return;
      }

      if (chapters.length === 1) {
        if (openChapter) {
          return navigateToChapter(chapters[0]);
        }
        return scrollToChapter(chapters[0]);
      }

      return setResult(chapters);
    }
  };

  const onChangeText = (txt: string) => {
    setText(txt);
    setResult([]);
  };

  const errorColor = !theme.isDark ? '#B3261E' : '#F2B8B5';
  const placeholder = mode
    ? getString('novelScreen.jumpToChapterModal.chapterName')
    : getString('novelScreen.jumpToChapterModal.chapterNumber') +
      ` (≥ ${minNumber},  ≤ ${maxNumber})`;

  const borderWidth = inputFocused || error ? 2 : 1;
  const margin = inputFocused || error ? 0 : 1;
  return (
    <Portal>
      <Modal visible={modalVisible} onDismiss={onDismiss}>
        <View>
          <AppText style={[styles.modalTitle, { color: theme.onSurface }]}>
            {getString('novelScreen.jumpToChapterModal.jumpToChapter')}
          </AppText>
          <RNTextInput
            ref={inputRef}
            placeholder={placeholder}
            placeholderTextColor={'grey'}
            onChangeText={onChangeText}
            onSubmitEditing={onSubmit}
            keyboardType={mode ? 'default' : 'numeric'}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            style={[
              {
                color: theme.onBackground,
                backgroundColor: theme.background,
                borderColor: error
                  ? theme.error
                  : inputFocused
                    ? theme.primary
                    : theme.outline,
                borderWidth: borderWidth,
                margin: margin,
              },
              styles.textInput,
            ]}
          />
          {!!error && (
            <AppText
              style={[
                styles.errorText,
                { color: errorColor, fontSize: scaleDimension(12, uiScale) },
              ]}
            >
              {error}
            </AppText>
          )}
          <SwitchItem
            label={getString('novelScreen.jumpToChapterModal.openChapter')}
            value={openChapter}
            theme={theme}
            onPress={() => setOpenChapter(!openChapter)}
            size={iconSize.sm}
          />
          <SwitchItem
            label={getString('novelScreen.jumpToChapterModal.chapterName')}
            value={mode}
            theme={theme}
            onPress={() => setMode(!mode)}
            size={iconSize.sm}
          />
        </View>
        {result.length ? (
          <View style={[styles.flashlist, { borderColor: theme.outline }]}>
            <LegendList
              recycleItems
              estimatedItemSize={scaleDimension(70, uiScale)}
              data={result}
              extraData={openChapter}
              renderItem={renderItem}
              keyExtractor={item => `chapter_${item.id}`}
              contentContainerStyle={styles.listContentCtn}
            />
          </View>
        ) : null}
        <View style={styles.modalFooterCtn}>
          <Button title={getString('common.submit')} onPress={onSubmit} />
          <Button title={getString('common.cancel')} onPress={hideModal} />
        </View>
      </Modal>
    </Portal>
  );
};

export default JumpToChapterModal;
