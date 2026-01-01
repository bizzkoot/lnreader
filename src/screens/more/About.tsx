import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import * as Linking from 'expo-linking';

import { getString } from '@strings/translations';
import { MoreHeader } from './components/MoreHeader';
import { useTheme } from '@hooks/persisted';
import { List, SafeAreaView } from '@components';
import { AboutScreenProps } from '@navigators/types';
import { GIT_HASH, RELEASE_DATE, BUILD_TYPE } from '@env';
import * as Clipboard from 'expo-clipboard';
import { version } from '../../../package.json';
import { Portal } from 'react-native-paper';
import NewUpdateDialog from '@components/NewUpdateDialog';
import { showToast } from '@utils/showToast';
import { newer } from '@utils/compareVersion';
import pickApkAsset from '@hooks/common/githubReleaseUtils';

const AboutScreen = ({ navigation }: AboutScreenProps) => {
  const theme = useTheme();
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    tag_name: string;
    body: string;
    downloadUrl: string;
  } | null>(null);
  const [whatsNewInfo, setWhatsNewInfo] = useState<{
    tag_name: string;
    body: string;
    downloadUrl: string;
  } | null>(null);

  function getBuildName() {
    if (!GIT_HASH || !RELEASE_DATE || !BUILD_TYPE) {
      return `Custom build ${version}`;
    } else {
      const localDateTime = isNaN(Number(RELEASE_DATE))
        ? RELEASE_DATE
        : new Date(Number(RELEASE_DATE)).toLocaleString();
      if (BUILD_TYPE === 'Release') {
        return `${BUILD_TYPE} ${version} (${localDateTime})`;
      }
      return `${BUILD_TYPE} ${version} (${localDateTime}) Commit: ${GIT_HASH}`;
    }
  }

  const checkWhatsNew = async () => {
    try {
      const res = await fetch(
        `https://api.github.com/repos/bizzkoot/lnreader/releases/tags/v${version}`,
      );

      if (!res.ok) {
        // If specific tag not found, might mean custom build or unreleased version.
        // Fallback to latest just to show something? No, better show toast or open browser.
        Linking.openURL(
          `https://github.com/bizzkoot/lnreader/releases/tag/v${version}`,
        );
        return;
      }

      const data = await res.json();

      if (!data || !data.tag_name) {
        Linking.openURL(
          `https://github.com/bizzkoot/lnreader/releases/tag/v${version}`,
        );
        return;
      }

      setWhatsNewInfo({
        tag_name: data.tag_name,
        body: data.body || '',
        downloadUrl: '', // Not needed for whatsNew
      });
    } catch {
      Linking.openURL(
        `https://github.com/bizzkoot/lnreader/releases/tag/v${version}`,
      );
    }
  };

  const checkForUpdates = async () => {
    setIsCheckingUpdate(true);
    try {
      const res = await fetch(
        'https://api.github.com/repos/bizzkoot/lnreader/releases/latest',
      );

      if (!res.ok) {
        showToast(getString('common.noUpdatesAvailable'));
        return;
      }

      const data = await res.json();

      if (!data || !data.tag_name) {
        showToast(getString('common.noUpdatesAvailable'));
        return;
      }

      const latestVersion = data.tag_name.replace(/[^\d.]/g, '');
      const isNewer = newer(latestVersion, version);

      if (isNewer) {
        setUpdateInfo({
          tag_name: data.tag_name,
          body: data.body || '',
          downloadUrl:
            pickApkAsset(data.assets) ||
            data.assets?.[0]?.browser_download_url ||
            '',
        });
      } else {
        showToast(getString('common.noUpdatesAvailable'));
      }
    } catch {
      showToast(getString('common.noUpdatesAvailable'));
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  return (
    <SafeAreaView excludeTop>
      <MoreHeader
        title={getString('common.about')}
        navigation={navigation}
        theme={theme}
        goBack={true}
      />
      <ScrollView style={styles.flex}>
        <List.Section>
          <List.Item
            title={getString('aboutScreen.version')}
            description={getBuildName()}
            theme={theme}
            onPress={() => {
              Clipboard.setStringAsync(getBuildName());
            }}
          />
          <List.Item
            title={getString('aboutScreen.whatsNew')}
            onPress={checkWhatsNew}
            theme={theme}
            right="open-in-new"
          />
          <List.Item
            title={getString('common.checkForUpdates')}
            description={
              isCheckingUpdate
                ? getString('common.checkingForUpdates')
                : undefined
            }
            onPress={isCheckingUpdate ? undefined : checkForUpdates}
            theme={theme}
          />
          <List.Item
            title="Features in This Fork"
            description="Explore the exclusive features added in this custom build"
            onPress={() => navigation.navigate('Features')}
            theme={theme}
          />
          <List.Divider theme={theme} />
          <List.Item
            title={getString('aboutScreen.website')}
            description="https://lnreader.app"
            onPress={() => Linking.openURL('https://lnreader.app')}
            theme={theme}
          />
          <List.Item
            title={getString('aboutScreen.discord')}
            description="https://discord.gg/QdcWN4MD63"
            onPress={() => Linking.openURL('https://discord.gg/QdcWN4MD63')}
            theme={theme}
          />
          <List.Item
            title={getString('aboutScreen.github')}
            description="https://github.com/bizzkoot/lnreader"
            onPress={() =>
              Linking.openURL('https://github.com/bizzkoot/lnreader')
            }
            theme={theme}
          />
          <List.Item
            title={getString('aboutScreen.sources')}
            description="https://github.com/LNReader/lnreader-sources"
            onPress={() =>
              Linking.openURL('https://github.com/LNReader/lnreader-sources')
            }
            theme={theme}
          />
          <List.Item
            title={getString('aboutScreen.helpTranslate')}
            description="https://crowdin.com/project/lnreader"
            onPress={() =>
              Linking.openURL('https://crowdin.com/project/lnreader')
            }
            theme={theme}
          />
        </List.Section>
      </ScrollView>

      {/* Update Dialog Portal */}
      {updateInfo && (
        <Portal>
          <NewUpdateDialog
            newVersion={updateInfo}
            type="update"
            onDismiss={() => setUpdateInfo(null)}
          />
        </Portal>
      )}
      {whatsNewInfo && (
        <Portal>
          <NewUpdateDialog
            newVersion={whatsNewInfo}
            type="whatsNew"
            onDismiss={() => setWhatsNewInfo(null)}
          />
        </Portal>
      )}
    </SafeAreaView>
  );
};

export default AboutScreen;

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
