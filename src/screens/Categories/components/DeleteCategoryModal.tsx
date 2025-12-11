import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Portal } from 'react-native-paper';
import AppText from '@components/AppText';

import { Button, Modal } from '@components/index';

import { Category } from '@database/types';
import { deleteCategoryById } from '@database/queries/CategoryQueries';
import { useTheme, useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

import { getString } from '@strings/translations';

interface DeleteCategoryModalProps {
  category: Category;
  visible: boolean;
  closeModal: () => void;
  onSuccess: () => Promise<void>;
}

const DeleteCategoryModal: React.FC<DeleteCategoryModalProps> = ({
  category,
  closeModal,
  visible,
  onSuccess,
}) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        btnContainer: {
          flexDirection: 'row-reverse',
          marginTop: 24,
        },
        modalDesc: {
          fontSize: scaleDimension(16, uiScale),
        },
        modalTitle: {
          fontSize: scaleDimension(24, uiScale),
          marginBottom: 16,
        },
      }),
    [uiScale],
  );

  return (
    <Portal>
      <Modal visible={visible} onDismiss={closeModal}>
        <AppText style={[styles.modalTitle, { color: theme.onSurface }]}>
          {getString('categories.deleteModal.header')}
        </AppText>
        <AppText style={[styles.modalDesc, { color: theme.onSurfaceVariant }]}>
          {getString('categories.deleteModal.desc')}
          {` "${category.name}"?`}
        </AppText>
        <View style={styles.btnContainer}>
          <Button
            title={getString('common.ok')}
            onPress={() => {
              deleteCategoryById(category);
              closeModal();
              onSuccess();
            }}
          />
          <Button title={getString('common.cancel')} onPress={closeModal} />
        </View>
      </Modal>
    </Portal>
  );
};

export default DeleteCategoryModal;
