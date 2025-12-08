import React from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';
import { ThemeColors } from '@theme/types';
import Button from '@components/Button/Button';

interface TTSSyncInfo {
  chapterName: string;
  paragraphIndex: number;
  totalParagraphs: number;
  progress: number; // 0-100
}

interface TTSSyncDialogProps {
  visible: boolean;
  theme: ThemeColors;
  status: 'syncing' | 'success' | 'failed';
  syncInfo?: TTSSyncInfo;
  onDismiss: () => void;
  onRetry?: () => void;
}

const TTSSyncDialog: React.FC<TTSSyncDialogProps> = ({
  visible,
  theme,
  status,
  syncInfo,
  onDismiss,
  onRetry,
}) => {
  const getTitle = () => {
    switch (status) {
      case 'syncing':
        return 'Syncing TTS Position';
      case 'success':
        return 'TTS Synced';
      case 'failed':
        return 'Sync Failed';
    }
  };

  const getContent = () => {
    switch (status) {
      case 'syncing':
        return (
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text
              style={[styles.loadingText, { color: theme.onSurfaceVariant }]}
            >
              Navigating to the correct chapter...
            </Text>
          </View>
        );
      case 'success':
        return syncInfo ? (
          <View style={styles.infoContent}>
            <Text style={[styles.successText, { color: theme.primary }]}>
              ✓ Successfully synced!
            </Text>
            <Text style={[styles.infoText, { color: theme.onSurface }]}>
              Resuming at paragraph {syncInfo.paragraphIndex + 1}
            </Text>
          </View>
        ) : null;
      case 'failed':
        return syncInfo ? (
          <View style={styles.infoContent}>
            <Text style={[styles.errorText, { color: theme.error }]}>
              Failed to resume TTS at the correct position.
            </Text>
            <View style={styles.detailsContainer}>
              <Text
                style={[styles.detailLabel, { color: theme.onSurfaceVariant }]}
              >
                Expected Chapter:
              </Text>
              <Text
                style={[styles.detailValue, { color: theme.onSurface }]}
                numberOfLines={2}
              >
                {syncInfo.chapterName}
              </Text>

              <Text
                style={[styles.detailLabel, { color: theme.onSurfaceVariant }]}
              >
                Paragraph:
              </Text>
              <Text style={[styles.detailValue, { color: theme.onSurface }]}>
                {syncInfo.paragraphIndex + 1} of {syncInfo.totalParagraphs}
              </Text>

              <Text
                style={[styles.detailLabel, { color: theme.onSurfaceVariant }]}
              >
                Progress:
              </Text>
              <Text style={[styles.detailValue, { color: theme.onSurface }]}>
                {syncInfo.progress.toFixed(1)}%
              </Text>
            </View>
            <Text style={[styles.hintText, { color: theme.onSurfaceVariant }]}>
              Please navigate to this chapter manually and restart TTS.
            </Text>
          </View>
        ) : (
          <Text style={[styles.errorText, { color: theme.error }]}>
            Failed to resume TTS. Please try again.
          </Text>
        );
    }
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={status !== 'syncing' ? onDismiss : undefined}
        dismissable={status !== 'syncing'}
        style={[styles.container, { backgroundColor: theme.overlay3 }]}
      >
        <Dialog.Title style={{ color: theme.onSurface }}>
          {getTitle()}
        </Dialog.Title>
        <Dialog.Content>{getContent()}</Dialog.Content>
        {status !== 'syncing' && (
          <View style={styles.buttonCtn}>
            {status === 'failed' && onRetry && (
              <Button
                onPress={onRetry}
                title="Retry"
                icon="refresh"
                mode="outlined"
              />
            )}
            <Button
              onPress={onDismiss}
              title="Dismiss"
              mode={status === 'failed' ? 'text' : 'contained'}
            />
          </View>
        )}
      </Dialog>
    </Portal>
  );
};

export default TTSSyncDialog;

const styles = StyleSheet.create({
  container: {
    borderRadius: 28,
    shadowColor: 'transparent',
  },
  loadingContent: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    textAlign: 'center',
  },
  infoContent: {
    gap: 12,
  },
  successText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    textAlign: 'center',
  },
  detailsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  hintText: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  buttonCtn: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    gap: 12,
  },
});
