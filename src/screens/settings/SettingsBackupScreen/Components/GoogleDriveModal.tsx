import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ThemeColors } from '@theme/types';
import { StyleSheet, View, Image } from 'react-native';
import AppText from '@components/AppText';
import { Portal, TextInput } from 'react-native-paper';
import { GoogleSignin, User } from '@react-native-google-signin/google-signin';
import { Button, EmptyView, Modal } from '@components';
import { FlatList, TouchableOpacity } from 'react-native-gesture-handler';
import * as Clipboard from 'expo-clipboard';
import { showToast } from '@utils/showToast';
import { getString } from '@strings/translations';
import { exists, getBackups, makeDir } from '@api/drive';
import { DriveFile } from '@api/drive/types';
import dayjs from 'dayjs';
import ServiceManager from '@services/ServiceManager';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import { createRateLimitedLogger } from '@utils/rateLimitedLogger';

const driveModalLog = createRateLimitedLogger('GoogleDriveModal', {
  windowMs: 1500,
});
enum BackupModal {
  UNAUTHORIZED,
  AUTHORIZED,
  CREATE_BACKUP,
  RESTORE_BACKUP,
}

function Authorized({
  theme,
  setBackupModal,
  setUser,
  styles,
}: {
  theme: ThemeColors;
  setBackupModal: (backupModal: BackupModal) => void;
  setUser: (user?: User) => void;
  styles: GoogleDriveStyles;
}) {
  const signOut = () => {
    GoogleSignin.signOut()
      .then(() => {
        setUser();
        setBackupModal(BackupModal.UNAUTHORIZED);
      })
      .catch(err => {
        driveModalLog.error(
          'signout-failed',
          'Failed to sign out from Google',
          err,
        );
        setUser();
        setBackupModal(BackupModal.UNAUTHORIZED);
      });
  };
  return (
    <>
      <Button
        title={getString('common.backup')}
        style={[styles.btnOutline, { borderColor: theme.outline }]}
        onPress={() => setBackupModal(BackupModal.CREATE_BACKUP)}
      />
      <Button
        title={getString('common.restore')}
        style={[styles.btnOutline, { borderColor: theme.outline }]}
        onPress={() => setBackupModal(BackupModal.RESTORE_BACKUP)}
      />
      <Button
        title={getString('common.signOut')}
        style={[styles.btnOutline, { borderColor: theme.outline }]}
        onPress={signOut}
      />
    </>
  );
}

function UnAuthorized({
  theme,
  setBackupModal,
  setUser,
  styles,
}: {
  theme: ThemeColors;
  setBackupModal: (backupModal: BackupModal) => void;
  setUser: (user?: User | null) => void;
  styles: GoogleDriveStyles;
}) {
  const signIn = () => {
    GoogleSignin.hasPlayServices()
      .then(hasPlayServices => {
        if (hasPlayServices) {
          return GoogleSignin.signIn();
        }
      })
      .then(response => {
        setUser(response?.data);
        setBackupModal(BackupModal.AUTHORIZED);
      })
      .catch(err => {
        driveModalLog.error(
          'signin-failed',
          'Failed to sign in to Google',
          err,
        );
        showToast('Failed to sign in to Google');
      });
  };
  return (
    <Button
      title={getString('common.signIn')}
      style={[styles.btnOutline, { borderColor: theme.outline }]}
      onPress={signIn}
    />
  );
}

function CreateBackup({
  theme,
  setBackupModal,
  closeModal,
  styles,
}: {
  theme: ThemeColors;
  setBackupModal: (backupModal: BackupModal) => void;
  closeModal: () => void;
  styles: GoogleDriveStyles;
}) {
  const [backupName, setBackupName] = useState('');
  const [fetching, setFetching] = useState(false);

  const prepare = async () => {
    setFetching(true);
    let rootFolder = await exists('LNReader', true, undefined, true);
    if (!rootFolder) {
      rootFolder = await makeDir('LNReader');
    }
    const backupFolderName = backupName.trim() + '.backup';
    let backupFolder = await exists(backupFolderName, true, rootFolder.id);
    if (!backupFolder) {
      backupFolder = await makeDir(backupFolderName, rootFolder.id);
    }
    setFetching(false);
    return backupFolder;
  };

  return (
    <>
      <TextInput
        value={backupName}
        placeholder={getString('backupScreen.backupName')}
        onChangeText={setBackupName}
        mode="outlined"
        underlineColor={theme.outline}
        theme={{ colors: { ...theme } }}
        placeholderTextColor={theme.onSurfaceDisabled}
        disabled={fetching}
      />
      <View style={styles.footerContainer}>
        <Button
          disabled={backupName.trim().length === 0 || fetching}
          title={getString('common.ok')}
          onPress={() => {
            prepare()
              .then(folder => {
                closeModal();
                ServiceManager.manager.addTask({
                  name: 'DRIVE_BACKUP',
                  data: folder,
                });
              })
              .catch(err => {
                driveModalLog.error(
                  'prepare-backup-failed',
                  'Failed to prepare backup folder',
                  err,
                );
                showToast('Failed to prepare backup folder');
              });
          }}
        />
        <Button
          title={getString('common.cancel')}
          onPress={() => setBackupModal(BackupModal.AUTHORIZED)}
        />
      </View>
    </>
  );
}

function RestoreBackup({
  theme,
  setBackupModal,
  closeModal,
  styles,
}: {
  theme: ThemeColors;
  setBackupModal: (backupModal: BackupModal) => void;
  closeModal: () => void;
  styles: GoogleDriveStyles;
}) {
  const [backupList, setBackupList] = useState<DriveFile[]>([]);
  useEffect(() => {
    exists('LNReader', true, undefined, true)
      .then(rootFolder => {
        if (rootFolder) {
          return getBackups(rootFolder.id, true);
        }
        return [];
      })
      .then(backups => setBackupList(backups))
      .catch(err => {
        driveModalLog.error(
          'load-backups-failed',
          'Failed to load backup list',
          err,
        );
      });
  }, []);

  const emptyComponent = useCallback(() => {
    return (
      <EmptyView
        description={getString('backupScreen.noBackupFound')}
        theme={theme}
      />
    );
  }, [theme]);

  return (
    <>
      <FlatList
        contentContainerStyle={styles.backupList}
        data={backupList}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <Button
            mode="outlined"
            style={styles.btnOutline}
            onPress={() => {
              closeModal();
              ServiceManager.manager.addTask({
                name: 'DRIVE_RESTORE',
                data: item,
              });
            }}
          >
            <AppText style={{ color: theme.primary }}>
              {item.name?.replace(/\.backup$/, ' ')}
            </AppText>
            <AppText style={[{ color: theme.secondary }, styles.fontSize]}>
              {'(' + dayjs(item.createdTime).format('LL') + ')'}
            </AppText>
          </Button>
        )}
        ListEmptyComponent={emptyComponent}
      />
      <View style={styles.footerContainer}>
        <Button
          title={getString('common.cancel')}
          onPress={() => setBackupModal(BackupModal.AUTHORIZED)}
        />
      </View>
    </>
  );
}

interface GoogleDriveModalProps {
  visible: boolean;
  theme: ThemeColors;
  closeModal: () => void;
}

interface GoogleDriveStyles {
  avatar: object;
  backupList: object;
  btnOutline: object;
  error: object;
  footerContainer: object;
  loadingContent: object;
  modalTitle: object;
  titleContainer: object;
  fontSize: object;
}

export default function GoogleDriveModal({
  visible,
  theme,
  closeModal,
}: GoogleDriveModalProps) {
  const [backupModal, setBackupModal] = useState(BackupModal.UNAUTHORIZED);
  const [user, setUser] = useState<User | null | undefined>(null);
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        avatar: {
          borderRadius: scaleDimension(40, uiScale),
          height: scaleDimension(40, uiScale),
          width: scaleDimension(40, uiScale),
        },
        backupList: {
          flexGrow: 1,
          paddingBottom: scaleDimension(8, uiScale),
          paddingHorizontal: scaleDimension(4, uiScale),
        },
        btnOutline: {
          borderWidth: 1,
          marginVertical: scaleDimension(4, uiScale),
        },
        error: {
          fontSize: scaleDimension(16, uiScale),
          marginTop: scaleDimension(8, uiScale),
        },
        footerContainer: {
          flexDirection: 'row-reverse',
          marginTop: scaleDimension(24, uiScale),
        },
        loadingContent: {
          borderRadius: scaleDimension(16, uiScale),
          width: '100%',
        },
        modalTitle: {
          fontSize: scaleDimension(24, uiScale),
        },
        titleContainer: {
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: scaleDimension(16, uiScale),
          textAlignVertical: 'center',
        },
        fontSize: { fontSize: scaleDimension(12, uiScale) },
      }),
    [uiScale],
  );

  useEffect(() => {
    GoogleSignin.configure({
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    const isSignedIn = GoogleSignin.hasPreviousSignIn();
    if (isSignedIn) {
      const localUser = GoogleSignin.getCurrentUser();
      if (localUser) {
        setUser(localUser);
        setBackupModal(BackupModal.AUTHORIZED);
      }
    } else {
      setBackupModal(BackupModal.UNAUTHORIZED);
    }
  }, []);

  const renderModal = () => {
    switch (backupModal) {
      case BackupModal.AUTHORIZED:
        return (
          <Authorized
            theme={theme}
            setBackupModal={setBackupModal}
            setUser={setUser}
            styles={styles}
          />
        );
      case BackupModal.UNAUTHORIZED:
        return (
          <UnAuthorized
            theme={theme}
            setBackupModal={setBackupModal}
            setUser={setUser}
            styles={styles}
          />
        );
      case BackupModal.CREATE_BACKUP:
        return (
          <CreateBackup
            theme={theme}
            setBackupModal={setBackupModal}
            closeModal={closeModal}
            styles={styles}
          />
        );
      case BackupModal.RESTORE_BACKUP:
        return (
          <RestoreBackup
            theme={theme}
            setBackupModal={setBackupModal}
            closeModal={closeModal}
            styles={styles}
          />
        );
    }
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={closeModal}>
        <>
          <View style={styles.titleContainer}>
            <AppText style={[styles.modalTitle, { color: theme.onSurface }]}>
              {getString('backupScreen.drive.googleDriveBackup')}
            </AppText>
            <TouchableOpacity
              onLongPress={() => {
                if (user?.user.email) {
                  Clipboard.setStringAsync(user.user.email)
                    .then(success => {
                      if (success) {
                        showToast(
                          getString('common.copiedToClipboard', {
                            name: user.user.email,
                          }),
                        );
                      }
                    })
                    .catch(err => {
                      driveModalLog.error(
                        'copy-email-failed',
                        'Failed to copy email to clipboard',
                        err,
                      );
                    });
                }
              }}
            >
              {user ? (
                <Image
                  source={{ uri: user?.user.photo || '' }}
                  style={styles.avatar}
                />
              ) : null}
            </TouchableOpacity>
          </View>
          {renderModal()}
        </>
      </Modal>
    </Portal>
  );
}
