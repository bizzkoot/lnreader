import { useCallback, useRef } from 'react';
import { useMMKVNumber } from 'react-native-mmkv';
import { useAppSettings } from './useSettings';
import { useLocalBackupFolder } from './useLocalBackupFolder';
import ServiceManager from '@services/ServiceManager';
import { showToast } from '@utils/showToast';
import { getString } from '@strings/translations';

const LAST_AUTO_BACKUP_TIME = 'LAST_AUTO_BACKUP_TIME';

/**
 * Frequency to milliseconds mapping with 10% grace period
 */
const frequencyToMs: Record<string, number> = {
  manual: Infinity,
  '6h': 6 * 60 * 60 * 1000 * 0.9, // 5.4 hours
  '12h': 12 * 60 * 60 * 1000 * 0.9, // 10.8 hours
  daily: 24 * 60 * 60 * 1000 * 0.9, // 21.6 hours
  '2days': 2 * 24 * 60 * 60 * 1000 * 0.9, // 43.2 hours
  weekly: 7 * 24 * 60 * 60 * 1000 * 0.9, // 6.3 days
};

/**
 * Hook for managing automatic backups.
 * Checks if a backup is due on app launch and triggers it if needed.
 */
export const useAutoBackup = () => {
  const { autoBackupFrequency = 'manual' } = useAppSettings();
  const { folderUri } = useLocalBackupFolder();
  const [lastAutoBackupTime = 0, setLastAutoBackupTime] = useMMKVNumber(
    LAST_AUTO_BACKUP_TIME,
  );

  // Prevent multiple triggers in the same session
  const hasTriggeredThisSession = useRef(false);

  /**
   * Check if backup is due and trigger if needed.
   * Should be called once on app launch.
   */
  const checkAndTriggerBackup = useCallback(() => {
    // Skip if manual mode or already triggered this session
    if (autoBackupFrequency === 'manual' || hasTriggeredThisSession.current) {
      return false;
    }

    // Skip if no backup folder is set
    if (!folderUri) {
      return false;
    }

    const now = Date.now();
    const intervalMs = frequencyToMs[autoBackupFrequency] ?? Infinity;
    const timeSinceLastBackup = now - lastAutoBackupTime;

    // Check if enough time has passed
    if (timeSinceLastBackup >= intervalMs) {
      hasTriggeredThisSession.current = true;

      // Show feedback
      showToast(getString('backupScreen.autoBackupStarting'));

      // Trigger backup via ServiceManager
      try {
        ServiceManager.manager.addTask({
          name: 'LOCAL_BACKUP',
          data: { isAuto: true },
        });
        // NOTE: Ideally update this on *successful completion* of the backup.
        // If ServiceManager exposes task completion callbacks, move this timestamp
        // update there. For now, we only update after enqueue succeeds.
        setLastAutoBackupTime(now);
      } catch {
        hasTriggeredThisSession.current = false;
        return false;
      }

      return true;
    }

    return false;
  }, [
    autoBackupFrequency,
    folderUri,
    lastAutoBackupTime,
    setLastAutoBackupTime,
  ]);

  /**
   * Get time until next backup in human-readable format
   */
  const getNextBackupInfo = useCallback(() => {
    if (autoBackupFrequency === 'manual') {
      return null;
    }

    const intervalMs = frequencyToMs[autoBackupFrequency] ?? Infinity;
    if (intervalMs === Infinity) return null;

    const nextBackupTime = lastAutoBackupTime + intervalMs;
    const now = Date.now();

    if (nextBackupTime <= now) {
      return getString('backupScreen.autoBackupPending');
    }

    const remainingMs = nextBackupTime - now;
    const hours = Math.floor(remainingMs / (60 * 60 * 1000));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h`;
  }, [autoBackupFrequency, lastAutoBackupTime]);

  /**
   * Reset the session trigger flag (useful for testing)
   */
  const resetSessionTrigger = useCallback(() => {
    hasTriggeredThisSession.current = false;
  }, []);

  return {
    checkAndTriggerBackup,
    getNextBackupInfo,
    lastAutoBackupTime,
    resetSessionTrigger,
  };
};

export default useAutoBackup;
