import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { FAB, Portal } from 'react-native-paper';

import { Appbar, EmptyView, SafeAreaView } from '@components';

import {
  createRepository,
  getRepositoriesFromDb,
  isRepoUrlDuplicated,
  setRepositoryEnabled,
  updateRepository,
} from '@database/queries/RepositoryQueries';
import { Repository } from '@database/types';
import { useBoolean } from '@hooks/index';
import { usePlugins, useTheme } from '@hooks/persisted';
import { getString } from '@strings/translations';

import AddRepositoryModal from './components/AddRepositoryModal';
import RepositoryCard from './components/RepositoryCard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RespositorySettingsScreenProps } from '@navigators/types';
import { showToast } from '@utils/showToast';

const SettingsBrowseScreen = ({
  route: { params },
  navigation,
}: RespositorySettingsScreenProps) => {
  const theme = useTheme();
  const { bottom, right } = useSafeAreaInsets();
  const { refreshPlugins } = usePlugins();

  const [repositories, setRepositories] = useState<Repository[]>(
    getRepositoriesFromDb(),
  );
  const getRepositories = useCallback(() => {
    setRepositories(getRepositoriesFromDb());
  }, []);

  const handleRepositoryDeleted = useCallback(async () => {
    getRepositories();
    try {
      await refreshPlugins({ clearUnavailableUpdates: true });
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  }, [getRepositories, refreshPlugins]);

  const {
    value: addRepositoryModalVisible,
    setTrue: showAddRepositoryModal,
    setFalse: closeAddRepositoryModal,
  } = useBoolean();

  const upsertRepository = useCallback(
    (repositoryUrl: string, repository?: Repository) => {
      if (
        !new RegExp(/^https:\/\/(.*)plugins\.min\.json$/).test(repositoryUrl)
      ) {
        showToast(getString('repositories.invalidUrl'));
        return;
      }

      if (isRepoUrlDuplicated(repositoryUrl, repository?.id)) {
        showToast(getString('repositories.duplicateUrl'));
      } else {
        if (repository) {
          updateRepository(repository.id, repositoryUrl);
        } else {
          createRepository(repositoryUrl);
        }
        getRepositories();
        refreshPlugins().catch(error => {
          showToast(error instanceof Error ? error.message : String(error));
        });
      }
    },
    [getRepositories, refreshPlugins],
  );

  const toggleRepository = useCallback(
    async (repository: Repository) => {
      try {
        setRepositoryEnabled(repository.id, !repository.enabled);
        getRepositories();
        await refreshPlugins({
          clearUnavailableUpdates: repository.enabled,
        });
      } catch (error) {
        showToast(error instanceof Error ? error.message : String(error));
      }
    },
    [getRepositories, refreshPlugins],
  );

  useEffect(() => {
    if (params?.url) {
      upsertRepository(params.url);
    }
  }, [params, upsertRepository]);

  return (
    <SafeAreaView>
      <Appbar
        title={getString('repositories.title')}
        handleGoBack={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }}
        theme={theme}
      />

      <FlatList
        data={repositories}
        contentContainerStyle={styles.contentCtn}
        renderItem={({ item }) => (
          <RepositoryCard
            repository={item}
            refetchRepositories={handleRepositoryDeleted}
            toggleRepository={toggleRepository}
            upsertRepository={upsertRepository}
          />
        )}
        ListEmptyComponent={
          <EmptyView
            icon="Σ(ಠ_ಠ)"
            description={getString('repositories.emptyMsg')}
            theme={theme}
          />
        }
      />
      <FAB
        style={[styles.fab, { backgroundColor: theme.primary, right, bottom }]}
        color={theme.onPrimary}
        label={getString('common.add')}
        uppercase={false}
        onPress={showAddRepositoryModal}
        icon={'plus'}
      />
      <Portal>
        <AddRepositoryModal
          visible={addRepositoryModalVisible}
          closeModal={closeAddRepositoryModal}
          upsertRepository={upsertRepository}
        />
      </Portal>
    </SafeAreaView>
  );
};

export default SettingsBrowseScreen;

const styles = StyleSheet.create({
  contentCtn: {
    flexGrow: 1,
    paddingBottom: 100,
    paddingVertical: 16,
  },
  fab: {
    margin: 16,
    position: 'absolute',
    right: 0,
  },
});
