import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Portal, TextInput } from 'react-native-paper';

import { Button, Modal } from '@components/index';

import { Repository } from '@database/types';
import { useAppSettings, useTheme } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

import { getString } from '@strings/translations';

interface AddRepositoryModalProps {
  repository?: Repository;
  visible: boolean;
  closeModal: () => void;
  upsertRepository: (repositoryUrl: string, repository?: Repository) => void;
}

const AddRepositoryModal: React.FC<AddRepositoryModalProps> = ({
  repository,
  closeModal,
  visible,
  upsertRepository,
}) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();
  const [repositoryUrl, setRepositoryUrl] = useState(repository?.url || '');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        btnContainer: {
          flexDirection: 'row-reverse',
          marginTop: scaleDimension(24, uiScale),
        },
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
        <Text style={[styles.modalTitle, { color: theme.onSurface }]}>
          {repository ? 'Edit repository' : 'Add repository'}
        </Text>
        <TextInput
          autoFocus
          defaultValue={repositoryUrl}
          placeholder={'Repo URL'}
          onChangeText={setRepositoryUrl}
          mode="outlined"
          underlineColor={theme.outline}
          theme={{ colors: { ...theme } }}
        />
        <View style={styles.btnContainer}>
          <Button
            title={getString(repository ? 'common.ok' : 'common.add')}
            onPress={() => {
              upsertRepository(repositoryUrl, repository);
              closeModal();
            }}
          />
          <Button title={getString('common.cancel')} onPress={closeModal} />
        </View>
      </Modal>
    </Portal>
  );
};

export default AddRepositoryModal;
