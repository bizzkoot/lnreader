import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

export type DownloadProgress = {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
  percentage: number;
};

export type UpdateDownloadState =
  | { status: 'idle' }
  | { status: 'downloading'; progress: DownloadProgress }
  | { status: 'installing' }
  | { status: 'success' }
  | { status: 'error'; error: string };

/**
 * Downloads an APK from the given URL and triggers Android's package installer.
 *
 * @param apkUrl - The URL to download the APK from
 * @param onProgress - Callback for download progress updates
 * @returns Promise that resolves when the installer is launched
 */
export const downloadAndInstallApk = async (
  apkUrl: string,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<void> => {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error('Cache directory not available');
  }
  const downloadPath = cacheDir + 'lnreader-update.apk';

  // Create a download resumable task
  const downloadResumable = FileSystem.createDownloadResumable(
    apkUrl,
    downloadPath,
    {},
    (downloadProgress: FileSystem.DownloadProgressData) => {
      const progress: DownloadProgress = {
        totalBytesWritten: downloadProgress.totalBytesWritten,
        totalBytesExpectedToWrite: downloadProgress.totalBytesExpectedToWrite,
        percentage:
          downloadProgress.totalBytesExpectedToWrite > 0
            ? Math.round(
                (downloadProgress.totalBytesWritten /
                  downloadProgress.totalBytesExpectedToWrite) *
                  100,
              )
            : 0,
      };
      onProgress?.(progress);
    },
  );

  // Download the APK
  const result = await downloadResumable.downloadAsync();

  if (!result || !result.uri) {
    throw new Error('Download failed: No file URI returned');
  }

  // Convert file:// URI to content:// URI for Android install intent
  const contentUri = await FileSystem.getContentUriAsync(result.uri);

  // Launch Android's package installer
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    type: 'application/vnd.android.package-archive',
  });
};

/**
 * Checks if there's an in-progress or cached update download.
 * Could be used for resuming interrupted downloads in the future.
 */
export const clearCachedUpdate = async (): Promise<void> => {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    return;
  }
  const downloadPath = cacheDir + 'lnreader-update.apk';

  try {
    const fileInfo = await FileSystem.getInfoAsync(downloadPath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(downloadPath);
    }
  } catch {
    // Ignore errors when clearing cache
  }
};
