import React, { useState } from 'react';

import { Portal, TextInput } from 'react-native-paper';
import AppText from '@components/AppText';

import { useAppSettings, useTheme, useUserAgent } from '@hooks/persisted';
import { showToast } from '@utils/showToast';

import { deleteCachedNovels } from '@hooks/persisted/useNovel';
import { getString } from '@strings/translations';
import { useBoolean } from '@hooks';
import ConfirmationDialog from '@components/ConfirmationDialog/ConfirmationDialog';
import {
  deleteReadChaptersFromDb,
  clearUpdates,
} from '@database/queries/ChapterQueries';
import { scaleDimension } from '@theme/scaling';

import { Appbar, Button, List, Modal, SafeAreaView } from '@components';
import { RadioButton, RadioButtonGroup } from '@components/RadioButton';
import { AdvancedSettingsScreenProps } from '@navigators/types';
import { ScrollView, StyleSheet, View, Platform } from 'react-native';
import { getUserAgentSync } from 'react-native-device-info';
import CookieManager from '@react-native-cookies/cookies';
import { CookieManager as CookieManagerService } from '@services/network/CookieManager';
import { store } from '@plugins/helpers/storage';
import { recreateDatabaseIndexes } from '@database/db';
import {
  DoHProvider,
  DoHProviderNames,
  DoHProviderDescriptions,
  DoHManager,
} from '@services/network/DoHManager';

const AdvancedSettings = ({ navigation }: AdvancedSettingsScreenProps) => {
  const theme = useTheme();

  // DoH provider state
  const [currentDoHProvider, setCurrentDoHProvider] = useState<DoHProvider>(
    DoHProvider.DISABLED,
  );
  const [selectedDoHProvider, setSelectedDoHProvider] = useState<DoHProvider>(
    DoHProvider.DISABLED,
  );

  // Load current DoH provider on mount
  React.useEffect(() => {
    DoHManager.getProvider().then(provider => {
      setCurrentDoHProvider(provider);
      setSelectedDoHProvider(provider);
    });
  }, []);

  const clearCookies = async () => {
    try {
      await CookieManagerService.clearAllCookies();
      CookieManager.clearAll(); // Also clear legacy WebView cookies
      store.clearAll(); // Clear WebView storage
      showToast(getString('webview.cookiesCleared'));
      hideClearCookiesDialog();
    } catch (error) {
      showToast(getString('common.error'));
    }
  };

  const { userAgent, setUserAgent } = useUserAgent();
  const { uiScale = 1.0 } = useAppSettings();
  const [userAgentInput, setUserAgentInput] = useState(userAgent);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        button: {
          flex: 1,
          marginHorizontal: 8,
          marginTop: 16,
        },
        buttonGroup: {
          flexDirection: 'row-reverse',
        },
        modalTitle: {
          fontSize: scaleDimension(24, uiScale),
          marginBottom: 16,
        },
        textInput: {
          borderRadius: 14,
          fontSize: scaleDimension(12, uiScale),
          height: scaleDimension(120, uiScale),
          marginBottom: 8,
          marginTop: 16,
        },
      }),
    [uiScale],
  );

  /**
   * Confirm Clear Database Dialog
   */
  const [clearDatabaseDialog, setClearDatabaseDialog] = useState(false);
  const showClearDatabaseDialog = () => setClearDatabaseDialog(true);
  const hideClearDatabaseDialog = () => setClearDatabaseDialog(false);

  const [clearUpdatesDialog, setClearUpdatesDialog] = useState(false);
  const showClearUpdatesDialog = () => setClearUpdatesDialog(true);
  const hideClearUpdatesDialog = () => setClearUpdatesDialog(false);

  const {
    value: deleteReadChaptersDialog,
    setTrue: showDeleteReadChaptersDialog,
    setFalse: hideDeleteReadChaptersDialog,
  } = useBoolean();

  const {
    value: userAgentModalVisible,
    setTrue: showUserAgentModal,
    setFalse: hideUserAgentModal,
  } = useBoolean();

  const {
    value: recreateDatabaseIndexesDialog,
    setTrue: showRecreateDBIndexDialog,
    setFalse: hideRecreateDBIndexDialog,
  } = useBoolean();

  const {
    value: clearCookiesDialog,
    setTrue: showClearCookiesDialog,
    setFalse: hideClearCookiesDialog,
  } = useBoolean();

  const {
    value: dohProviderModal,
    setTrue: showDohProviderModal,
    setFalse: hideDohProviderModal,
  } = useBoolean();

  const {
    value: dohRestartDialog,
    setTrue: showDohRestartDialog,
    setFalse: hideDohRestartDialog,
  } = useBoolean();

  const handleDoHProviderChange = async (provider: DoHProvider) => {
    setSelectedDoHProvider(provider);
    hideDohProviderModal();

    // Show restart warning if provider is changing
    if (provider !== currentDoHProvider) {
      showDohRestartDialog();
    }
  };

  const confirmDoHProviderChange = async () => {
    const success = await DoHManager.setProvider(selectedDoHProvider);

    if (success) {
      setCurrentDoHProvider(selectedDoHProvider);
      showToast(getString('advancedSettingsScreen.dohProviderChanged'));
    } else {
      showToast(getString('advancedSettingsScreen.dohProviderError'));
      // Revert selection on failure
      setSelectedDoHProvider(currentDoHProvider);
    }

    hideDohRestartDialog();
  };

  const cancelDoHProviderChange = () => {
    // Revert to current provider
    setSelectedDoHProvider(currentDoHProvider);
    hideDohRestartDialog();
  };

  return (
    <SafeAreaView excludeTop>
      <Appbar
        title={getString('advancedSettings')}
        handleGoBack={() => navigation.goBack()}
        theme={theme}
      />
      <ScrollView>
        <List.Section>
          <List.SubHeader theme={theme}>
            {getString('advancedSettingsScreen.dnsOverHttps')}
          </List.SubHeader>
          <List.Item
            title={getString('advancedSettingsScreen.dohProvider')}
            description={
              Platform.OS === 'android'
                ? DoHProviderNames[currentDoHProvider]
                : getString('advancedSettingsScreen.dohAndroidOnly')
            }
            onPress={
              Platform.OS === 'android' ? showDohProviderModal : undefined
            }
            disabled={Platform.OS !== 'android'}
            theme={theme}
          />
        </List.Section>
        <List.Section>
          <List.SubHeader theme={theme}>
            {getString('advancedSettingsScreen.dataManagement')}
          </List.SubHeader>
          <List.Item
            title={getString('advancedSettingsScreen.clearCachedNovels')}
            description={getString(
              'advancedSettingsScreen.clearCachedNovelsDesc',
            )}
            onPress={showClearDatabaseDialog}
            theme={theme}
          />
          <List.Item
            title={getString('advancedSettingsScreen.recreateDBIndexes')}
            description={getString(
              'advancedSettingsScreen.recreateDBIndexesDesc',
            )}
            onPress={showRecreateDBIndexDialog}
            theme={theme}
          />
          <List.Item
            title={getString('advancedSettingsScreen.clearUpdatesTab')}
            description={getString(
              'advancedSettingsScreen.clearupdatesTabDesc',
            )}
            onPress={showClearUpdatesDialog}
            theme={theme}
          />
          <List.Item
            title={getString('advancedSettingsScreen.deleteReadChapters')}
            onPress={showDeleteReadChaptersDialog}
            theme={theme}
          />
          <List.Item
            title={getString('webview.clearCookies')}
            onPress={showClearCookiesDialog}
            theme={theme}
          />
          <List.Item
            title={getString('advancedSettingsScreen.userAgent')}
            description={userAgent}
            onPress={showUserAgentModal}
            theme={theme}
          />
        </List.Section>
      </ScrollView>
      <Portal>
        <ConfirmationDialog
          message={getString(
            'advancedSettingsScreen.deleteReadChaptersDialogTitle',
          )}
          visible={deleteReadChaptersDialog}
          onSubmit={deleteReadChaptersFromDb}
          onDismiss={hideDeleteReadChaptersDialog}
          theme={theme}
        />
        <ConfirmationDialog
          message={getString(
            'advancedSettingsScreen.recreateDBIndexesDialogTitle',
          )}
          visible={recreateDatabaseIndexesDialog}
          onSubmit={() => {
            recreateDatabaseIndexes();
            showToast(
              getString('advancedSettingsScreen.recreateDBIndexesToast'),
            );
          }}
          onDismiss={hideRecreateDBIndexDialog}
          theme={theme}
        />
        <ConfirmationDialog
          message={getString('advancedSettingsScreen.clearDatabaseWarning')}
          visible={clearDatabaseDialog}
          onSubmit={deleteCachedNovels}
          onDismiss={hideClearDatabaseDialog}
          theme={theme}
        />
        <ConfirmationDialog
          message={getString('advancedSettingsScreen.clearUpdatesWarning')}
          visible={clearUpdatesDialog}
          onSubmit={() => {
            clearUpdates();
            showToast(getString('advancedSettingsScreen.clearUpdatesMessage'));
            hideClearUpdatesDialog();
          }}
          onDismiss={hideClearUpdatesDialog}
          theme={theme}
        />
        <ConfirmationDialog
          message={getString('advancedSettingsScreen.clearCookiesWarning')}
          visible={clearCookiesDialog}
          onSubmit={clearCookies}
          onDismiss={hideClearCookiesDialog}
          theme={theme}
        />

        <Modal visible={userAgentModalVisible} onDismiss={hideUserAgentModal}>
          <AppText style={[styles.modalTitle, { color: theme.onSurface }]}>
            {getString('advancedSettingsScreen.userAgent')}
          </AppText>
          <AppText style={{ color: theme.onSurfaceVariant }}>
            {userAgent}
          </AppText>
          <TextInput
            multiline
            mode="outlined"
            defaultValue={userAgent}
            onChangeText={text => setUserAgentInput(text.trim())}
            placeholderTextColor={theme.onSurfaceDisabled}
            underlineColor={theme.outline}
            style={[{ color: theme.onSurface }, styles.textInput]}
            theme={{ colors: { ...theme } }}
          />
          <View style={styles.buttonGroup}>
            <Button
              onPress={() => {
                setUserAgent(userAgentInput);
                hideUserAgentModal();
              }}
              style={styles.button}
              title={getString('common.save')}
              mode="contained"
            />
            <Button
              style={styles.button}
              onPress={() => {
                setUserAgent(getUserAgentSync());
                hideUserAgentModal();
              }}
              title={getString('common.reset')}
            />
          </View>
        </Modal>

        {/* DoH Provider Picker Modal */}
        <Modal visible={dohProviderModal} onDismiss={hideDohProviderModal}>
          <AppText style={[styles.modalTitle, { color: theme.onSurface }]}>
            {getString('advancedSettingsScreen.selectDohProvider')}
          </AppText>
          <RadioButtonGroup
            value={selectedDoHProvider}
            onValueChange={value =>
              handleDoHProviderChange(Number(value) as DoHProvider)
            }
          >
            {Object.entries(DoHProviderNames).map(([key, name]) => {
              const providerId = Number(key) as DoHProvider;
              return (
                <View key={key}>
                  <RadioButton value={providerId} label={name} theme={theme} />
                  <AppText
                    style={{
                      color: theme.onSurfaceVariant,
                      fontSize: scaleDimension(12, uiScale),
                      marginLeft: scaleDimension(48, uiScale),
                      marginTop: scaleDimension(-4, uiScale),
                      marginBottom: scaleDimension(8, uiScale),
                    }}
                  >
                    {DoHProviderDescriptions[providerId]}
                  </AppText>
                </View>
              );
            })}
          </RadioButtonGroup>
          <View style={styles.buttonGroup}>
            <Button
              onPress={hideDohProviderModal}
              style={styles.button}
              title={getString('common.cancel')}
            />
          </View>
        </Modal>

        {/* DoH Restart Confirmation Dialog */}
        <ConfirmationDialog
          message={getString('advancedSettingsScreen.dohRestartWarning')}
          visible={dohRestartDialog}
          onSubmit={confirmDoHProviderChange}
          onDismiss={cancelDoHProviderChange}
          theme={theme}
        />
      </Portal>
    </SafeAreaView>
  );
};

export default AdvancedSettings;
