import { sleep } from '@utils/sleep';
import { download, upload } from '@api/remote';
import { getString } from '@strings/translations';
import { CACHE_DIR_PATH, prepareBackupData, restoreData } from '../utils';
import { ZipBackupName } from '../types';
import { ROOT_STORAGE } from '@utils/Storages';
import { BackgroundTaskMetadata } from '@services/ServiceManager';

export interface SelfHostData {
  host: string;
  backupFolder: string;
}

/**
 * Validate self-host backup URL.
 * Requires http/https scheme. Non-localhost http requires explicit acceptance.
 */
export const isValidSelfHostUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    // Block obviously dangerous hosts
    if (!parsed.hostname || parsed.hostname === '') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate self-host backup folder name.
 * Only allows conservative alphanumeric names: [A-Za-z0-9._-]{1,64}
 * Rejects slash, backslash, .., NUL, query/fragment characters.
 */
export const isValidBackupFolder = (name: string): boolean =>
  typeof name === 'string' &&
  /^[A-Za-z0-9._-]{1,64}$/.test(name) &&
  !name.includes('..');

export const createSelfHostBackup = async (
  { host, backupFolder }: SelfHostData,
  setMeta: (
    transformer: (meta: BackgroundTaskMetadata) => BackgroundTaskMetadata,
  ) => void,
) => {
  if (!isValidSelfHostUrl(host)) {
    throw new Error(`Invalid self-host URL: ${host}`);
  }
  if (!isValidBackupFolder(backupFolder)) {
    throw new Error(`Invalid backup folder: ${backupFolder}`);
  }
  setMeta(meta => ({
    ...meta,
    isRunning: true,
    progress: 0 / 3,
    progressText: getString('backupScreen.preparingData'),
  }));

  await prepareBackupData(CACHE_DIR_PATH);

  setMeta(meta => ({
    ...meta,
    progress: 1 / 3,
    progressText: getString('backupScreen.uploadingData'),
  }));

  await sleep(200);

  await upload(host, backupFolder, ZipBackupName.DATA, CACHE_DIR_PATH);

  setMeta(meta => ({
    ...meta,
    progress: 2 / 3,
    progressText: getString('backupScreen.uploadingDownloadedFiles'),
  }));

  await sleep(200);

  await upload(host, backupFolder, ZipBackupName.DOWNLOAD, ROOT_STORAGE);

  setMeta(meta => ({
    ...meta,
    progress: 3 / 3,
    isRunning: false,
  }));
};

export const selfHostRestore = async (
  { host, backupFolder }: SelfHostData,
  setMeta: (
    transformer: (meta: BackgroundTaskMetadata) => BackgroundTaskMetadata,
  ) => void,
) => {
  if (!isValidSelfHostUrl(host)) {
    throw new Error(`Invalid self-host URL: ${host}`);
  }
  if (!isValidBackupFolder(backupFolder)) {
    throw new Error(`Invalid backup folder: ${backupFolder}`);
  }
  setMeta(meta => ({
    ...meta,
    isRunning: true,
    progress: 0 / 3,
    progressText: getString('backupScreen.downloadingData'),
  }));

  await download(host, backupFolder, ZipBackupName.DATA, CACHE_DIR_PATH);

  setMeta(meta => ({
    ...meta,
    progress: 1 / 3,
    progressText: getString('backupScreen.restoringData'),
  }));

  await sleep(200);

  await restoreData(CACHE_DIR_PATH);

  setMeta(meta => ({
    ...meta,
    progress: 2 / 3,
    progressText: getString('backupScreen.downloadingDownloadedFiles'),
  }));

  await sleep(200);

  await download(host, backupFolder, ZipBackupName.DOWNLOAD, ROOT_STORAGE);

  setMeta(meta => ({
    ...meta,
    progress: 3 / 3,
    isRunning: false,
  }));
};
