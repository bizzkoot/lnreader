import React from 'react';
import { useTheme, useLocalBackupFolder } from '@hooks/persisted';
import { Appbar, List, SafeAreaView } from '@components';
import { useBoolean } from '@hooks';
import { BackupSettingsScreenProps } from '@navigators/types';
import GoogleDriveModal from './Components/GoogleDriveModal';
import SelfHostModal from './Components/SelfHostModal';
import ServiceManager from '@services/ServiceManager';
import { ScrollView } from 'react-native-gesture-handler';
import { getString } from '@strings/translations';
import { StyleSheet, Pressable } from 'react-native';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { showToast } from '@utils/showToast';

const BackupSettings = ({ navigation }: BackupSettingsScreenProps) => {
  const theme = useTheme();
  const { folderUri, setFolderUri, folderName, clearFolder } =
    useLocalBackupFolder();

  const {
    value: googleDriveModalVisible,
    setFalse: closeGoogleDriveModal,
    setTrue: openGoogleDriveModal,
  } = useBoolean();

  const {
    value: selfHostModalVisible,
    setFalse: closeSelfHostModal,
    setTrue: openSelfHostModal,
  } = useBoolean();

  const selectDefaultBackupFolder = async () => {
    try {
      const permissions =
        await StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted) {
        setFolderUri(permissions.directoryUri);
        showToast(getString('backupScreen.folderSelected'));
      }
    } catch (error) {
      showToast(getString('backupScreen.folderSelectionFailed'));
    }
  };

  const handleLongPressClearFolder = () => {
    if (folderUri) {
      clearFolder();
      showToast(getString('backupScreen.folderCleared'));
    }
  };

  return (
    <SafeAreaView excludeTop>
      <Appbar
        title={getString('common.backup')}
        handleGoBack={() => navigation.goBack()}
        theme={theme}
      />
      <ScrollView style={styles.paddingBottom}>
        <List.Section>
          <List.SubHeader theme={theme}>
            {getString('backupScreen.remoteBackup')}
          </List.SubHeader>
          <List.Item
            title={getString('backupScreen.selfHost')}
            description={getString('backupScreen.selfHostDesc')}
            theme={theme}
            onPress={openSelfHostModal}
          />

          <List.Item
            title={getString('backupScreen.googeDrive')}
            description={getString('backupScreen.googeDriveDesc')}
            theme={theme}
            onPress={openGoogleDriveModal}
          />
          <List.SubHeader theme={theme}>
            {getString('backupScreen.localBackup')}
          </List.SubHeader>
          <Pressable
            onPress={selectDefaultBackupFolder}
            onLongPress={handleLongPressClearFolder}
            android_ripple={{ color: theme.rippleColor }}
          >
            <List.Item
              title={getString('backupScreen.defaultBackupFolder')}
              description={folderName || getString('backupScreen.notSet')}
              theme={theme}
            />
          </Pressable>
          <List.Item
            title={getString('backupScreen.createBackup')}
            description={getString('backupScreen.createBackupDesc')}
            onPress={() => {
              ServiceManager.manager.addTask({ name: 'LOCAL_BACKUP' });
            }}
            theme={theme}
          />
          <List.Item
            title={getString('backupScreen.restoreBackup')}
            description={getString('backupScreen.restoreBackupDesc')}
            onPress={() => {
              ServiceManager.manager.addTask({ name: 'LOCAL_RESTORE' });
            }}
            theme={theme}
          />
          <List.InfoItem
            title={getString('backupScreen.restoreLargeBackupsWarning')}
            theme={theme}
          />
          <List.InfoItem
            title={getString('backupScreen.createBackupWarning')}
            theme={theme}
          />
        </List.Section>
      </ScrollView>
      <GoogleDriveModal
        visible={googleDriveModalVisible}
        theme={theme}
        closeModal={closeGoogleDriveModal}
      />
      <SelfHostModal
        theme={theme}
        visible={selfHostModalVisible}
        closeModal={closeSelfHostModal}
      />
    </SafeAreaView>
  );
};

export default BackupSettings;

const styles = StyleSheet.create({
  paddingBottom: { paddingBottom: 40 },
});
