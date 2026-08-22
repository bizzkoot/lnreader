import { useCallback, useMemo, useRef, useState } from 'react';
import {
  getDetailedUpdatesFromDb,
  getUpdatedOverviewFromDb,
} from '@database/queries/ChapterQueries';

import { Update, UpdateOverview } from '@database/types';
import { useMMKVBoolean, useMMKVString } from 'react-native-mmkv';
import dayjs from 'dayjs';
import { parseChapterNumber } from '@utils/parseChapterNumber';
import { useFocusEffect } from '@react-navigation/native';

export const SHOW_LAST_UPDATE_TIME = 'SHOW_LAST_UPDATE_TIME';
export const LAST_UPDATE_TIME = 'LAST_UPDATE_TIME';

export const useLastUpdate = () => {
  const [showLastUpdateTime = true, setShowLastUpdateTime] = useMMKVBoolean(
    SHOW_LAST_UPDATE_TIME,
  );
  const [lastUpdateTime, setLastUpdateTime] = useMMKVString(LAST_UPDATE_TIME);
  return {
    lastUpdateTime,
    showLastUpdateTime,
    setLastUpdateTime,
    setShowLastUpdateTime,
  };
};

export const useUpdates = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [updatesOverview, setUpdatesOverview] = useState<UpdateOverview[]>([]);
  // Guards against a stale async overview fetch resolving after a newer one
  // (e.g. a slow focus-triggered fetch landing after a deleteChapter().then(getUpdates)
  // refetch) — mirrors useLibrary's loadRequestIdRef pattern.
  const overviewRequestIdRef = useRef(0);

  const { lastUpdateTime, showLastUpdateTime, setLastUpdateTime } =
    useLastUpdate();
  const [error, setError] = useState('');

  const getDetailedUpdates = useCallback(
    async (novelId: number, onlyDownloadedChapters: boolean = false) => {
      setIsLoading(true);
      setError('');
      try {
        let result: Update[] = await getDetailedUpdatesFromDb(
          novelId,
          onlyDownloadedChapters,
        );
        result = result.map(update => {
          const parsedTime = dayjs(update.releaseTime);
          return {
            ...update,
            releaseTime: parsedTime.isValid()
              ? parsedTime.format('LL')
              : update.releaseTime,
            chapterNumber: update.chapterNumber
              ? update.chapterNumber
              : parseChapterNumber(update.novelName, update.name),
          };
        });
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const getUpdates = useCallback(async () => {
    const requestId = ++overviewRequestIdRef.current;
    setIsLoading(true);
    setError('');
    try {
      const res = await getUpdatedOverviewFromDb();
      if (requestId !== overviewRequestIdRef.current) {
        return;
      }
      setUpdatesOverview(res);
      if (
        res.length &&
        (!lastUpdateTime ||
          dayjs(lastUpdateTime).isBefore(dayjs(res[0].updateDate)))
      ) {
        setLastUpdateTime(res[0].updateDate);
      }
    } catch (err) {
      if (requestId === overviewRequestIdRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (requestId === overviewRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [lastUpdateTime, setLastUpdateTime]);

  useFocusEffect(
    useCallback(() => {
      // Push updates to the end of the stack to avoid lag; rely on getUpdates
      // for isLoading gating via overviewRequestIdRef to avoid premature clear.
      const timer = setTimeout(() => {
        getUpdates();
      }, 0);
      return () => clearTimeout(timer);
    }, [getUpdates]),
  );

  return useMemo(
    () => ({
      isLoading,
      updatesOverview,
      getUpdates,
      getDetailedUpdates,
      lastUpdateTime,
      showLastUpdateTime,
      error,
    }),
    [
      isLoading,
      updatesOverview,
      getUpdates,
      getDetailedUpdates,
      lastUpdateTime,
      showLastUpdateTime,
      error,
    ],
  );
};
