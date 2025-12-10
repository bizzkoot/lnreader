import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Portal, TextInput } from 'react-native-paper';

import { Button, Modal } from '@components/index';

import { Category } from '../../../database/types';
import {
  createCategory,
  isCategoryNameDuplicate,
  updateCategory,
} from '../../../database/queries/CategoryQueries';
import { useTheme, useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

import { getString } from '@strings/translations';
import { showToast } from '@utils/showToast';

interface AddCategoryModalProps {
  isEditMode?: boolean;
  category?: Category;
  visible: boolean;
  closeModal: () => void;
  onSuccess: () => void;
}

const AddCategoryModal: React.FC<AddCategoryModalProps> = ({
  isEditMode,
  category,
  closeModal,
  visible,
  onSuccess,
}) => {
  const theme = useTheme();
  const [categoryName, setCategoryName] = useState(category?.name || '');

  function close() {
    setCategoryName('');
    closeModal();
  }
  function finalize() {
    onSuccess();
    close();
  }

  const { uiScale = 1.0 } = useAppSettings();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        btnContainer: {
          flexDirection: 'row-reverse',
          marginTop: 24,
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
      <Modal visible={visible} onDismiss={close}>
        <Text style={[styles.modalTitle, { color: theme.onSurface }]}>
          {getString(
            isEditMode
              ? 'categories.editCategories'
              : 'categories.addCategories',
          )}
        </Text>
        <TextInput
          autoFocus
          defaultValue={categoryName}
          placeholder={getString('common.name')}
          onChangeText={setCategoryName}
          mode="outlined"
          underlineColor={theme.outline}
          theme={{ colors: { ...theme } }}
          style={{ fontSize: scaleDimension(16, uiScale) }}
        />
        <View style={styles.btnContainer}>
          <Button
            title={getString(isEditMode ? 'common.ok' : 'common.add')}
            onPress={async () => {
              if (isCategoryNameDuplicate(categoryName)) {
                showToast(getString('categories.duplicateError'));
              } else {
                if (isEditMode && category) {
                  updateCategory(category?.id, categoryName);
                } else {
                  createCategory(categoryName);
                }
                finalize();
              }
            }}
          />
          <Button title={getString('common.cancel')} onPress={close} />
        </View>
      </Modal>
    </Portal>
  );
};

export default AddCategoryModal;
