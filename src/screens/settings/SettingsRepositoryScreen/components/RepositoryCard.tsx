import React, { FC } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';

import { ConfirmationDialog, IconButtonV2 } from '@components';
import Switch from '@components/Switch/Switch';
import AppText from '@components/AppText';

import { Repository } from '@database/types';
import { useBoolean } from '@hooks/index';
import { useAppSettings, useTheme } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import { showToast } from '@utils/showToast';
import { getString } from '@strings/translations';
import { Portal } from 'react-native-paper';
import AddRepositoryModal from './AddRepositoryModal';
import DeleteRepositoryModal from './DeleteRepositoryModal';

interface RepositoryCardProps {
  repository: Repository;
  refetchRepositories: () => void;
  toggleRepository: (repository: Repository) => void | Promise<void>;
  upsertRepository: (repositoryUrl: string, repository?: Repository) => void;
}

const RepositoryCard: FC<RepositoryCardProps> = ({
  repository,
  refetchRepositories,
  toggleRepository,
  upsertRepository,
}) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();
  const repositoryName = `${repository.url.split('/')?.[3]}/${
    repository.url.split('/')?.[4]
  }`;

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        buttonsCtn: {
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'flex-end',
        },
        cardCtn: {
          borderRadius: 12,
          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
          marginBottom: scaleDimension(8, uiScale),
          marginHorizontal: scaleDimension(16, uiScale),
          paddingHorizontal: scaleDimension(8, uiScale),
          paddingVertical: scaleDimension(8, uiScale),
        },
        headerCtn: {
          alignItems: 'center',
          flexDirection: 'row',
        },
        manageBtn: {
          marginLeft: scaleDimension(8, uiScale),
        },
        name: {
          fontSize: scaleDimension(16, uiScale),
          fontWeight: '500',
          marginHorizontal: scaleDimension(16, uiScale),
        },
        nameCtn: {
          alignItems: 'center',
          flex: 1,
          flexDirection: 'row',
          marginLeft: scaleDimension(8, uiScale),
          paddingRight: scaleDimension(16, uiScale),
          paddingVertical: scaleDimension(4, uiScale),
        },
        switchCtn: {
          marginRight: scaleDimension(8, uiScale),
        },
      }),
    [uiScale],
  );

  const {
    value: repositoryModalVisible,
    setTrue: showRepositoryModal,
    setFalse: closeRepositoryModal,
  } = useBoolean();

  const {
    value: deleteRepositoryModalVisible,
    setTrue: showDeleteRepositoryModal,
    setFalse: closeDeleteRepositoryModal,
  } = useBoolean();

  const {
    value: disableRepositoryModalVisible,
    setTrue: showDisableRepositoryModal,
    setFalse: closeDisableRepositoryModal,
  } = useBoolean();

  const onToggleRepository = () => {
    if (repository.enabled) {
      showDisableRepositoryModal();
    } else {
      toggleRepository(repository);
    }
  };

  return (
    <View
      style={[
        styles.cardCtn,
        {
          backgroundColor: theme.secondaryContainer,
        },
      ]}
    >
      <View style={styles.headerCtn}>
        <View style={styles.nameCtn}>
          <IconButtonV2
            name="label-outline"
            color={theme.onSurface}
            padding={0}
            theme={theme}
          />
          <AppText
            style={[styles.name, { color: theme.onSurface }]}
            onPress={showRepositoryModal}
          >
            {repositoryName}
          </AppText>
        </View>
        <Switch
          accessibilityLabel={getString('repositories.toggle', {
            name: repositoryName,
          })}
          containerStyle={styles.switchCtn}
          value={repository.enabled}
          onValueChange={onToggleRepository}
        />
      </View>
      <View style={styles.buttonsCtn}>
        <IconButtonV2
          name="open-in-new"
          color={theme.onSurface}
          onPress={() => Linking.openURL(repository.url)}
          theme={theme}
        />
        <IconButtonV2
          name="content-copy"
          color={theme.onSurface}
          style={styles.manageBtn}
          onPress={() =>
            Clipboard.setStringAsync(repository.url).then(() => {
              showToast(getString('common.copiedToClipboard', { name: '' }));
            })
          }
          theme={theme}
        />
        <IconButtonV2
          name="delete-outline"
          color={theme.onSurface}
          style={styles.manageBtn}
          onPress={showDeleteRepositoryModal}
          theme={theme}
        />
      </View>
      <Portal>
        <AddRepositoryModal
          repository={repository}
          visible={repositoryModalVisible}
          closeModal={closeRepositoryModal}
          upsertRepository={upsertRepository}
        />
        <DeleteRepositoryModal
          repository={repository}
          visible={deleteRepositoryModalVisible}
          closeModal={closeDeleteRepositoryModal}
          onSuccess={refetchRepositories}
        />
        <ConfirmationDialog
          title={getString('repositories.disableTitle')}
          message={getString('repositories.disableWarning', {
            name: repositoryName,
          })}
          visible={disableRepositoryModalVisible}
          theme={theme}
          onSubmit={() => toggleRepository(repository)}
          onDismiss={closeDisableRepositoryModal}
        />
      </Portal>
    </View>
  );
};

export default RepositoryCard;
