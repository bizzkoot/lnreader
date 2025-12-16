import React, { useState, useMemo } from 'react';
import {
  useTheme,
  useLocalBackupFolder,
  useAppSettings,
} from '@hooks/persisted';
import { Appbar, List, SafeAreaView, Modal } from '@components';
import { useBoolean } from '@hooks';
import { BackupSettingsScreenProps } from '@navigators/types';
import GoogleDriveModal from './Components/GoogleDriveModal';
import SelfHostModal from './Components/SelfHostModal';
import ServiceManager from '@services/ServiceManager';
import { ScrollView } from 'react-native-gesture-handler';
import { getString } from '@strings/translations';
import { StyleSheet, Pressable, View, Text } from 'react-native';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { showToast } from '@utils/showToast';
import { Portal, RadioButton } from 'react-native-paper';
import Button from '@components/Button/Button';

type BackupFrequency = 'manual' | '6h' | '12h' | 'daily' | '2days' | 'weekly';

const frequencyOptions: { value: BackupFrequency; label: string }[] = [
  { value: 'manual', label: 'backupScreen.backupFrequencyManual' },
  { value: '6h', label: 'backupScreen.backupFrequency6h' },
  { value: '12h', label: 'backupScreen.backupFrequency12h' },
  { value: 'daily', label: 'backupScreen.backupFrequencyDaily' },
  { value: '2days', label: 'backupScreen.backupFrequency2days' },
  { value: 'weekly', label: 'backupScreen.backupFrequencyWeekly' },
];

const maxBackupsOptions = [1, 2, 3, 4, 5] as const;

const BackupSettings = ({ navigation }: BackupSettingsScreenProps) => {
  const theme = useTheme();
  const { folderUri, setFolderUri, folderName, clearFolder } =
    useLocalBackupFolder();
  const {
    autoBackupFrequency = 'manual',
    maxAutoBackups = 2,
    setAppSettings,
  } = useAppSettings();

  const [frequencyModalVisible, setFrequencyModalVisible] = useState(false);
  const [maxBackupsModalVisible, setMaxBackupsModalVisible] = useState(false);

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

  const getFrequencyLabel = (freq: BackupFrequency) => {
    const option = frequencyOptions.find(o => o.value === freq);
    return option ? getString(option.label as any) : freq;
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        paddingBottom: { paddingBottom: 40 },
        modalContent: {
          padding: 16,
        },
        modalTitle: {
          fontSize: 18,
          fontWeight: 'bold',
          marginBottom: 16,
          color: theme.onSurface,
        },
        radioRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 8,
        },
        radioLabel: {
          fontSize: 16,
          color: theme.onSurface,
          marginLeft: 8,
        },
        buttonContainer: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          marginTop: 16,
        },
      }),
    [theme],
  );

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

          {/* Automatic Backups Section */}
          <List.SubHeader theme={theme}>
            {getString('backupScreen.automaticBackups')}
          </List.SubHeader>
          <List.Item
            title={getString('backupScreen.backupFrequency')}
            description={getFrequencyLabel(autoBackupFrequency)}
            theme={theme}
            onPress={() => setFrequencyModalVisible(true)}
          />
          <List.Item
            title={getString('backupScreen.maxAutoBackups')}
            description={`${maxAutoBackups}`}
            theme={theme}
            onPress={() => setMaxBackupsModalVisible(true)}
          />
          <List.InfoItem
            title={getString('backupScreen.autoBackupWarning')}
            theme={theme}
          />

          <List.Divider theme={theme} />
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

      {/* Frequency Picker Modal */}
      <Portal>
        <Modal
          visible={frequencyModalVisible}
          onDismiss={() => setFrequencyModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {getString('backupScreen.backupFrequency')}
            </Text>
            <RadioButton.Group
              value={autoBackupFrequency}
              onValueChange={value => {
                setAppSettings({
                  autoBackupFrequency: value as BackupFrequency,
                });
                setFrequencyModalVisible(false);
              }}
            >
              {frequencyOptions.map(option => (
                <Pressable
                  key={option.value}
                  style={styles.radioRow}
                  onPress={() => {
                    setAppSettings({ autoBackupFrequency: option.value });
                    setFrequencyModalVisible(false);
                  }}
                >
                  <RadioButton value={option.value} color={theme.primary} />
                  <Text style={styles.radioLabel}>
                    {getString(option.label as any)}
                  </Text>
                </Pressable>
              ))}
            </RadioButton.Group>
            <View style={styles.buttonContainer}>
              <Button
                title={getString('common.cancel')}
                onPress={() => setFrequencyModalVisible(false)}
              />
            </View>
          </View>
        </Modal>
      </Portal>

      {/* Max Backups Picker Modal */}
      <Portal>
        <Modal
          visible={maxBackupsModalVisible}
          onDismiss={() => setMaxBackupsModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {getString('backupScreen.maxAutoBackups')}
            </Text>
            <RadioButton.Group
              value={String(maxAutoBackups)}
              onValueChange={value => {
                setAppSettings({
                  maxAutoBackups: Number(value) as 1 | 2 | 3 | 4 | 5,
                });
                setMaxBackupsModalVisible(false);
              }}
            >
              {maxBackupsOptions.map(num => (
                <Pressable
                  key={num}
                  style={styles.radioRow}
                  onPress={() => {
                    setAppSettings({ maxAutoBackups: num });
                    setMaxBackupsModalVisible(false);
                  }}
                >
                  <RadioButton value={String(num)} color={theme.primary} />
                  <Text style={styles.radioLabel}>{num}</Text>
                </Pressable>
              ))}
            </RadioButton.Group>
            <View style={styles.buttonContainer}>
              <Button
                title={getString('common.cancel')}
                onPress={() => setMaxBackupsModalVisible(false)}
              />
            </View>
          </View>
        </Modal>
      </Portal>

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
