import React, { useState } from 'react';
import { StyleSheet, View, TextInput } from 'react-native';

import { Button, IconButton, Portal } from 'react-native-paper';
import { ThemeColors } from '@theme/types';
import { ChapterInfo, NovelInfo } from '@database/types';
import { getString } from '@strings/translations';
import { Modal } from '@components';
import { useScaledDimensions } from '@hooks/useScaledDimensions';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import AppText from '@components/AppText';

interface DownloadCustomChapterModalProps {
  theme: ThemeColors;
  hideModal: () => void;
  modalVisible: boolean;
  novel: NovelInfo;
  chapters: ChapterInfo[];
  downloadChapters: (novel: NovelInfo, chapters: ChapterInfo[]) => void;
}

const DownloadCustomChapterModal = ({
  theme,
  hideModal,
  modalVisible,
  novel,
  chapters,
  downloadChapters,
}: DownloadCustomChapterModalProps) => {
  const { iconSize } = useScaledDimensions();
  const [text, setText] = useState(0);

  const onDismiss = () => {
    hideModal();
    setText(0);
  };

  const onSubmit = () => {
    hideModal();
    downloadChapters(
      novel,
      chapters
        .filter(chapter => chapter.unread && !chapter.isDownloaded)
        .slice(0, text),
    );
  };

  const onChangeText = (txt: string) => {
    if (Number(txt) >= 0) {
      setText(Number(txt));
    }
  };

  const { uiScale = 1.0 } = useAppSettings();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        errorText: {
          color: '#FF0033',
          paddingTop: 8,
        },
        modalTitle: {
          fontSize: scaleDimension(16, uiScale),
          marginBottom: 16,
        },
        row: { flexDirection: 'row', justifyContent: 'center' },
        marginHorizontal: { marginHorizontal: 4 },
      }),
    [uiScale],
  );

  return (
    <Portal>
      <Modal visible={modalVisible} onDismiss={onDismiss}>
        <AppText style={[styles.modalTitle, { color: theme.onSurface }]}>
          {getString('novelScreen.download.customAmount')}
        </AppText>
        <View style={styles.row}>
          <IconButton
            icon="chevron-double-left"
            animated
            size={iconSize.md}
            iconColor={theme.primary}
            onPress={() => text > 9 && setText(prevState => prevState - 10)}
          />
          <IconButton
            icon="chevron-left"
            animated
            size={iconSize.md}
            iconColor={theme.primary}
            onPress={() => text > 0 && setText(prevState => prevState - 1)}
          />
          <TextInput
            value={text.toString()}
            style={[
              { color: theme.onSurface, fontSize: scaleDimension(14, uiScale) },
              styles.marginHorizontal,
            ]}
            keyboardType="numeric"
            onChangeText={onChangeText}
            onSubmitEditing={onSubmit}
          />
          <IconButton
            icon="chevron-right"
            animated
            size={iconSize.md}
            iconColor={theme.primary}
            onPress={() => setText(prevState => prevState + 1)}
          />
          <IconButton
            icon="chevron-double-right"
            animated
            size={iconSize.md}
            iconColor={theme.primary}
            onPress={() => setText(prevState => prevState + 10)}
          />
        </View>
        <Button
          onPress={onSubmit}
          textColor={theme.onPrimary}
          buttonColor={theme.primary}
        >
          {getString('libraryScreen.bottomSheet.display.download')}
        </Button>
      </Modal>
    </Portal>
  );
};

export default DownloadCustomChapterModal;
