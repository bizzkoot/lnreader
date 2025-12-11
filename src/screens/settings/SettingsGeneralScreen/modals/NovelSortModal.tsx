import React from 'react';
import { StyleSheet } from 'react-native';
import AppText from '@components/AppText';

import { Portal } from 'react-native-paper';

import {
  LibrarySortOrder,
  librarySortOrderList,
} from '@screens/library/constants/constants';

import { ThemeColors } from '@theme/types';
import { SortItem } from '@components/Checkbox/Checkbox';
import { useLibrarySettings, useAppSettings } from '@hooks/persisted';
import { getString } from '@strings/translations';
import { Modal } from '@components';
import { scaleDimension } from '@theme/scaling';

interface NovelSortModalProps {
  novelSortModalVisible: boolean;
  hideNovelSortModal: () => void;
  theme: ThemeColors;
}

const NovelSortModal: React.FC<NovelSortModalProps> = ({
  novelSortModalVisible,
  hideNovelSortModal,
  theme,
}) => {
  const { sortOrder = LibrarySortOrder.DateAdded_DESC, setLibrarySettings } =
    useLibrarySettings();
  const { uiScale = 1.0 } = useAppSettings();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        modalDescription: {
          fontSize: scaleDimension(16, uiScale),
          marginBottom: 16,
          paddingHorizontal: 24,
        },
        modalHeader: {
          fontSize: scaleDimension(24, uiScale),
          marginBottom: 10,
          paddingHorizontal: 24,
        },
        slider: {
          height: 40,
          width: '100%',
        },
      }),
    [uiScale],
  );

  return (
    <Portal>
      <Modal visible={novelSortModalVisible} onDismiss={hideNovelSortModal}>
        <AppText style={[styles.modalHeader, { color: theme.onSurface }]}>
          {getString('generalSettingsScreen.sortOrder')}
        </AppText>
        {librarySortOrderList.map(item => (
          <SortItem
            key={item.ASC}
            label={item.label}
            theme={theme}
            status={
              sortOrder === item.ASC
                ? 'asc'
                : sortOrder === item.DESC
                  ? 'desc'
                  : undefined
            }
            onPress={() =>
              setLibrarySettings({
                sortOrder: sortOrder === item.ASC ? item.DESC : item.ASC,
              })
            }
          />
        ))}
      </Modal>
    </Portal>
  );
};

export default NovelSortModal;
