import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Portal, ProgressBar } from 'react-native-paper';
import * as Linking from 'expo-linking';
import { ScrollView } from 'react-native-gesture-handler';
import Button from './Button/Button';
import { getString } from '@strings/translations';
import { useTheme, useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import { Modal } from '@components';
import {
  downloadAndInstallApk,
  DownloadProgress,
} from '@services/updates/downloadUpdate';

interface NewUpdateDialogProps {
  newVersion: {
    tag_name: string;
    body: string;
    downloadUrl: string;
  };
}

type DialogState =
  | { status: 'idle' }
  | { status: 'downloading'; progress: DownloadProgress }
  | { status: 'installing' }
  | { status: 'error'; message: string };

const NewUpdateDialog: React.FC<NewUpdateDialogProps> = ({ newVersion }) => {
  const [visible, setVisible] = useState(true);
  const [state, setState] = useState<DialogState>({ status: 'idle' });

  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();
  const styles = React.useMemo(() => createStyles(uiScale), [uiScale]);
  const modalHeight = Dimensions.get('window').height / 2;

  const handleDownload = useCallback(async () => {
    try {
      setState({
        status: 'downloading',
        progress: {
          totalBytesWritten: 0,
          totalBytesExpectedToWrite: 0,
          percentage: 0,
        },
      });

      await downloadAndInstallApk(newVersion.downloadUrl, progress => {
        setState({ status: 'downloading', progress });
      });

      setState({ status: 'installing' });
      // Dialog stays visible briefly then closes after install intent is launched
      setTimeout(() => setVisible(false), 1000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Download failed';
      setState({ status: 'error', message });
    }
  }, [newVersion.downloadUrl]);

  const handleViewOnGithub = useCallback(() => {
    // Open the releases page that contains this version
    const releaseUrl = `https://github.com/bizzkoot/lnreader/releases/tag/${newVersion.tag_name}`;
    Linking.openURL(releaseUrl);
  }, [newVersion.tag_name]);

  const handleDismiss = useCallback(() => {
    if (state.status !== 'downloading') {
      setVisible(false);
    }
  }, [state.status]);

  const renderContent = () => {
    switch (state.status) {
      case 'downloading':
        return (
          <View style={styles.progressContainer}>
            <Text style={[styles.progressText, { color: theme.onSurface }]}>
              {getString('common.downloading')}... {state.progress.percentage}%
            </Text>
            <ProgressBar
              progress={state.progress.percentage / 100}
              color={theme.primary}
              style={styles.progressBar}
            />
            <Text
              style={[styles.progressDetail, { color: theme.onSurfaceVariant }]}
            >
              {formatBytes(state.progress.totalBytesWritten)} /{' '}
              {formatBytes(state.progress.totalBytesExpectedToWrite)}
            </Text>
          </View>
        );

      case 'installing':
        return (
          <View style={styles.progressContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.progressText, { color: theme.onSurface }]}>
              {getString('common.installing')}...
            </Text>
          </View>
        );

      case 'error':
        return (
          <View style={styles.progressContainer}>
            <Text style={[styles.errorText, { color: theme.error }]}>
              {state.message}
            </Text>
            <Text
              style={[styles.progressDetail, { color: theme.onSurfaceVariant }]}
            >
              Try downloading from GitHub instead.
            </Text>
          </View>
        );

      default:
        return (
          <ScrollView style={[styles.scrollView, { height: modalHeight }]}>
            <Text style={[styles.body, { color: theme.onSurfaceVariant }]}>
              {newVersion.body.split('\n').join('\n\n')}
            </Text>
          </ScrollView>
        );
    }
  };

  const renderButtons = () => {
    if (state.status === 'downloading' || state.status === 'installing') {
      return null; // No buttons while downloading/installing
    }

    if (state.status === 'error') {
      return (
        <View style={styles.buttonCtn}>
          <Button title={getString('common.cancel')} onPress={handleDismiss} />
          <Button
            title={getString('common.viewOnGithub')}
            onPress={handleViewOnGithub}
          />
        </View>
      );
    }

    return (
      <View style={styles.buttonCtn}>
        <Button title={getString('common.later')} onPress={handleDismiss} />
        <Button
          title={getString('common.viewOnGithub')}
          onPress={handleViewOnGithub}
        />
        <Button
          title={getString('common.downloadAndInstall')}
          onPress={handleDownload}
          mode="contained"
        />
      </View>
    );
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={handleDismiss}>
        <Text style={[styles.modalHeader, { color: theme.onSurface }]}>
          {`${getString('common.newUpdateAvailable')} ${newVersion.tag_name}`}
        </Text>
        {renderContent()}
        {renderButtons()}
      </Modal>
    </Portal>
  );
};

/**
 * Format bytes to human readable string
 */
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export default NewUpdateDialog;

const createStyles = (uiScale: number) =>
  StyleSheet.create({
    body: {
      fontSize: scaleDimension(15, uiScale),
      fontWeight: '500',
    },
    buttonCtn: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 16,
      flexWrap: 'wrap',
      gap: 8,
    },
    modalHeader: {
      fontSize: scaleDimension(20, uiScale),
      fontWeight: 'bold',
      marginBottom: 16,
    },
    progressContainer: {
      paddingVertical: 32,
      alignItems: 'center',
    },
    progressText: {
      fontSize: scaleDimension(16, uiScale),
      fontWeight: '600',
      marginBottom: 16,
    },
    scrollView: {
      height: 200, // Default height that will be overridden
    },
    progressBar: {
      width: '100%',
      height: 8,
      borderRadius: 4,
    },
    progressDetail: {
      fontSize: scaleDimension(13, uiScale),
      marginTop: 8,
    },
    errorText: {
      fontSize: scaleDimension(15, uiScale),
      fontWeight: '500',
      textAlign: 'center',
    },
  });
