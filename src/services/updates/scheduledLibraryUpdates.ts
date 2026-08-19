import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
dayjs.extend(customParseFormat);

import { getMMKVObject, MMKVStorage } from '@utils/mmkv/mmkv';
import {
  APP_SETTINGS,
  AppSettings,
  SUPPORTED_LIBRARY_UPDATE_INTERVAL_HOURS,
  SupportedLibraryUpdateIntervalHours,
  isSupportedLibraryUpdateIntervalHours,
  normalizeLibraryUpdateIntervalHours,
} from '@hooks/persisted/useSettings';
import { LAST_UPDATE_TIME } from '@hooks/persisted/useUpdates';
import ServiceManager from '@services/ServiceManager';

export {
  SUPPORTED_LIBRARY_UPDATE_INTERVAL_HOURS,
  isSupportedLibraryUpdateIntervalHours,
  normalizeLibraryUpdateIntervalHours,
};
export type { SupportedLibraryUpdateIntervalHours };

const LAST_UPDATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';

const parseLastUpdateTime = (value: string): dayjs.Dayjs | null => {
  const strict = dayjs(value, LAST_UPDATE_FORMAT, true);
  if (strict.isValid()) return strict;
  const generic = dayjs(value);
  return generic.isValid() ? generic : null;
};

export const isScheduledLibraryUpdateDue = (
  lastUpdateTime: string | undefined | null,
  intervalHours: number,
  nowMs: number = Date.now(),
): boolean => {
  if (
    !isSupportedLibraryUpdateIntervalHours(intervalHours) ||
    intervalHours === 0
  ) {
    return false;
  }
  if (!lastUpdateTime) return true;
  const parsed = parseLastUpdateTime(lastUpdateTime);
  if (!parsed) return true;
  const diffMs = nowMs - parsed.valueOf();
  if (!Number.isFinite(diffMs) || diffMs < 0) return false;
  return diffMs >= intervalHours * 60 * 60 * 1000;
};

export const shouldDispatchScheduledLibraryUpdate = (params: {
  intervalHours: number;
  lastUpdateTime?: string | null;
  nowMs?: number;
  hasPendingUpdateTask: boolean;
}): boolean => {
  const { intervalHours, lastUpdateTime, nowMs, hasPendingUpdateTask } = params;
  if (hasPendingUpdateTask) return false;
  return isScheduledLibraryUpdateDue(lastUpdateTime, intervalHours, nowMs);
};

export const dispatchScheduledLibraryUpdateIfDue = (opts?: {
  nowMs?: number;
  manager?: Pick<ServiceManager, 'getTaskList' | 'addTask'>;
}): boolean => {
  const manager = (opts?.manager as ServiceManager) ?? ServiceManager.manager;
  const settings = getMMKVObject<AppSettings>(APP_SETTINGS);
  const intervalHours = normalizeLibraryUpdateIntervalHours(
    (settings as AppSettings | undefined)?.automaticLibraryUpdateIntervalHours,
  );
  if (intervalHours === 0) return false;
  const lastUpdateTime = MMKVStorage.getString(LAST_UPDATE_TIME);
  const hasPending = manager
    .getTaskList()
    .some(task => task.task?.name === 'UPDATE_LIBRARY');
  if (
    !shouldDispatchScheduledLibraryUpdate({
      intervalHours,
      lastUpdateTime: lastUpdateTime ?? undefined,
      nowMs: opts?.nowMs,
      hasPendingUpdateTask: hasPending,
    })
  ) {
    return false;
  }
  manager.addTask({ name: 'UPDATE_LIBRARY' });
  return true;
};

export const getScheduledLibraryUpdateLabelKey = (
  intervalHours: SupportedLibraryUpdateIntervalHours,
): string => {
  switch (intervalHours) {
    case 12:
      return 'generalSettingsScreen.automaticUpdateEvery12h';
    case 24:
      return 'generalSettingsScreen.automaticUpdateEvery24h';
    case 48:
      return 'generalSettingsScreen.automaticUpdateEvery48h';
    case 72:
      return 'generalSettingsScreen.automaticUpdateEvery72h';
    case 168:
      return 'generalSettingsScreen.automaticUpdateEveryWeek';
    default:
      return 'generalSettingsScreen.automaticUpdateOff';
  }
};
