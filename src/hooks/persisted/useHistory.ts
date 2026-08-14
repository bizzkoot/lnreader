import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { History } from '@database/types';

import {
  deleteAllHistory,
  deleteChapterHistory,
  getHistoryFromDb,
} from '@database/queries/HistoryQueries';
import dayjs from 'dayjs';
import { parseChapterNumber } from '@utils/parseChapterNumber';

const useHistory = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [history, setHistory] = useState<History[]>([]);
  const [error, setError] = useState<string>();
  const requestGenerationRef = useRef(0);

  const getHistory = useCallback(async () => {
    const generation = ++requestGenerationRef.current;
    setIsLoading(true);
    setError(undefined);
    try {
      const res = await getHistoryFromDb();
      if (generation !== requestGenerationRef.current) return;
      setHistory(
        res.map(localHistory => {
          const parsedTime = dayjs(localHistory.releaseTime);
          return {
            ...localHistory,
            releaseTime: parsedTime.isValid()
              ? parsedTime.format('LL')
              : localHistory.releaseTime,
            chapterNumber: localHistory.chapterNumber
              ? localHistory.chapterNumber
              : parseChapterNumber(localHistory.novelName, localHistory.name),
          };
        }),
      );
    } catch (err) {
      if (generation === requestGenerationRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (generation === requestGenerationRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const clearAllHistory = useCallback(async () => {
    ++requestGenerationRef.current;
    await deleteAllHistory();
    await getHistory();
  }, [getHistory]);

  const removeChapterFromHistory = useCallback(
    async (chapterId: number) => {
      ++requestGenerationRef.current;
      await deleteChapterHistory(chapterId);
      await getHistory();
    },
    [getHistory],
  );

  useFocusEffect(
    useCallback(() => {
      getHistory();
    }, [getHistory]),
  );

  return {
    isLoading,
    history,
    error,
    removeChapterFromHistory,
    clearAllHistory,
  };
};

export default useHistory;
