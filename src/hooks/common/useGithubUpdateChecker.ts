import { useState, useEffect, useCallback } from 'react';
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

  const checkForRelease = useCallback(async () => {
    const lastCheckTime = MMKVStorage.getNumber(LAST_UPDATE_CHECK_KEY);
    if (!lastCheckTime) {
      setChecking(false);
      return;
    }

    const now = Date.now();
    const timeSinceLastCheck = now - lastCheckTime;

    if (timeSinceLastCheck < ONE_DAY_MS) {
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

      // Extract SHA256 from release body if available
      const sha256Regex = /SHA256:\s*([a-fA-F0-9]{64})/i;
      const sha256Match = data.body?.match(sha256Regex);
      const expectedSha256 = sha256Match ? sha256Match[1] : undefined;

      const release = {
        tag_name: data.tag_name,
        body: data.body,
        downloadUrl:
          pickApkAsset(data.assets) || data.assets?.[0]?.browser_download_url,
        sha256: expectedSha256,
      };

      MMKVStorage.set(LAST_UPDATE_CHECK_KEY, Date.now());

      setLatestRelease(release);
      setChecking(false);
    } catch {
      // Silently fail in offline mode or on network errors
      setChecking(false);
    }
  }, [latestReleaseUrl]);

  const isNewVersion = (versionTag: string) => {
    const currentVersion = `${version}`;
    const regex = /[^\\d.]/;

    const newVersion = versionTag.replace(regex, '');

    return newer(newVersion, currentVersion);
  };

  useEffect(() => {
    checkForRelease();
  }, [checkForRelease]);

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
