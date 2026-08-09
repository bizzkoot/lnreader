import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Image, ImageStyle, ViewStyle } from 'react-native';
import {
  Portal,
  Button,
  Provider,
  List as PaperList,
} from 'react-native-paper';
import AppText from '@components/AppText';

import {
  getTracker,
  useAppSettings,
  useTheme,
  useTracker,
} from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import { Appbar, List, Modal, SafeAreaView } from '@components';
import { TrackerSettingsScreenProps } from '@navigators/types';
import { getString } from '@strings/translations';
import TrackerLoginDialog from './components/TrackerLoginDialog';
import { authenticateWithCredentials as mangaUpdatesAuth } from '@services/Trackers/mangaUpdates';
import { authenticateWithCredentials as kitsuAuth } from '@services/Trackers/kitsu';
import { showToast } from '@utils/showToast';

interface TrackerStyles {
  logoContainer: ViewStyle;
  trackerLogo: ImageStyle;
}

const AniListLogo = ({ styles }: { styles: TrackerStyles }) => (
  <View style={styles.logoContainer}>
    <Image
      source={require('../../../assets/anilist.png')}
      style={styles.trackerLogo}
    />
  </View>
);

const MyAnimeListLogo = ({ styles }: { styles: TrackerStyles }) => (
  <View style={styles.logoContainer}>
    <Image
      source={require('../../../assets/mal.png')}
      style={styles.trackerLogo}
    />
  </View>
);

const MangaUpdatesLogo = ({ styles }: { styles: TrackerStyles }) => (
  <View style={styles.logoContainer}>
    <Image
      source={require('../../../assets/mangaupdates.png')}
      style={styles.trackerLogo}
    />
  </View>
);

const KitsuLogo = ({ styles }: { styles: TrackerStyles }) => (
  <View style={styles.logoContainer}>
    <Image
      source={require('../../../assets/kitsu.png')}
      style={styles.trackerLogo}
    />
  </View>
);

const TrackerScreen = ({ navigation }: TrackerSettingsScreenProps) => {
  const theme = useTheme();
  const { isTrackerAuthenticated, setTracker, removeTracker, getTrackerAuth } =
    useTracker();
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        flex1: {
          flex: 1,
        },
        screenPadding: {
          paddingVertical: scaleDimension(8, uiScale),
        },
        modalText: {
          fontSize: scaleDimension(18, uiScale),
        },
        modalButtonRow: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
        },
        modalButton: {
          marginTop: scaleDimension(30, uiScale),
        },
        modalButtonLabel: {
          letterSpacing: 0,
          textTransform: 'none',
        },
        logoContainer: {
          paddingLeft: scaleDimension(16, uiScale),
          justifyContent: 'center',
        },
        trackerLogo: {
          width: scaleDimension(32, uiScale),
          height: scaleDimension(32, uiScale),
          resizeMode: 'contain',
          borderRadius: scaleDimension(4, uiScale),
        },
        listItem: {
          paddingVertical: scaleDimension(12, uiScale),
        },
        iconStyle: {
          margin: 0,
        },
      }),
    [uiScale],
  );

  // Tracker Modal for logout confirmation
  const [logoutTrackerName, setLogoutTrackerName] = useState<string>('');
  const [visible, setVisible] = useState(false);
  const showModal = (trackerName: string) => {
    setLogoutTrackerName(trackerName);
    setVisible(true);
  };
  const hideModal = () => {
    setVisible(false);
    setLogoutTrackerName('');
  };

  // Credential-based Login Dialog (MangaUpdates, Kitsu)
  const [credentialLoginTracker, setCredentialLoginTracker] = useState<
    'MangaUpdates' | 'Kitsu' | null
  >(null);
  const showCredentialLogin = (tracker: 'MangaUpdates' | 'Kitsu') =>
    setCredentialLoginTracker(tracker);
  const hideCredentialLogin = () => setCredentialLoginTracker(null);

  const handleCredentialLogin = async (username: string, password: string) => {
    if (!credentialLoginTracker) {
      return;
    }

    try {
      let auth;
      if (credentialLoginTracker === 'MangaUpdates') {
        auth = await mangaUpdatesAuth(username, password);
      } else if (credentialLoginTracker === 'Kitsu') {
        auth = await kitsuAuth(username, password);
      } else {
        throw new Error('Unknown tracker');
      }

      setTracker(credentialLoginTracker, auth);
      hideCredentialLogin();
      showToast(`Successfully logged in to ${credentialLoginTracker}`);
    } catch (error) {
      if (error instanceof Error) {
        throw error; // Let the dialog handle the error display
      }
      throw new Error(`Failed to authenticate with ${credentialLoginTracker}`);
    }
  };

  return (
    <SafeAreaView>
      <Provider>
        <Appbar
          title={getString('tracking')}
          handleGoBack={() => navigation.goBack()}
          theme={theme}
        />
        <View
          style={[
            { backgroundColor: theme.background },
            styles.flex1,
            styles.screenPadding,
          ]}
        >
          <List.Section>
            <List.SubHeader theme={theme}>
              {getString('trackingScreen.services')}
            </List.SubHeader>
            <PaperList.Item
              title="AniList"
              titleStyle={{ color: theme.onSurface }}
              left={() => <AniListLogo styles={styles} />}
              right={
                isTrackerAuthenticated('AniList')
                  ? () => (
                      <PaperList.Icon
                        color={theme.primary}
                        icon="check"
                        style={styles.iconStyle}
                      />
                    )
                  : undefined
              }
              onPress={async () => {
                if (isTrackerAuthenticated('AniList')) {
                  showModal('AniList');
                } else {
                  const auth = await getTracker('AniList').authenticate();
                  if (auth) {
                    setTracker('AniList', auth);
                  }
                }
              }}
              rippleColor={theme.rippleColor}
              style={styles.listItem}
            />
            <PaperList.Item
              title="MyAnimeList"
              titleStyle={{ color: theme.onSurface }}
              left={() => <MyAnimeListLogo styles={styles} />}
              right={
                isTrackerAuthenticated('MyAnimeList')
                  ? () => (
                      <PaperList.Icon
                        color={theme.primary}
                        icon="check"
                        style={styles.iconStyle}
                      />
                    )
                  : undefined
              }
              onPress={async () => {
                if (isTrackerAuthenticated('MyAnimeList')) {
                  showModal('MyAnimeList');
                } else {
                  const auth = await getTracker('MyAnimeList').authenticate();
                  if (auth) {
                    setTracker('MyAnimeList', auth);
                  }
                }
              }}
              rippleColor={theme.rippleColor}
              style={styles.listItem}
            />
            <PaperList.Item
              title="MangaUpdates"
              titleStyle={{ color: theme.onSurface }}
              left={() => <MangaUpdatesLogo styles={styles} />}
              right={
                isTrackerAuthenticated('MangaUpdates')
                  ? () => (
                      <PaperList.Icon
                        color={theme.primary}
                        icon="check"
                        style={styles.iconStyle}
                      />
                    )
                  : undefined
              }
              onPress={() => {
                if (isTrackerAuthenticated('MangaUpdates')) {
                  showModal('MangaUpdates');
                } else {
                  showCredentialLogin('MangaUpdates');
                }
              }}
              rippleColor={theme.rippleColor}
              style={styles.listItem}
            />
            <PaperList.Item
              title="Kitsu"
              titleStyle={{ color: theme.onSurface }}
              left={() => <KitsuLogo styles={styles} />}
              right={
                isTrackerAuthenticated('Kitsu')
                  ? () => (
                      <PaperList.Icon
                        color={theme.primary}
                        icon="check"
                        style={styles.iconStyle}
                      />
                    )
                  : undefined
              }
              onPress={() => {
                if (isTrackerAuthenticated('Kitsu')) {
                  showModal('Kitsu');
                } else {
                  showCredentialLogin('Kitsu');
                }
              }}
              rippleColor={theme.rippleColor}
              style={styles.listItem}
            />
            {(isTrackerAuthenticated('MyAnimeList') &&
              getTrackerAuth('MyAnimeList')?.auth?.expiresAt &&
              getTrackerAuth('MyAnimeList')!.auth.expiresAt <
                new Date(Date.now())) ||
            (isTrackerAuthenticated('Kitsu') &&
              getTrackerAuth('Kitsu')?.auth?.expiresAt &&
              getTrackerAuth('Kitsu')!.auth.expiresAt <
                new Date(Date.now())) ? (
              <>
                <List.Divider theme={theme} />
                <List.SubHeader theme={theme}>
                  {getString('common.settings')}
                </List.SubHeader>
                {isTrackerAuthenticated('MyAnimeList') &&
                  getTrackerAuth('MyAnimeList')?.auth?.expiresAt &&
                  getTrackerAuth('MyAnimeList')!.auth.expiresAt <
                    new Date(Date.now()) && (
                    <List.Item
                      title={
                        getString('trackingScreen.revalidate') + ' MyAnimeList'
                      }
                      onPress={async () => {
                        const trackerAuth = getTrackerAuth('MyAnimeList');
                        const revalidate =
                          getTracker('MyAnimeList')?.revalidate;
                        if (revalidate && trackerAuth) {
                          const auth = await revalidate(trackerAuth.auth);
                          setTracker('MyAnimeList', auth);
                        }
                      }}
                      theme={theme}
                    />
                  )}
                {isTrackerAuthenticated('Kitsu') &&
                  getTrackerAuth('Kitsu')?.auth?.expiresAt &&
                  getTrackerAuth('Kitsu')!.auth.expiresAt <
                    new Date(Date.now()) && (
                    <List.Item
                      title={getString('trackingScreen.revalidate') + ' Kitsu'}
                      onPress={async () => {
                        const trackerAuth = getTrackerAuth('Kitsu');
                        const revalidate = getTracker('Kitsu')?.revalidate;
                        if (revalidate && trackerAuth) {
                          try {
                            const auth = await revalidate(trackerAuth.auth);
                            setTracker('Kitsu', auth);
                            showToast('Successfully refreshed Kitsu session');
                          } catch (error) {
                            showToast(
                              'Failed to refresh Kitsu session. Please log in again.',
                            );
                            removeTracker('Kitsu');
                          }
                        }
                      }}
                      theme={theme}
                    />
                  )}
              </>
            ) : null}
          </List.Section>

          <Portal>
            <Modal visible={visible} onDismiss={hideModal}>
              <AppText style={[{ color: theme.onSurface }, styles.modalText]}>
                {getString('trackingScreen.logOutMessage', {
                  name: logoutTrackerName,
                })}
              </AppText>
              <View style={styles.modalButtonRow}>
                <Button
                  style={styles.modalButton}
                  labelStyle={[
                    { color: theme.primary },
                    styles.modalButtonLabel,
                  ]}
                  onPress={hideModal}
                >
                  {getString('common.cancel')}
                </Button>
                <Button
                  style={styles.modalButton}
                  labelStyle={[
                    { color: theme.primary },
                    styles.modalButtonLabel,
                  ]}
                  onPress={() => {
                    removeTracker(
                      logoutTrackerName as
                        | 'AniList'
                        | 'MyAnimeList'
                        | 'MangaUpdates'
                        | 'Kitsu',
                    );
                    hideModal();
                  }}
                >
                  {getString('common.logout')}
                </Button>
              </View>
            </Modal>
            <TrackerLoginDialog
              visible={credentialLoginTracker !== null}
              trackerName={credentialLoginTracker || ''}
              onDismiss={hideCredentialLogin}
              onSubmit={handleCredentialLogin}
              usernameLabel={
                credentialLoginTracker === 'Kitsu' ? 'Email' : 'Username'
              }
            />
          </Portal>
        </View>
      </Provider>
    </SafeAreaView>
  );
};

export default TrackerScreen;

// Styles are now inside the component using useMemo
