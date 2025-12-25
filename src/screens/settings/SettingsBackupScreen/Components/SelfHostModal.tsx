import { list } from '@api/remote';
import { Button, EmptyView, Modal } from '@components';
import { useAppSettings } from '@hooks/persisted';
import { useSelfHost } from '@hooks/persisted/useSelfHost';
import ServiceManager from '@services/ServiceManager';
import { getString } from '@strings/translations';
import { scaleDimension } from '@theme/scaling';
import { ThemeColors } from '@theme/types';
import { fetchTimeout } from '@utils/fetch/fetch';
import { createRateLimitedLogger } from '@utils/rateLimitedLogger';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import AppText from '@components/AppText';
import { FlatList } from 'react-native-gesture-handler';
import { Portal, TextInput } from 'react-native-paper';

const selfHostModalLog = createRateLimitedLogger('SelfHostModal', {
  windowMs: 1500,
});

enum BackupModal {
  SET_HOST,
  CONNECTED,
  CREATE_BACKUP,
  RESTORE_BACKUP,
}

interface SelfHostModalProps {
  visible: boolean;
  theme: ThemeColors;
  closeModal: () => void;
}

interface SelfHostStyles {
  footerContainer: object;
  backupList: object;
  btnOutline: object;
  error: object;
}

function CreateBackup({
  host,
  theme,
  setBackupModal,
  closeModal,
  styles,
}: {
  host: string;
  theme: ThemeColors;
  setBackupModal: (backupModal: BackupModal) => void;
  closeModal: () => void;
  styles: SelfHostStyles;
}) {
  const [backupName, setBackupName] = useState('');

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
      />
      <View style={styles.footerContainer}>
        <Button
          disabled={backupName.trim().length === 0}
          title={getString('common.ok')}
          onPress={() => {
            closeModal();
            ServiceManager.manager.addTask({
              name: 'SELF_HOST_BACKUP',
              data: {
                host,
                backupFolder: backupName + '.backup',
              },
            });
          }}
        />
        <Button
          title={getString('common.cancel')}
          onPress={() => setBackupModal(BackupModal.CONNECTED)}
        />
      </View>
    </>
  );
}

function RestoreBackup({
  host,
  theme,
  setBackupModal,
  closeModal,
  styles,
}: {
  host: string;
  theme: ThemeColors;
  setBackupModal: (backupModal: BackupModal) => void;
  closeModal: () => void;
  styles: SelfHostStyles;
}) {
  const [backupList, setBackupList] = useState<string[]>([]);
  useEffect(() => {
    list(host)
      .then(items =>
        setBackupList(items.filter(item => item.endsWith('.backup'))),
      )
      .catch(err => {
        selfHostModalLog.error(
          'load-backups-failed',
          'Failed to load backup list',
          err,
        );
      });
  }, [host]);

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
        keyExtractor={(item, index) => item + '_' + index}
        renderItem={({ item }) => (
          <Button
            mode="outlined"
            style={styles.btnOutline}
            onPress={() => {
              closeModal();
              ServiceManager.manager.addTask({
                name: 'SELF_HOST_RESTORE',
                data: {
                  host,
                  backupFolder: item,
                },
              });
            }}
          >
            <AppText style={{ color: theme.primary }}>
              {item.replace(/\.backup$/, ' ')}
            </AppText>
          </Button>
        )}
        ListEmptyComponent={emptyComponent}
      />
      <View style={styles.footerContainer}>
        <Button
          title={getString('common.cancel')}
          onPress={() => setBackupModal(BackupModal.CONNECTED)}
        />
      </View>
    </>
  );
}

function SetHost({
  host,
  setHost,
  theme,
  setBackupModal,
  styles,
}: {
  host: string;
  setHost: (
    value:
      | string
      | ((current: string | undefined) => string | undefined)
      | undefined,
  ) => void;
  theme: ThemeColors;
  setBackupModal: (backupModal: BackupModal) => void;
  styles: SelfHostStyles;
}) {
  const [error, setError] = useState('');
  const [fetching, setFetching] = useState(false);
  return (
    <>
      <TextInput
        value={host}
        placeholder={getString('backupScreen.remote.host')}
        onChangeText={setHost}
        mode="outlined"
        underlineColor={theme.outline}
        theme={{ colors: { ...theme } }}
        placeholderTextColor={theme.onSurfaceDisabled}
        disabled={fetching}
      />
      {error ? (
        <AppText style={[styles.error, { color: theme.error }]}>
          {error}
        </AppText>
      ) : null}
      <View style={styles.footerContainer}>
        <Button
          disabled={host.trim().length === 0 || fetching}
          title={getString('common.ok')}
          onPress={() => {
            setError('');
            setFetching(true);
            fetchTimeout(host, {}, 2000)
              .then(res => res.json())
              .then(data => {
                if (data.name === 'LNReader') {
                  setBackupModal(BackupModal.CONNECTED);
                } else {
                  throw new Error(getString('backupScreen.remote.unknownHost'));
                }
              })
              .catch((e: unknown) => {
                const message = e instanceof Error ? e.message : String(e);
                setError(message);
              })
              .finally(() => {
                setFetching(false);
              });
          }}
        />
      </View>
    </>
  );
}

function Connected({
  theme,
  setBackupModal,
  styles,
}: {
  theme: ThemeColors;
  setBackupModal: (backupModal: BackupModal) => void;
  styles: SelfHostStyles;
}) {
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
        title={getString('common.cancel')}
        style={[styles.btnOutline, { borderColor: theme.outline }]}
        onPress={() => setBackupModal(BackupModal.SET_HOST)}
      />
    </>
  );
}

export default function SelfHostModal({
  visible,
  theme,
  closeModal,
}: SelfHostModalProps) {
  const [backupModal, setBackupModal] = useState(BackupModal.SET_HOST);
  const { host, setHost } = useSelfHost();
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
      }),
    [uiScale],
  );

  const renderModal = () => {
    switch (backupModal) {
      case BackupModal.SET_HOST:
        return (
          <SetHost
            host={host}
            setHost={setHost}
            theme={theme}
            setBackupModal={setBackupModal}
            styles={styles}
          />
        );
      case BackupModal.CONNECTED:
        return (
          <Connected
            theme={theme}
            setBackupModal={setBackupModal}
            styles={styles}
          />
        );
      case BackupModal.CREATE_BACKUP:
        return (
          <CreateBackup
            host={host}
            closeModal={closeModal}
            setBackupModal={setBackupModal}
            theme={theme}
            styles={styles}
          />
        );
      case BackupModal.RESTORE_BACKUP:
        return (
          <RestoreBackup
            host={host}
            closeModal={closeModal}
            setBackupModal={setBackupModal}
            theme={theme}
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
              {getString('backupScreen.remote.backup')}
            </AppText>
          </View>
          {renderModal()}
        </>
      </Modal>
    </Portal>
  );
}
