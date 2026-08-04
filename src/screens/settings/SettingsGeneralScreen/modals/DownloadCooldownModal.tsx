import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import AppText from '@components/AppText';

import { Portal } from 'react-native-paper';

import { ThemeColors } from '@theme/types';
import { useAppSettings } from '@hooks/persisted';
import { DEFAULT_CHAPTER_DOWNLOAD_COOLDOWN_MS } from '@hooks/persisted/useSettings';
import { scaleDimension } from '@theme/scaling';
import { getString } from '@strings/translations';
import { Modal, Button } from '@components';

interface DownloadCooldownModalProps {
  visible: boolean;
  hideModal: () => void;
  theme: ThemeColors;
}

const msToSeconds = (ms: number): string => {
  if (!Number.isFinite(ms) || ms < 0) {
    return msToSeconds(DEFAULT_CHAPTER_DOWNLOAD_COOLDOWN_MS);
  }
  const seconds = ms / 1000;
  return Number.isInteger(seconds) ? seconds.toString() : seconds.toFixed(2);
};

const parseSecondsToMs = (input: string): number | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const seconds = Number(trimmed);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.round(seconds * 1000);
};

/** Allow only digits and a single optional decimal point. */
const sanitizeNumericInput = (input: string): string => {
  const stripped = input.replace(/[^0-9.]/g, '');
  const firstDot = stripped.indexOf('.');
  if (firstDot === -1) return stripped;
  return (
    stripped.slice(0, firstDot + 1) +
    stripped.slice(firstDot + 1).replace(/\./g, '')
  );
};

const DownloadCooldownModal: React.FC<DownloadCooldownModalProps> = ({
  visible,
  hideModal,
  theme,
}) => {
  const {
    chapterDownloadCooldownMs,
    uiScale = 1.0,
    setAppSettings,
  } = useAppSettings();
  const currentMs =
    chapterDownloadCooldownMs ?? DEFAULT_CHAPTER_DOWNLOAD_COOLDOWN_MS;
  const [draft, setDraft] = useState(msToSeconds(currentMs));

  useEffect(() => {
    if (visible) {
      setDraft(msToSeconds(currentMs));
    }
  }, [visible, currentMs]);

  const save = () => {
    const ms = parseSecondsToMs(draft);
    if (ms == null) {
      hideModal();
      return;
    }
    setAppSettings({ chapterDownloadCooldownMs: ms });
    hideModal();
  };

  const reset = () => {
    setAppSettings({
      chapterDownloadCooldownMs: DEFAULT_CHAPTER_DOWNLOAD_COOLDOWN_MS,
    });
    hideModal();
  };

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        modalHeader: {
          fontSize: scaleDimension(24, uiScale),
          marginBottom: 8,
        },
        modalDesc: {
          fontSize: scaleDimension(14, uiScale),
          marginBottom: 16,
        },
        input: {
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderWidth: 1,
          borderRadius: 8,
          fontSize: scaleDimension(16, uiScale),
        },
        warning: {
          fontSize: scaleDimension(12, uiScale),
          marginTop: 12,
        },
        actions: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          paddingTop: 16,
        },
        actionButton: {
          marginLeft: 8,
        },
      }),
    [uiScale],
  );

  return (
    <Portal>
      <Modal visible={visible} onDismiss={hideModal}>
        <AppText style={[styles.modalHeader, { color: theme.onSurface }]}>
          {getString('generalSettingsScreen.chapterDownloadCooldown')}
        </AppText>
        <AppText style={[styles.modalDesc, { color: theme.onSurfaceVariant }]}>
          {getString('generalSettingsScreen.chapterDownloadCooldownDesc')}
        </AppText>
        <TextInput
          value={draft}
          onChangeText={text => setDraft(sanitizeNumericInput(text))}
          onSubmitEditing={save}
          keyboardType="decimal-pad"
          placeholder={getString(
            'generalSettingsScreen.chapterDownloadCooldownPlaceholder',
          )}
          placeholderTextColor={theme.onSurfaceVariant}
          style={[
            styles.input,
            { color: theme.onSurface, borderColor: theme.outline },
          ]}
          autoFocus
        />
        <AppText style={[styles.warning, { color: theme.error }]}>
          {getString('generalSettingsScreen.chapterDownloadCooldownWarning')}
        </AppText>
        <View style={styles.actions}>
          <Button
            onPress={reset}
            title={getString('common.reset')}
            style={styles.actionButton}
          />
          <Button
            onPress={save}
            title={getString('common.ok')}
            style={styles.actionButton}
          />
        </View>
      </Modal>
    </Portal>
  );
};

export default DownloadCooldownModal;
