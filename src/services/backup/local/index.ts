import { showToast } from '@utils/showToast';
// import dayjs from 'dayjs';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { Share } from 'react-native';

import { CACHE_DIR_PATH, prepareBackupData, restoreData } from '../utils';
import NativeZipArchive from '@specs/NativeZipArchive';
import { ROOT_STORAGE } from '@utils/Storages';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { ZipBackupName } from '../types';
import NativeFile from '@specs/NativeFile';
import { getString } from '@strings/translations';
import { BackgroundTaskMetadata } from '@services/ServiceManager';
import { sleep } from '@utils/sleep';
import { LOCAL_BACKUP_FOLDER_URI } from '@hooks/persisted/useLocalBackupFolder';

// Helper function to share backup file via Android share sheet
const shareBackupFile = async (filePath: string) => {
  const contentUri = await FileSystem.getContentUriAsync(filePath);
  await Share.share({
    url: contentUri,
    title: getString('backupScreen.backupCreated'),
  });
};

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

    // Copy the zip file to expo-file-system's cache directory
    // This is necessary because getContentUriAsync only works with paths
    // that expo-file-system created or knows about
    const nativeZipPath = 'file://' + CACHE_DIR_PATH + '.zip';
    const expoZipPath = FileSystem.cacheDirectory + 'lnreader_backup.zip';

    await FileSystem.copyAsync({
      from: nativeZipPath,
      to: expoZipPath,
    });

    // Check if default backup folder is set
    const defaultFolderUri = MMKVStorage.getString(LOCAL_BACKUP_FOLDER_URI);

    if (defaultFolderUri) {
      // Save directly to default folder
      try {
        const timestamp = new Date()
          .toISOString()
          .replace(/[:.]/g, '-')
          .slice(0, -5);
        const fileName = `lnreader_backup_${timestamp}.zip`;

        const destUri = await StorageAccessFramework.createFileAsync(
          defaultFolderUri,
          fileName,
          'application/zip',
        );

        // Read the backup file and write to destination
        const base64Content = await FileSystem.readAsStringAsync(expoZipPath, {
          encoding: FileSystem.EncodingType.Base64,
        });

        await StorageAccessFramework.writeAsStringAsync(
          destUri,
          base64Content,
          { encoding: FileSystem.EncodingType.Base64 },
        );

        showToast(getString('backupScreen.backupSavedToFolder'));
      } catch (error) {
        // If default folder save fails, fall back to share sheet
        showToast(getString('backupScreen.defaultFolderFailed'));
        await shareBackupFile(expoZipPath);
      }
    } else {
      // No default folder, use share sheet
      await shareBackupFile(expoZipPath);
    }

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
