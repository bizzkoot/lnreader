import React, { useMemo } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';
import { ThemeColors } from '@theme/types';
import Button from '@components/Button/Button';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

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
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          borderRadius: scaleDimension(28, uiScale),
          shadowColor: 'transparent',
        },
        loadingContent: {
          alignItems: 'center',
          paddingVertical: scaleDimension(16, uiScale),
          gap: scaleDimension(16, uiScale),
        },
        loadingText: {
          fontSize: scaleDimension(14, uiScale),
          textAlign: 'center',
        },
        infoContent: {
          gap: scaleDimension(12, uiScale),
        },
        successText: {
          fontSize: scaleDimension(16, uiScale),
          fontWeight: '600',
          textAlign: 'center',
        },
        errorText: {
          fontSize: scaleDimension(14, uiScale),
          marginBottom: scaleDimension(8, uiScale),
        },
        infoText: {
          fontSize: scaleDimension(14, uiScale),
          textAlign: 'center',
        },
        detailsContainer: {
          backgroundColor: 'rgba(0, 0, 0, 0.05)',
          borderRadius: scaleDimension(8, uiScale),
          padding: scaleDimension(12, uiScale),
          gap: scaleDimension(4, uiScale),
        },
        detailLabel: {
          fontSize: scaleDimension(12, uiScale),
          marginTop: scaleDimension(4, uiScale),
        },
        detailValue: {
          fontSize: scaleDimension(14, uiScale),
          fontWeight: '500',
        },
        hintText: {
          fontSize: scaleDimension(12, uiScale),
          fontStyle: 'italic',
          textAlign: 'center',
          marginTop: scaleDimension(8, uiScale),
        },
        buttonCtn: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          padding: scaleDimension(16, uiScale),
          gap: scaleDimension(12, uiScale),
        },
      }),
    [uiScale],
  );

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
