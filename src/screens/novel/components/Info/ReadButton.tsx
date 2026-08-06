import React from 'react';

import { Button } from '@components';
import { getString } from '@strings/translations';
import { ChapterInfo } from '@database/types';
import { useAppSettings } from '@hooks/persisted';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { StyleSheet } from 'react-native';

interface ReadButtonProps {
  chapters?: ChapterInfo[];
  firstUnreadChapter?: ChapterInfo;
  lastRead?: ChapterInfo;
  navigateToChapter: (chapter: ChapterInfo) => void;
}

const ReadButton = ({
  chapters,
  firstUnreadChapter,
  lastRead,
  navigateToChapter,
}: ReadButtonProps) => {
  const { useFabForContinueReading = false } = useAppSettings();

  // Fully-read novels have no unread chapter: fall back to the first chapter
  // of the list so the start-reading affordance is never lost.
  const targetChapter = lastRead ?? firstUnreadChapter ?? chapters?.[0];

  const navigateToTargetChapter = () => {
    if (targetChapter) {
      navigateToChapter(targetChapter);
    }
  };

  if (!useFabForContinueReading) {
    return targetChapter ? (
      <Animated.View entering={ZoomIn.duration(150)}>
        <Button
          title={
            lastRead
              ? `${getString('novelScreen.continueReading')} ${lastRead.name}`
              : getString('novelScreen.startReadingChapters', {
                  name: targetChapter.name,
                })
          }
          style={styles.margin}
          onPress={navigateToTargetChapter}
          mode="contained"
        />
      </Animated.View>
    ) : null;
  } else {
    return null;
  }
};

export default ReadButton;

const styles = StyleSheet.create({
  margin: { margin: 16 },
});
