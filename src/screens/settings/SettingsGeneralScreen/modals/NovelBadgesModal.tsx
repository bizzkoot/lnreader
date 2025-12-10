import React from 'react';
import { Text, StyleSheet } from 'react-native';

import { Portal } from 'react-native-paper';

import { Checkbox, Modal } from '@components';
import { getString } from '@strings/translations';
import { ThemeColors } from '@theme/types';
import { useLibrarySettings, useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

interface NovelBadgesModalProps {
  novelBadgesModalVisible: boolean;
  hideNovelBadgesModal: () => void;
  theme: ThemeColors;
}

const NovelBadgesModal: React.FC<NovelBadgesModalProps> = ({
  novelBadgesModalVisible,
  hideNovelBadgesModal,
  theme,
}) => {
  const {
    showDownloadBadges = true,
    showNumberOfNovels = false,
    showUnreadBadges = true,
    setLibrarySettings,
  } = useLibrarySettings();
  const { uiScale = 1.0 } = useAppSettings();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        modalDescription: {
          fontSize: scaleDimension(16, uiScale),
          marginBottom: 16,
        },
        modalHeader: {
          fontSize: scaleDimension(24, uiScale),
          marginBottom: 10,
        },
      }),
    [uiScale],
  );

  return (
    <Portal>
      <Modal visible={novelBadgesModalVisible} onDismiss={hideNovelBadgesModal}>
        <Text style={[styles.modalHeader, { color: theme.onSurface }]}>
          {getString('libraryScreen.bottomSheet.display.badges')}
        </Text>
        <Checkbox
          label={getString('libraryScreen.bottomSheet.display.downloadBadges')}
          status={showDownloadBadges}
          onPress={() =>
            setLibrarySettings({
              showDownloadBadges: !showDownloadBadges,
            })
          }
          theme={theme}
          labelStyle={{ fontSize: scaleDimension(16, uiScale) }}
        />
        <Checkbox
          label={getString('libraryScreen.bottomSheet.display.unreadBadges')}
          status={showUnreadBadges}
          onPress={() =>
            setLibrarySettings({
              showUnreadBadges: !showUnreadBadges,
            })
          }
          theme={theme}
          labelStyle={{ fontSize: scaleDimension(16, uiScale) }}
        />
        <Checkbox
          label={getString('libraryScreen.bottomSheet.display.showNoOfItems')}
          status={showNumberOfNovels}
          onPress={() =>
            setLibrarySettings({
              showNumberOfNovels: !showNumberOfNovels,
            })
          }
          theme={theme}
          labelStyle={{ fontSize: scaleDimension(16, uiScale) }}
        />
      </Modal>
    </Portal>
  );
};

export default NovelBadgesModal;
