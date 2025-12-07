import { useState, useEffect } from 'react';
import { version } from '../../../package.json';
import { newer } from '@utils/compareVersion';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import pickApkAsset from './githubReleaseUtils';

interface GithubUpdate {
  isNewVersion: boolean;
  latestRelease: any;
}

const LAST_UPDATE_CHECK_KEY = 'LAST_UPDATE_CHECK';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

 

export const useGithubUpdateChecker = (): GithubUpdate => {
  // Target repo for update checks — change owner/repo here if needed
  const latestReleaseUrl =
    'https://api.github.com/repos/bizzkoot/lnreader/releases/latest';

  const [checking, setChecking] = useState(true);
  const [latestRelease, setLatestRelease] = useState<any>();

  const shouldCheckForUpdate = (): boolean => {
    const lastCheckTime = MMKVStorage.getNumber(LAST_UPDATE_CHECK_KEY);
    if (!lastCheckTime) {
      return true;
    }

    const now = Date.now();
    const timeSinceLastCheck = now - lastCheckTime;

    return timeSinceLastCheck >= ONE_DAY_MS;
  };

  const checkForRelease = async () => {
    if (!shouldCheckForUpdate()) {
      setChecking(false);
      return;
    }

    try {
      const res = await fetch(latestReleaseUrl);

      if (!res.ok) {
        setChecking(false);
        return;
      }

      const data = await res.json();

      if (!data || !data.tag_name) {
        setChecking(false);
        return;
      }

      // Pick the most appropriate .apk asset (robust selection) or fall back to the
      // first asset's browser_download_url if none match.

      const release = {
        tag_name: data.tag_name,
        body: data.body,
        downloadUrl:
        pickApkAsset(data.assets) || data.assets?.[0]?.browser_download_url,
      };

      MMKVStorage.set(LAST_UPDATE_CHECK_KEY, Date.now());

      setLatestRelease(release);
      setChecking(false);
    } catch (error) {
      // Silently fail in offline mode or on network errors
      setChecking(false);
    }
  };

  const isNewVersion = (versionTag: string) => {
    const currentVersion = `${version}`;
    const regex = /[^\\d.]/;

    const newVersion = versionTag.replace(regex, '');

    return newer(newVersion, currentVersion);
  };

  useEffect(() => {
    checkForRelease();
  }, []);

  if (!checking && latestRelease?.tag_name) {
    return {
      latestRelease,
      isNewVersion: isNewVersion(latestRelease.tag_name),
    };
  }

  return {
    latestRelease: undefined,
    isNewVersion: false,
  };
};
