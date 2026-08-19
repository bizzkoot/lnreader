import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { createRateLimitedLogger } from '@utils/rateLimitedLogger';

const timeTrackLog = createRateLimitedLogger('useTimeTracking', {
  windowMs: 1500,
});

export interface UseTimeTrackingOptions {
  novelId?: number;
  chapterId?: number;
  enabled: boolean;
  /** 0 = never auto-pause on inactivity */
  inactivityTimeoutMs: number;
  /** true while TTS is PLAYING — manual tracking pauses (boolean fallback) */
  isTTSActive?: boolean;
  /** Preferred: ref that updates without re-render (useTTSController.isTTSReadingRef) */
  isTTSActiveRef?: React.RefObject<boolean>;
}

export interface UseTimeTrackingReturn {
  /** Call on user scroll/touch/save to reset inactivity timer */
  recordActivity: () => void;
  /** Force-flush current session (e.g. on chapter nav). Returns duration inserted or 0 */
  flush: () => Promise<void>;
}

const MIN_SESSION_MS = 1000;

/**
 * Minimal production-safe reading time tracker.
 * - Foreground only (AppState background pauses)
 * - Pauses when TTS is active (distinguishes manual vs TTS per PRD 3.2)
 * - Optional inactivity timeout (0 = disabled)
 * - Inserts into ReadingSession via db.runAsync on flush
 * - Length-preserving, no speculative stats UI
 */
export function useTimeTracking(
  options: UseTimeTrackingOptions,
): UseTimeTrackingReturn {
  const {
    novelId,
    chapterId,
    enabled,
    inactivityTimeoutMs,
    isTTSActive = false,
    isTTSActiveRef,
  } = options;
  const getIsTTSActive = useCallback(
    () => (isTTSActiveRef ? !!isTTSActiveRef.current : !!isTTSActive),
    [isTTSActive, isTTSActiveRef],
  );

  const startTimeRef = useRef<number | null>(null);
  const isTrackingRef = useRef(false);
  const sessionNovelIdRef = useRef<number | undefined>(undefined);
  const sessionChapterIdRef = useRef<number | undefined>(undefined);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const enabledRef = useRef(enabled);
  const ttsActiveRef = useRef(getIsTTSActive());
  const inactivityMsRef = useRef(inactivityTimeoutMs);
  const novelIdRef = useRef(novelId);
  const chapterIdRef = useRef(chapterId);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    ttsActiveRef.current = getIsTTSActive();
  }, [getIsTTSActive]);
  useEffect(() => {
    inactivityMsRef.current = inactivityTimeoutMs;
  }, [inactivityTimeoutMs]);
  useEffect(() => {
    novelIdRef.current = novelId;
  }, [novelId]);
  useEffect(() => {
    chapterIdRef.current = chapterId;
  }, [chapterId]);

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const doFlush = useCallback(
    async (reason: string) => {
      if (!isTrackingRef.current || startTimeRef.current === null) {
        clearInactivityTimer();
        return;
      }
      const now = Date.now();
      const duration = now - startTimeRef.current;
      const nId = sessionNovelIdRef.current;
      const cId = sessionChapterIdRef.current;
      clearInactivityTimer();
      isTrackingRef.current = false;
      startTimeRef.current = null;
      sessionNovelIdRef.current = undefined;
      sessionChapterIdRef.current = undefined;

      if (duration < MIN_SESSION_MS) {
        timeTrackLog.debug(
          'flush-skip-short',
          `${reason} duration=${duration}`,
        );
        return;
      }
      if (!nId || !cId) {
        timeTrackLog.debug('flush-skip-missing-ids', `${reason}`);
        return;
      }
      try {
        const { db } = await import('@database/db');
        await db.runAsync(
          'INSERT INTO ReadingSession (novelId, chapterId, startTime, duration) VALUES (?, ?, ?, ?)',
          nId,
          cId,
          now - duration,
          Math.round(duration),
        );
        timeTrackLog.debug(
          'flushed',
          `${reason} novel=${nId} chapter=${cId} duration=${duration}`,
        );
      } catch (e) {
        timeTrackLog.warn('insert-failed', String(e));
      }
    },
    [clearInactivityTimer],
  );

  const scheduleInactivityTimer = useCallback(() => {
    clearInactivityTimer();
    const ms = inactivityMsRef.current;
    if (!ms || ms <= 0) return;
    if (!isTrackingRef.current) return;
    inactivityTimerRef.current = setTimeout(() => {
      void doFlush('inactivity');
    }, ms);
  }, [clearInactivityTimer, doFlush]);

  const tryStart = useCallback(() => {
    if (isTrackingRef.current) return;
    if (!enabledRef.current) return;
    if (ttsActiveRef.current) return;
    if (
      appStateRef.current === 'background' ||
      appStateRef.current === 'inactive'
    ) {
      return;
    }
    if (!novelIdRef.current || !chapterIdRef.current) return;
    startTimeRef.current = Date.now();
    sessionNovelIdRef.current = novelIdRef.current;
    sessionChapterIdRef.current = chapterIdRef.current;
    isTrackingRef.current = true;
    scheduleInactivityTimer();
    timeTrackLog.debug(
      'started',
      `novel=${novelIdRef.current} chapter=${chapterIdRef.current}`,
    );
  }, [scheduleInactivityTimer]);

  const tryPause = useCallback(
    (reason: string) => {
      if (!isTrackingRef.current) {
        clearInactivityTimer();
        return;
      }
      void doFlush(reason);
    },
    [clearInactivityTimer, doFlush],
  );

  const recordActivity = useCallback(() => {
    if (!isTrackingRef.current) {
      // If we were paused due to inactivity and user returns, resume
      tryStart();
      return;
    }
    scheduleInactivityTimer();
  }, [scheduleInactivityTimer, tryStart]);

  const flush = useCallback(async () => {
    await doFlush('manual-flush');
  }, [doFlush]);

  // React to enabled / TTS / chapter changes — ponytail: single effect covers all pause/resume reasons
  useEffect(() => {
    if (!enabled || isTTSActive) {
      tryPause(!enabled ? 'disabled' : 'tts-active');
    } else if (
      appStateRef.current !== 'background' &&
      appStateRef.current !== 'inactive'
    ) {
      if (novelId && chapterId) {
        tryStart();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isTTSActive, novelId, chapterId]);

  // Chapter/novel change: flush previous session attributed to its captured ids, then start new.
  const prevChapterIdInternalRef = useRef<number | undefined>(chapterId);
  const prevNovelIdInternalRef = useRef<number | undefined>(novelId);
  useEffect(() => {
    const chapterChanged = prevChapterIdInternalRef.current !== chapterId;
    const novelChanged = prevNovelIdInternalRef.current !== novelId;
    if (chapterChanged || novelChanged) {
      // If we were tracking, the session's captured ids are still the previous chapter's
      // (sessionNovelIdRef/sessionChapterIdRef), so flushing now attributes correctly.
      if (isTrackingRef.current) {
        void doFlush('chapter-change');
      }
      prevChapterIdInternalRef.current = chapterId;
      prevNovelIdInternalRef.current = novelId;
      // Start new session for new chapter if eligible (defer to let flush settle)
      if (enabled && !isTTSActive && novelId && chapterId) {
        setTimeout(() => tryStart(), 0);
      }
    }
  }, [chapterId, novelId, enabled, isTTSActive, doFlush, tryStart]);

  // AppState listener
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (next === 'background' || next === 'inactive') {
        tryPause(`appstate-${next}`);
      } else if (next === 'active' && prev !== 'active') {
        if (enabledRef.current && !ttsActiveRef.current) {
          tryStart();
        }
      }
    });
    return () => {
      sub.remove();
      clearInactivityTimer();
    };
  }, [clearInactivityTimer, tryPause, tryStart]);

  // Start on mount if eligible
  useEffect(() => {
    if (enabled && !isTTSActive && novelId && chapterId) {
      if (
        appStateRef.current !== 'background' &&
        appStateRef.current !== 'inactive'
      ) {
        tryStart();
      }
    }
    return () => {
      // Flush on unmount — fire-and-forget; db.runAsync is async but we try
      void doFlush('unmount');
      clearInactivityTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Inactivity timeout change → reschedule
  useEffect(() => {
    if (isTrackingRef.current) {
      scheduleInactivityTimer();
    }
  }, [inactivityTimeoutMs, scheduleInactivityTimer]);

  // Poll TTS ref for changes that don't trigger re-render (isTTSReadingRef is a mutable ref)
  useEffect(() => {
    if (!isTTSActiveRef) return;
    const interval = setInterval(() => {
      const current = getIsTTSActive();
      if (current !== ttsActiveRef.current) {
        ttsActiveRef.current = current;
        if (current) {
          tryPause('tts-active-poll');
        } else if (enabledRef.current) {
          if (
            appStateRef.current !== 'background' &&
            appStateRef.current !== 'inactive'
          ) {
            tryStart();
          }
        }
      }
    }, 700);
    // @ts-ignore - NodeJS vs RN timeout types
    interval.unref?.();
    return () => clearInterval(interval);
  }, [getIsTTSActive, isTTSActiveRef, tryPause, tryStart]);

  return { recordActivity, flush };
}
