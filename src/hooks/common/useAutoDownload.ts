import { useCallback, useEffect, useRef } from 'react';
import { ChapterInfo, NovelInfo } from '@database/types';
import {
  useAppSettings,
  useChapterGeneralSettings,
} from '@hooks/persisted/useSettings';
import {
  checkAndTriggerAutoDownload,
  AutoDownloadConfig,
} from '@services/download/autoDownload';

// eslint-disable-next-line no-console
const logDebug = __DEV__ ? console.log : () => {};

interface UseAutoDownloadOptions {
  novel: NovelInfo;
  /** Whether TTS is currently playing */
  isTTSPlaying?: boolean;
}

/**
 * Hook to handle auto-download during reading and TTS playback.
 * Returns a function to check and trigger auto-download for a chapter.
 */
export const useAutoDownload = ({
  novel,
  isTTSPlaying = false,
}: UseAutoDownloadOptions) => {
  const { autoDownloadOnRemaining = 'disabled', autoDownloadAmount = '10' } =
    useAppSettings();

  const { ttsAutoDownload = 'disabled', ttsAutoDownloadAmount = '10' } =
    useChapterGeneralSettings();

  const lastCheckedChapterId = useRef<number | null>(null);
  const isChecking = useRef(false);

  // Build the config based on current context (TTS vs normal reading)
  const getConfig = useCallback((): AutoDownloadConfig => {
    // During TTS playback, use TTS-specific settings if enabled
    if (isTTSPlaying && ttsAutoDownload !== 'disabled') {
      return {
        enabled: true,
        remainingThreshold: parseInt(ttsAutoDownload, 10),
        downloadAmount: parseInt(ttsAutoDownloadAmount, 10),
      };
    }

    // Otherwise, use app-level settings
    if (autoDownloadOnRemaining !== 'disabled') {
      return {
        enabled: true,
        remainingThreshold: parseInt(autoDownloadOnRemaining, 10),
        downloadAmount: parseInt(autoDownloadAmount, 10),
      };
    }

    return {
      enabled: false,
      remainingThreshold: 0,
      downloadAmount: 0,
    };
  }, [
    isTTSPlaying,
    ttsAutoDownload,
    ttsAutoDownloadAmount,
    autoDownloadOnRemaining,
    autoDownloadAmount,
  ]);

  /**
   * Check if auto-download should be triggered for the given chapter.
   * Call this when navigating to a new chapter or when TTS advances.
   */
  const checkAutoDownload = useCallback(
    async (currentChapter: ChapterInfo): Promise<boolean> => {
      // Skip for local novels
      if (novel.isLocal) {
        return false;
      }

      // Prevent duplicate checks for the same chapter
      if (
        lastCheckedChapterId.current === currentChapter.id ||
        isChecking.current
      ) {
        return false;
      }

      isChecking.current = true;
      lastCheckedChapterId.current = currentChapter.id;

      try {
        const config = getConfig();

        if (!config.enabled) {
          logDebug('AutoDownload: Disabled, skipping check');
          return false;
        }

        logDebug(
          `AutoDownload: Checking chapter ${currentChapter.name} (TTS: ${isTTSPlaying})`,
        );

        return await checkAndTriggerAutoDownload(novel, currentChapter, config);
      } catch (error) {
        logDebug('AutoDownload: Error checking:', error);
        return false;
      } finally {
        isChecking.current = false;
      }
    },
    [novel, getConfig, isTTSPlaying],
  );

  /**
   * Reset the check state when novel changes
   */
  useEffect(() => {
    lastCheckedChapterId.current = null;
  }, [novel.id]);

  return {
    checkAutoDownload,
    getConfig,
  };
};

export default useAutoDownload;
