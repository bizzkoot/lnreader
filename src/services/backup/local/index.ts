import { showToast } from '@utils/showToast';
import dayjs from 'dayjs';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Share, Platform } from 'react-native';

import { CACHE_DIR_PATH, prepareBackupData, restoreData } from '../utils';
import NativeZipArchive from '@specs/NativeZipArchive';
import { ROOT_STORAGE } from '@utils/Storages';
import { ZipBackupName } from '../types';
import NativeFile from '@specs/NativeFile';
import { getString } from '@strings/translations';
import { BackgroundTaskMetadata } from '@services/ServiceManager';
import { sleep } from '@utils/sleep';

export const createBackup = async (
  setMeta?: (
    transformer: (meta: BackgroundTaskMetadata) => BackgroundTaskMetadata,
  ) => void,
) => {
  try {
    setMeta?.(meta => ({
      ...meta,
      isRunning: true,
      progress: 0 / 4,
      progressText: getString('backupScreen.preparingData'),
    }));

    await prepareBackupData(CACHE_DIR_PATH);

    setMeta?.(meta => ({
      ...meta,
      progress: 1 / 4,
      progressText: getString('backupScreen.uploadingDownloadedFiles'),
    }));

    await sleep(200);

    await NativeZipArchive.zip(
      ROOT_STORAGE,
      CACHE_DIR_PATH + '/' + ZipBackupName.DOWNLOAD,
    );

    setMeta?.(meta => ({
      ...meta,
      progress: 2 / 4,
      progressText: getString('backupScreen.uploadingData'),
    }));

    await sleep(200);

    await NativeZipArchive.zip(CACHE_DIR_PATH, CACHE_DIR_PATH + '.zip');

    setMeta?.(meta => ({
      ...meta,
      progress: 3 / 4,
      progressText: getString('backupScreen.savingBackup'),
    }));

    // const datetime = dayjs().format('YYYY-MM-DD_HH_mm');
    // const fileName = 'lnreader_backup_' + datetime + '.zip';
    const fileUri = 'file://' + CACHE_DIR_PATH + '.zip';

    // Get content URI for sharing on Android
    const contentUri = await FileSystem.getContentUriAsync(fileUri);

    await Share.share({
      url: contentUri,
      title: getString('backupScreen.backupCreated'),
    });

    setMeta?.(meta => ({
      ...meta,
      progress: 4 / 4,
      isRunning: false,
    }));

    showToast(getString('backupScreen.backupCreated'));
  } catch (error: any) {
    setMeta?.(meta => ({
      ...meta,
      isRunning: false,
    }));
    showToast(error.message);
  }
};

export const restoreBackup = async (
  setMeta?: (
    transformer: (meta: BackgroundTaskMetadata) => BackgroundTaskMetadata,
  ) => void,
) => {
  try {
    setMeta?.(meta => ({
      ...meta,
      isRunning: true,
      progress: 0 / 4,
      progressText: getString('backupScreen.downloadingData'),
    }));

    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/zip',
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      setMeta?.(meta => ({ ...meta, isRunning: false }));
      return;
    }

    if (NativeFile.exists(CACHE_DIR_PATH)) {
      NativeFile.unlink(CACHE_DIR_PATH);
    }

    // expo-document-picker copies to cache automatically
    const sourceUri = result.assets[0].uri;

    // We need to move it to our CACHE_DIR_PATH or unzip directly?
    // NativeZipArchive.unzip expects a path.
    // sourceUri might be content:// or file://

    let localPath = sourceUri;

    // If it is a content URI, we might need to ensure it's a file path for NativeZipArchive?
    // NativeZipArchive usually works with paths.
    // But sourceUri from copyToCacheDirectory: true is usually file://

    if (sourceUri.startsWith('file://')) {
      localPath = sourceUri.replace('file://', '');
    } else {
      // If it's content URI, we might need to copy it to a known file path if NativeZipArchive can't handle content://
      // But let's assume assets[0].uri is file:// since copyToCacheDirectory is true.
    }

    // Actually, let's keep the existing keepLocalCopy logic logic pattern but simplified:
    // We already have it in cache. Just unzip it.

    // But wait, the original code used keepLocalCopy to put it in cachesDirectory.
    // DocumentPicker with copyToCacheDirectory: true ALREADY puts it in cachesDirectory/DocumentPicker/...

    // The previous code had:
    // const [localRes] = await keepLocalCopy(...)
    // const localPath = localRes.localUri.replace(/^file:(\/\/)?\//, '/');

    // So we just need the path.
    localPath = sourceUri.replace(/^file:(\/\/)?/, ''); // Remove scheme

    // Ensure format is correct for the native module (usually absolute path starting with /)
    if (!localPath.startsWith('/')) {
      localPath = '/' + localPath;
    }

    setMeta?.(meta => ({
      ...meta,
      progress: 1 / 4,
      progressText: getString('backupScreen.restoringData'),
    }));

    await sleep(200);

    await NativeZipArchive.unzip(localPath, CACHE_DIR_PATH);

    setMeta?.(meta => ({
      ...meta,
      progress: 2 / 4,
      progressText: getString('backupScreen.restoringData'),
    }));

    await sleep(200);

    await restoreData(CACHE_DIR_PATH);

    setMeta?.(meta => ({
      ...meta,
      progress: 3 / 4,
      progressText: getString('backupScreen.downloadingDownloadedFiles'),
    }));

    await sleep(200);

    // TODO: unlink here too?
    await NativeZipArchive.unzip(
      CACHE_DIR_PATH + '/' + ZipBackupName.DOWNLOAD,
      ROOT_STORAGE,
    );

    setMeta?.(meta => ({
      ...meta,
      progress: 4 / 4,
      isRunning: false,
    }));

    showToast(getString('backupScreen.backupRestored'));
  } catch (error: any) {
    setMeta?.(meta => ({
      ...meta,
      isRunning: false,
    }));
    showToast(error.message);
  }
};
