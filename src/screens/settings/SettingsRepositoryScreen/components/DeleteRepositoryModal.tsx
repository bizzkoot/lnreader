import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Portal } from 'react-native-paper';

import { Button, Modal } from '@components/index';
import AppText from '@components/AppText';

import { Repository } from '@database/types';
import { deleteRepositoryById } from '@database/queries/RepositoryQueries';
import { useAppSettings, useTheme } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

import { getString } from '@strings/translations';

interface DeleteRepositoryModalProps {
  repository: Repository;
  visible: boolean;
  closeModal: () => void;
  onSuccess: () => void | Promise<void>;
}

const DeleteRepositoryModal: React.FC<DeleteRepositoryModalProps> = ({
  repository,
  closeModal,
  visible,
  onSuccess,
}) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        btnContainer: {
          flexDirection: 'row-reverse',
          marginTop: scaleDimension(24, uiScale),
        },
        modalDesc: {},
        modalTitle: {
          fontSize: scaleDimension(24, uiScale),
          marginBottom: scaleDimension(16, uiScale),
        },
      }),
    [uiScale],
  );

  return (
    <Portal>
      <Modal visible={visible} onDismiss={closeModal}>
        <AppText style={[styles.modalTitle, { color: theme.onSurface }]}>
          {getString('repositories.deleteTitle')}
        </AppText>
        <AppText style={[styles.modalDesc, { color: theme.onSurfaceVariant }]}>
          {getString('repositories.deleteDescription', {
            url: repository.url,
          })}
        </AppText>
        <View style={styles.btnContainer}>
          <Button
            title={getString('common.ok')}
            onPress={async () => {
              try {
                deleteRepositoryById(repository.id);
                await onSuccess();
                closeModal();
              } catch {
                closeModal();
              }
            }}
          />
          <Button title={getString('common.cancel')} onPress={closeModal} />
        </View>
      </Modal>
    </Portal>
  );
};

export default DeleteRepositoryModal;
