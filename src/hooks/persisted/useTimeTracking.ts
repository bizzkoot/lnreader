import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { createRateLimitedLogger } from '@utils/rateLimitedLogger';
import { db } from '@database/db';

const timeTrackLog = createRateLimitedLogger('useTimeTracking', {
  windowMs: 1500,
});

export interface UseTimeTrackingOptions {
  novelId?: number;
  chapterId?: number;
  enabled: boolean;
  /** 0 = never auto-pause on inactivity */
  inactivityTimeoutMs: number;
  /** true while TTS is PLAYING (boolean fallback) */
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
const MAX_SESSION_MS = 12 * 3600 * 1000; // 12h cap guards Date.now NTP/zone skew (AUD-TIME-05)
const CHECKPOINT_INTERVAL_MS = 60_000;
const CHECKPOINT_MIN_MS = 30_000;

/**
 * Production-safe dual-mode reading time tracker.
 * - Manual reading mode: Foreground only, pauses on AppState background, resets/pauses on inactivity timeout.
 * - TTS reading mode: Tracks active TTS playback in foreground and background without inactivity pauses.
 * - Mutual exclusion: Manual tracking pauses while TTS is active to prevent double-counting.
 * - Inserts into ReadingSession via db.runAsync on flush.
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

  // Manual mode state
  const manualStartTimeRef = useRef<number | null>(null);
  const isManualTrackingRef = useRef(false);
  const sessionManualNovelIdRef = useRef<number | undefined>(undefined);
  const sessionManualChapterIdRef = useRef<number | undefined>(undefined);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityAtRef = useRef<number | null>(null);
  const backgroundEnterAtRef = useRef<number | null>(null);
  const checkpointIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  // TTS mode state
  const ttsStartTimeRef = useRef<number | null>(null);
  const isTtsTrackingRef = useRef(false);
  const sessionTtsNovelIdRef = useRef<number | undefined>(undefined);
  const sessionTtsChapterIdRef = useRef<number | undefined>(undefined);

  // Environment refs
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

  const sanitizeDuration = useCallback((duration: number): number => {
    if (!Number.isFinite(duration) || duration < 0) {
      timeTrackLog.debug('duration-non-monotonic', `duration=${duration}`);
      return 0;
    }
    if (duration > MAX_SESSION_MS) {
      timeTrackLog.warn(
        'duration-capped',
        `capped ${duration} to ${MAX_SESSION_MS}`,
      );
      return MAX_SESSION_MS;
    }
    return duration;
  }, []);

  const persistSession = useCallback(
    async (
      nId: number | undefined,
      cId: number | undefined,
      startTime: number,
      duration: number,
      mode: 'manual' | 'tts',
      reason: string,
    ) => {
      duration = sanitizeDuration(duration);
      if (duration < MIN_SESSION_MS) {
        timeTrackLog.debug(
          `${mode}-flush-skip-short`,
          `${reason} duration=${duration}`,
        );
        return;
      }
      if (nId == null || cId == null) {
        timeTrackLog.debug(`${mode}-flush-skip-missing-ids`, `${reason}`);
        return;
      }
      try {
        await db.runAsync(
          'INSERT INTO ReadingSession (novelId, chapterId, startTime, duration) VALUES (?, ?, ?, ?)',
          nId,
          cId,
          startTime,
          Math.round(duration),
        );
        timeTrackLog.debug(
          `${mode}-flushed`,
          `${reason} novel=${nId} chapter=${cId} duration=${duration}`,
        );
      } catch (e) {
        timeTrackLog.warn(`${mode}-insert-failed`, String(e));
      }
    },
    [sanitizeDuration],
  );

  const doFlushManual = useCallback(
    async (reason: string) => {
      if (!isManualTrackingRef.current || manualStartTimeRef.current === null) {
        clearInactivityTimer();
        return;
      }
      const startTime = manualStartTimeRef.current;
      let duration: number;
      // AUD-TIME-02: exclude idle window from inactivity flush
      if (reason === 'inactivity' && lastActivityAtRef.current != null) {
        duration = lastActivityAtRef.current - startTime;
      } else {
        duration = Date.now() - startTime;
      }
      duration = sanitizeDuration(duration);
      const nId = sessionManualNovelIdRef.current;
      const cId = sessionManualChapterIdRef.current;

      clearInactivityTimer();
      isManualTrackingRef.current = false;
      manualStartTimeRef.current = null;
      lastActivityAtRef.current = null;
      sessionManualNovelIdRef.current = undefined;
      sessionManualChapterIdRef.current = undefined;

      await persistSession(nId, cId, startTime, duration, 'manual', reason);
    },
    [clearInactivityTimer, persistSession, sanitizeDuration],
  );

  const doFlushTts = useCallback(
    async (reason: string) => {
      if (!isTtsTrackingRef.current || ttsStartTimeRef.current === null) {
        return;
      }
      const startTime = ttsStartTimeRef.current;
      let endTime = Date.now();
      // AUD-TIME-03: if TTS was paused while JS suspended in background/Doze,
      // polling fires late. Cap end to background-enter time to avoid counting
      // hours of silent paused time as playback.
      if (
        reason === 'tts-inactive-poll' &&
        (appStateRef.current === 'background' ||
          appStateRef.current === 'inactive') &&
        backgroundEnterAtRef.current != null
      ) {
        endTime = backgroundEnterAtRef.current;
      }
      const duration = sanitizeDuration(endTime - startTime);
      const nId = sessionTtsNovelIdRef.current;
      const cId = sessionTtsChapterIdRef.current;

      isTtsTrackingRef.current = false;
      ttsStartTimeRef.current = null;
      sessionTtsNovelIdRef.current = undefined;
      sessionTtsChapterIdRef.current = undefined;

      await persistSession(nId, cId, startTime, duration, 'tts', reason);
    },
    [persistSession, sanitizeDuration],
  );

  const scheduleInactivityTimer = useCallback(() => {
    clearInactivityTimer();
    const ms = inactivityMsRef.current;
    if (!ms || ms <= 0) return;
    if (!isManualTrackingRef.current) return;
    inactivityTimerRef.current = setTimeout(() => {
      void doFlushManual('inactivity');
    }, ms);
  }, [clearInactivityTimer, doFlushManual]);

  const tryStartManual = useCallback(() => {
    if (isManualTrackingRef.current) return;
    if (!enabledRef.current) return;
    if (ttsActiveRef.current) return;
    if (
      appStateRef.current === 'background' ||
      appStateRef.current === 'inactive'
    ) {
      return;
    }
    if (novelIdRef.current == null || chapterIdRef.current == null) return;
    const now = Date.now();
    manualStartTimeRef.current = now;
    lastActivityAtRef.current = now;
    sessionManualNovelIdRef.current = novelIdRef.current;
    sessionManualChapterIdRef.current = chapterIdRef.current;
    isManualTrackingRef.current = true;
    scheduleInactivityTimer();
    timeTrackLog.debug(
      'manual-started',
      `novel=${novelIdRef.current} chapter=${chapterIdRef.current}`,
    );
  }, [scheduleInactivityTimer]);

  const tryStartTts = useCallback(() => {
    if (isTtsTrackingRef.current) return;
    if (!enabledRef.current) return;
    if (!ttsActiveRef.current) return;
    if (novelIdRef.current == null || chapterIdRef.current == null) return;
    ttsStartTimeRef.current = Date.now();
    sessionTtsNovelIdRef.current = novelIdRef.current;
    sessionTtsChapterIdRef.current = chapterIdRef.current;
    isTtsTrackingRef.current = true;
    timeTrackLog.debug(
      'tts-started',
      `novel=${novelIdRef.current} chapter=${chapterIdRef.current}`,
    );
  }, []);

  const recordActivity = useCallback(() => {
    if (ttsActiveRef.current) return;
    if (!isManualTrackingRef.current) {
      tryStartManual();
      return;
    }
    lastActivityAtRef.current = Date.now();
    scheduleInactivityTimer();
  }, [scheduleInactivityTimer, tryStartManual]);

  const flush = useCallback(async () => {
    await Promise.all([
      doFlushManual('manual-flush'),
      doFlushTts('manual-flush'),
    ]);
  }, [doFlushManual, doFlushTts]);

  // React to enabled / TTS mode changes
  useEffect(() => {
    const isTts = getIsTTSActive();
    ttsActiveRef.current = isTts;

    if (!enabled) {
      void doFlushManual('disabled');
      void doFlushTts('disabled');
      return;
    }

    if (isTts) {
      void doFlushManual('tts-active');
      tryStartTts();
    } else {
      void doFlushTts('tts-inactive');
      if (
        appStateRef.current !== 'background' &&
        appStateRef.current !== 'inactive' &&
        novelId != null &&
        chapterId != null
      ) {
        tryStartManual();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isTTSActive, novelId, chapterId]);

  // Chapter/novel change: flush previous session and start new (AUD-TIME-06)
  // Timer cleanup is scoped to actual chapter/novel changes, not every re-render,
  // to avoid clearing the scheduled starter on unrelated dep changes.
  const prevChapterIdInternalRef = useRef<number | undefined>(chapterId);
  const prevNovelIdInternalRef = useRef<number | undefined>(novelId);
  const chapterChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // Refs for callbacks to avoid effect re-trigger on identity change
  const doFlushManualRef = useRef(doFlushManual);
  const doFlushTtsRef = useRef(doFlushTts);
  const tryStartManualRef = useRef(tryStartManual);
  const tryStartTtsRef = useRef(tryStartTts);
  useEffect(() => {
    doFlushManualRef.current = doFlushManual;
  }, [doFlushManual]);
  useEffect(() => {
    doFlushTtsRef.current = doFlushTts;
  }, [doFlushTts]);
  useEffect(() => {
    tryStartManualRef.current = tryStartManual;
  }, [tryStartManual]);
  useEffect(() => {
    tryStartTtsRef.current = tryStartTts;
  }, [tryStartTts]);

  useEffect(() => {
    const chapterChanged = prevChapterIdInternalRef.current !== chapterId;
    const novelChanged = prevNovelIdInternalRef.current !== novelId;

    if (chapterChanged || novelChanged) {
      if (isManualTrackingRef.current) {
        void doFlushManualRef.current('chapter-change');
      }
      if (isTtsTrackingRef.current) {
        void doFlushTtsRef.current('chapter-change');
      }
      prevChapterIdInternalRef.current = chapterId;
      prevNovelIdInternalRef.current = novelId;

      if (chapterChangeTimerRef.current) {
        clearTimeout(chapterChangeTimerRef.current);
        chapterChangeTimerRef.current = null;
      }
      if (enabled && novelId != null && chapterId != null) {
        chapterChangeTimerRef.current = setTimeout(() => {
          chapterChangeTimerRef.current = null;
          if (ttsActiveRef.current) {
            tryStartTtsRef.current();
          } else if (
            appStateRef.current !== 'background' &&
            appStateRef.current !== 'inactive'
          ) {
            tryStartManualRef.current();
          }
        }, 0);
      }
    }
    // Cleanup only the timer for this chapter change, not on every dep churn
    return () => {
      // Do not clear here unless unmount; chapter-change timer is one-shot
    };
  }, [chapterId, novelId, enabled]);

  // Unmount cleanup for chapterChangeTimer
  useEffect(() => {
    return () => {
      if (chapterChangeTimerRef.current) {
        clearTimeout(chapterChangeTimerRef.current);
        chapterChangeTimerRef.current = null;
      }
    };
  }, []);

  // AppState listener (manual pauses in background, TTS continues)
  // Also tracks backgroundEnterAt for AUD-TIME-03 drift capping.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (next === 'background' || next === 'inactive') {
        backgroundEnterAtRef.current = Date.now();
        void doFlushManual(`appstate-${next}`);
      } else if (next === 'active' && prev !== 'active') {
        backgroundEnterAtRef.current = null;
        if (enabledRef.current && !ttsActiveRef.current) {
          tryStartManual();
        }
      }
    });
    return () => {
      sub.remove();
      clearInactivityTimer();
    };
  }, [clearInactivityTimer, doFlushManual, tryStartManual]);

  // Start on mount if eligible
  useEffect(() => {
    if (enabled && novelId != null && chapterId != null) {
      if (ttsActiveRef.current) {
        tryStartTts();
      } else if (
        appStateRef.current !== 'background' &&
        appStateRef.current !== 'inactive'
      ) {
        tryStartManual();
      }
    }
    return () => {
      void doFlushManual('unmount');
      void doFlushTts('unmount');
      clearInactivityTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Inactivity timeout change -> reschedule
  useEffect(() => {
    if (isManualTrackingRef.current) {
      scheduleInactivityTimer();
    }
  }, [inactivityTimeoutMs, scheduleInactivityTimer]);

  // AUD-TIME-04: Periodic checkpoint to limit loss on SIGKILL / LMK.
  // Inserts incremental sessions every CHECKPOINT_INTERVAL_MS and resets start,
  // so at most one interval is lost if the process is killed.
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      const now = Date.now();
      if (
        isManualTrackingRef.current &&
        manualStartTimeRef.current != null &&
        !ttsActiveRef.current
      ) {
        const lastActivity = lastActivityAtRef.current;
        if (
          lastActivity != null &&
          inactivityMsRef.current > 0 &&
          now - lastActivity >= inactivityMsRef.current
        ) {
          void doFlushManual('inactivity');
          return;
        }
        const dur = sanitizeDuration(now - manualStartTimeRef.current);
        if (dur >= CHECKPOINT_MIN_MS) {
          const nId = sessionManualNovelIdRef.current;
          const cId = sessionManualChapterIdRef.current;
          const start = manualStartTimeRef.current;
          // Reset before async to avoid double-count on next tick
          manualStartTimeRef.current = now;
          lastActivityAtRef.current = now;
          void persistSession(nId, cId, start, dur, 'manual', 'checkpoint');
        }
      }
      if (isTtsTrackingRef.current && ttsStartTimeRef.current != null) {
        const dur = sanitizeDuration(now - ttsStartTimeRef.current);
        if (dur >= CHECKPOINT_MIN_MS) {
          const nId = sessionTtsNovelIdRef.current;
          const cId = sessionTtsChapterIdRef.current;
          const start = ttsStartTimeRef.current;
          ttsStartTimeRef.current = now;
          void persistSession(nId, cId, start, dur, 'tts', 'checkpoint');
        }
      }
    }, CHECKPOINT_INTERVAL_MS);
    // @ts-ignore
    id.unref?.();
    checkpointIntervalRef.current = id;
    return () => {
      clearInterval(id);
      checkpointIntervalRef.current = null;
    };
  }, [doFlushManual, enabled, persistSession, sanitizeDuration]);

  // Poll TTS ref for changes that don't trigger re-render
  useEffect(() => {
    if (!isTTSActiveRef) return;
    const interval = setInterval(() => {
      const current = getIsTTSActive();
      if (current !== ttsActiveRef.current) {
        ttsActiveRef.current = current;
        if (current) {
          void doFlushManual('tts-active-poll');
          if (enabledRef.current) {
            tryStartTts();
          }
        } else {
          void doFlushTts('tts-inactive-poll');
          if (enabledRef.current) {
            if (
              appStateRef.current !== 'background' &&
              appStateRef.current !== 'inactive'
            ) {
              tryStartManual();
            }
          }
        }
      }
    }, 700);
    // @ts-ignore - NodeJS vs RN timeout types
    interval.unref?.();
    return () => clearInterval(interval);
  }, [
    getIsTTSActive,
    isTTSActiveRef,
    doFlushManual,
    doFlushTts,
    tryStartManual,
    tryStartTts,
  ]);

  return { recordActivity, flush };
}
