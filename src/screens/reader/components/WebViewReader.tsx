import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeEventEmitter,
  NativeModules,
  StatusBar,
  AppState,
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import WebView from 'react-native-webview';
import color from 'color';

import { useTheme, useChapterReaderSettings } from '@hooks/persisted';
import { getString } from '@strings/translations';

import { getPlugin } from '@plugins/pluginManager';
import { MMKVStorage, getMMKVObject } from '@utils/mmkv/mmkv';
import {
  CHAPTER_GENERAL_SETTINGS,
  CHAPTER_READER_SETTINGS,
  ChapterGeneralSettings,
  ChapterReaderSettings,
  initialChapterGeneralSettings,
  initialChapterReaderSettings,
} from '@hooks/persisted/useSettings';
import { getBatteryLevelSync } from 'react-native-device-info';
import TTSHighlight from '@services/TTSHighlight';
import TTSAudioManager from '@services/TTSAudioManager';
import devLogger from '../../../utils/devLogger';
import { PLUGIN_STORAGE } from '@utils/Storages';
import { useChapterContext } from '../ChapterContext';
import TTSResumeDialog from './TTSResumeDialog';
import TTSScrollSyncDialog from './TTSScrollSyncDialog';
import TTSManualModeDialog from './TTSManualModeDialog';
import TTSSyncDialog from './TTSSyncDialog';
import Toast from '@components/Toast';
import { useBoolean } from '@hooks';
import { extractParagraphs } from '@utils/htmlParagraphExtractor';
import { applyTtsUpdateToWebView } from './ttsHelpers';
import { shouldIgnoreSaveEvent } from './saveGuard';
import {
  getChapter as getChapterFromDb,
  resetChaptersProgress,
  getChaptersBetweenPositions,
  getMaxChapterPosition,
} from '@database/queries/ChapterQueries';

type WebViewPostEvent = {
  type: string;
  data?: { [key: string]: string | number } | string[];
  startIndex?: number;
  autoStartTTS?: boolean;
  paragraphIndex?: number;
  ttsState?: any;
  chapterId?: number;
};



type WebViewReaderProps = {
  onPress(): void;
};

const onLogMessage = (payload: { nativeEvent: { data: string } }) => {
  const dataPayload = JSON.parse(payload.nativeEvent.data);
  if (dataPayload) {
      if (dataPayload.type === 'console') {
        devLogger.info('[Console]', JSON.stringify(dataPayload.msg, null, 2));
    }
  }
};

const { RNDeviceInfo } = NativeModules;
const deviceInfoEmitter = new NativeEventEmitter(RNDeviceInfo);

const assetsUriPrefix = __DEV__
  ? 'http://localhost:8081/assets'
  : 'file:///android_asset';

// Global TTS position tracking for cross-chapter resume
const TTS_LAST_POSITION = 'TTS_LAST_POSITION';
interface TTSLastPosition {
  novelId: number;
  chapterId: number;
  chapterName: string;
  chapterPosition: number;
  paragraphIndex: number;
  timestamp: number;
}

const WebViewReader: React.FC<WebViewReaderProps> = ({ onPress }) => {
  const {
    novel,
    chapter,
    chapterText: html,
    navigateChapter,
    saveProgress,
    nextChapter,
    prevChapter,
    webViewRef,
    savedParagraphIndex,
    getChapter,
  } = useChapterContext();
  const theme = useTheme();
  const readerSettings = useMemo(
    () =>
      getMMKVObject<ChapterReaderSettings>(CHAPTER_READER_SETTINGS) ||
      initialChapterReaderSettings,
    // needed to preserve settings during chapter change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapter.id],
  );
  const chapterGeneralSettings = useMemo(
    () => {
      const defaults = initialChapterGeneralSettings;
      const stored = getMMKVObject<ChapterGeneralSettings>(CHAPTER_GENERAL_SETTINGS) || {};

      // Robust merge: Ensure defaults are preserved if stored value is undefined/missing
      const merged = { ...defaults, ...stored };

      // Explicitly ensure showParagraphHighlight is set (fallback to true)
      if (merged.showParagraphHighlight === undefined) {
        merged.showParagraphHighlight = defaults.showParagraphHighlight ?? true;
      }

      if (__DEV__) {
        devLogger.debug('[WebViewReader] Initial Settings:', JSON.stringify(defaults));
        devLogger.debug('[WebViewReader] Stored Settings:', JSON.stringify(stored));
        devLogger.debug('[WebViewReader] Merged Settings:', JSON.stringify(merged));
      }

      return merged;
    },
    // needed to preserve settings during chapter change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapter.id],
  );

  // FIX: Use a stable savedParagraphIndex that only updates when chapter changes.
  // This prevents the WebView from reloading (and resetting TTS) when progress is saved.
  // NEW: Also check MMKV for the absolute latest progress (covers background TTS/manual scroll)
  const initialSavedParagraphIndex = useMemo(
    () => {
      const mmkvIndex =
        MMKVStorage.getNumber(`chapter_progress_${chapter.id}`) ?? -1;
      const dbIndex = savedParagraphIndex ?? -1;
      devLogger.debug(
        `WebViewReader: Initializing scroll. DB: ${dbIndex}, MMKV: ${mmkvIndex}`,
      );
      return Math.max(dbIndex, mmkvIndex);
    },
    // CRITICAL FIX: Only calculate once per chapter to prevent WebView reloads
    // when progress is saved (which would update savedParagraphIndex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapter.id],
  );

  // NEW: Create a stable chapter object that doesn't update on progress changes
  // This prevents the WebView from reloading when we save progress
  const stableChapter = useMemo(
    () => ({
      ...chapter,
      // Ensure we use the initial values for these if needed, or just spread
      // The key is that this object reference (and its stringified version)
      // won't change unless chapter.id changes
    }),
    // Only update when chapter ID changes, not when progress/ttsState changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapter.id],
  );

  const batteryLevel = useMemo(() => getBatteryLevelSync(), []);
  const plugin = getPlugin(novel?.pluginId);
  const pluginCustomJS = `file://${PLUGIN_STORAGE}/${plugin?.id}/custom.js`;
  const pluginCustomCSS = `file://${PLUGIN_STORAGE}/${plugin?.id}/custom.css`;
  const nextChapterScreenVisible = useRef<boolean>(false);
  const autoStartTTSRef = useRef<boolean>(false);
  const isTTSReadingRef = useRef<boolean>(false);
  const ttsStateRef = useRef<any>(null);
  const progressRef = useRef(chapter.progress);
  // NEW: Track latest paragraph index to survive settings injections
  const latestParagraphIndexRef = useRef(savedParagraphIndex);
  // NEW: Track if we need to start TTS directly from RN (background mode)
  const backgroundTTSPendingRef = useRef<boolean>(false);
  // NEW: Track previous chapter ID to detect chapter changes
  const prevChapterIdRef = useRef<number>(chapter.id);
  // NEW: Grace period timestamp to ignore stale save events after chapter change
  const chapterTransitionTimeRef = useRef<number>(0);
  // NEW: Track if WebView is synchronized with current chapter
  // During background TTS, WebView may still have old chapter loaded
  const isWebViewSyncedRef = useRef<boolean>(true);
  // When screen wakes while WebView was suspended during background TTS,
  // mark that we need to run the screen-wake sync after the new HTML loads.
  const pendingScreenWakeSyncRef = useRef<boolean>(false);
  // NEW: Use a shared guard for pending deletion operations to make testing easier
  // Note: `deletionGuard` is a small runtime helper used to coordinate deletion state
  // across modules and tests.
   
  const deletionGuard = require('@utils/deletionGuard').default;
  // Guard ref used to ignore progress 'save' events while deletion/reset operations are in progress
  const pendingDeletionRef = useRef<boolean>(false);
  // If true we should resume native playback after we've synced UI
  const autoResumeAfterWakeRef = useRef<boolean>(false);
  // Remember if TTS was playing when screen woke
  const wasReadingBeforeWakeRef = useRef<boolean>(false);
  // CRITICAL FIX: Track the EXACT chapter ID and paragraph index at the moment of screen wake
  // These are used to verify we're resuming on the correct chapter after WebView reloads
  const wakeChapterIdRef = useRef<number | null>(null);
  const wakeParagraphIndexRef = useRef<number | null>(null);
  // BUG FIX: Track if wake transition is in progress to block stale events from updating refs
  // This prevents race conditions where onSpeechStart events mutate currentParagraphIndexRef
  // during the async pause/sync/resume sequence
  const wakeTransitionInProgressRef = useRef<boolean>(false);
  // BUG FIX: Capture the exact paragraph index at the moment of wake BEFORE any events can change it
  const capturedWakeParagraphIndexRef = useRef<number | null>(null);
  // BUG FIX: Track when user manually starts TTS to add grace period for onQueueEmpty
  // This prevents race conditions where queue isn't populated yet when onQueueEmpty fires
  const manualTTSStartTimeRef = useRef<number>(0);
  const MANUAL_TTS_GRACE_PERIOD = 3000; // 3 seconds grace period after manual TTS start

  // State for TTS sync dialog (shown when screen wakes and chapter mismatch occurs)
  const [syncDialogVisible, setSyncDialogVisible] = useState(false);
  const [syncDialogStatus, setSyncDialogStatus] = useState<'syncing' | 'success' | 'failed'>('syncing');
  const [syncDialogInfo, setSyncDialogInfo] = useState<{
    chapterName: string;
    paragraphIndex: number;
    totalParagraphs: number;
    progress: number;
  } | undefined>(undefined);
  // Track retry attempts to prevent infinite loops
  const syncRetryCountRef = useRef<number>(0);
  const MAX_SYNC_RETRIES = 2;

  // Cross-chapter TTS dialog state
  const [crossChapterDialogVisible, setCrossChapterDialogVisible] = useState(false);
  const [crossChapterInfo, setCrossChapterInfo] = useState<{
    lastChapter: TTSLastPosition;
    currentParagraphIndex: number;
  } | null>(null);

  // FIX: Refs to prevent stale closures in onQueueEmpty handler
  // The handler is created once (empty deps) but needs current values
  const nextChapterRef = useRef(nextChapter);
  const navigateChapterRef = useRef(navigateChapter);
  // Track total paragraphs for calculating percentage during background TTS
  const totalParagraphsRef = useRef<number>(0);

  useEffect(() => {
    progressRef.current = chapter.progress;
  }, [chapter.progress]);

  // NEW: Keep settings in refs to avoid stale closures in listeners
  const readerSettingsRef = useRef(readerSettings);
  const chapterGeneralSettingsRef = useRef(chapterGeneralSettings);

  useEffect(() => {
    readerSettingsRef.current = readerSettings;
    chapterGeneralSettingsRef.current = chapterGeneralSettings;
  }, [readerSettings, chapterGeneralSettings]);

  // Helper to save global TTS position when TTS stops/pauses
  const saveGlobalTTSPosition = useCallback(() => {
    if (currentParagraphIndexRef.current >= 0 && chapter.position !== undefined) {
      const position: TTSLastPosition = {
        novelId: novel.id,
        chapterId: chapter.id,
        chapterName: chapter.name,
        chapterPosition: chapter.position,
        paragraphIndex: currentParagraphIndexRef.current,
        timestamp: Date.now(),
      };
      MMKVStorage.set(TTS_LAST_POSITION, JSON.stringify(position));
      devLogger.debug('WebViewReader: Saved global TTS position:', position);
    }
  }, [chapter.id, chapter.name, chapter.position, novel.id]);

  // Helper to check if we should show cross-chapter dialog
  const checkCrossChapterTTS = useCallback((visibleParagraphIndex: number): boolean => {
    try {
      const lastPosStr = MMKVStorage.getString(TTS_LAST_POSITION);
      if (!lastPosStr) return false;

      const lastPos: TTSLastPosition = JSON.parse(lastPosStr);

      // Only check if same novel and current chapter is BEFORE last TTS position
      if (lastPos.novelId !== novel.id) return false;
      if (chapter.position === undefined || lastPos.chapterPosition === undefined) return false;
      if (chapter.position >= lastPos.chapterPosition) return false;

      // User is going back - show dialog
      setCrossChapterInfo({
        lastChapter: lastPos,
        currentParagraphIndex: visibleParagraphIndex,
      });
      setCrossChapterDialogVisible(true);
      return true;
    } catch (e) {
      devLogger.warn('WebViewReader: Error checking cross-chapter TTS:', e);
      return false;
    }
  }, [novel.id, chapter.position]);

  // Handle cross-chapter dialog: continue from last position
  const handleCrossChapterContinue = useCallback(() => {
    setCrossChapterDialogVisible(false);
    if (crossChapterInfo?.lastChapter) {
      // Prevent auto-start race: mark resume confirmation pending so any
      // incoming speak/tts-queue messages are deferred until the native dialog
      // has a chance to render and the user can choose.
      setResumePending();
      // Navigate to the last chapter
      getChapter({ id: crossChapterInfo.lastChapter.chapterId } as any);
    }
  }, [crossChapterInfo, getChapter]);

  // Handle cross-chapter dialog: start from current chapter (reset forward chapters)
  const handleCrossChapterRestart = useCallback(async () => {
    setCrossChapterDialogVisible(false);
    if (crossChapterInfo?.lastChapter && chapter.position !== undefined) {
      // Reset forward chapters based on setting
      const resetMode = chapterGeneralSettingsRef.current.ttsForwardChapterReset || 'reset-all';

      // Correlation id for this deletion operation
      const corrId = `delete_future_${Date.now()}`;
      devLogger.debug(`[TTS-DELETE] confirm restart from chapter ${chapter.id} pos ${chapter.position} corr=${corrId}`);
  devLogger.debug(`[TTS-DELETE] confirm restart from chapter ${chapter.id} pos ${chapter.position} corr=${corrId}`);

      // Prevent concurrent deletions / saves
      if (deletionGuard.isPending()) {
        devLogger.warn(`[TTS-DELETE] deletion already in progress corr=${corrId}, aborting`);
        devLogger.warn(`[TTS-DELETE] deletion already in progress corr=${corrId}, aborting`);
      } else {
        try {
          // mark as begun
          const started = deletionGuard.begin();
          if (!started) {
            devLogger.warn(`[TTS-DELETE] could not mark deletion start corr=${corrId}`);
            return;
          }

          // Signal that a deletion is pending so we can ignore in-page save events
          pendingDeletionRef.current = true;

          // Pause native TTS/refill to avoid race with refill/addToBatch
          try {
            devLogger.debug(`[TTS-DELETE] pausing TTS before deletion corr=${corrId}`);
              devLogger.debug(`[TTS-DELETE] pausing TTS before deletion corr=${corrId}`);
            // Use JS manager pause with timeout to avoid hanging
            const paused = await TTSAudioManager.pauseWithTimeout(1200);
            if (!paused) {
              devLogger.error(`[TTS-DELETE] failed to pause native TTS within timeout, aborting corr=${corrId}`);
              showToastMessage('Unable to pause TTS — aborting reset');
              deletionGuard.end();
              return;
            }
          } catch (e) {
            devLogger.warn('[TTS-DELETE] exception while pausing TTS before deletion', e);
          }

          // Prevent onQueueEmpty and refill handlers from acting during our operation
          try {
            TTSAudioManager.setRestartInProgress(true);
            TTSAudioManager.setRefillInProgress(true);
          } catch (e) {
            // ignore if not available
          }

          // Get list of chapters to reset and snapshot existing progress
          // If resetMode is 'reset-all' we should reset all chapters after the
          // current one (not just up to the last saved TTS chapter). Get the
          // maximum chapter position in that novel and use it as the upper limit.
          let toPosition = crossChapterInfo.lastChapter.chapterPosition;
          if (resetMode === 'reset-all') {
            try {
              const maxPos = await getMaxChapterPosition(novel.id);
              toPosition = Math.max(toPosition, maxPos);
            } catch (e) {
              devLogger.warn('[TTS-DELETE] failed to get max chapter position, falling back to saved chapter position', e);
            }
          }

          const chaptersToReset = await getChaptersBetweenPositions(
            novel.id,
            chapter.position,
            toPosition,
          );

          const backupEntries: Array<any> = [];
          for (const ch of chaptersToReset) {
            const mmkvVal = MMKVStorage.getNumber(`chapter_progress_${ch.id}`) ?? -1;
            // ch.progress may be available from DB query; include for backup
            backupEntries.push({ chapterId: ch.id, dbProgress: ch.progress ?? null, mmkvProgress: mmkvVal });
          }

          // Attempt to trim native/JS queues for those chapters before destructive ops
          try {
            const ids = chaptersToReset.map(c => String(c.id));
            TTSAudioManager.removeQueuedForChapterIds(ids);
            TTSAudioManager.clearRemainingQueue();
            // Also attempt native stop as a final guard
            try { await TTSHighlight.stop(); } catch (e) { /* ignore */ }
          } catch (e) {
            devLogger.warn('[TTS-DELETE] failed to trim TTS queues before deletion', e);
          }

          // Write backup to MMKV before deleting
          const backupKey = `progress_backup_${corrId}`;
          let backupOk = true;
          try {
            MMKVStorage.set(backupKey, JSON.stringify({ novelId: novel.id, timestamp: Date.now(), entries: backupEntries }));
            devLogger.debug(`[TTS-DELETE] backed up ${backupEntries.length} entries to ${backupKey} corr=${corrId}`);
            devLogger.debug(`[TTS-DELETE] backed up ${backupEntries.length} entries to ${backupKey} corr=${corrId}`);
          } catch (e) {
            backupOk = false;
            devLogger.warn(`[TTS-DELETE] failed to write backup ${backupKey}`, e);
          }

          if (!backupOk) {
            devLogger.error(`[TTS-DELETE] backup failed, aborting deletion corr=${corrId}`);
            showToastMessage('Failed to backup progress — aborting reset');
            try {
              if ((TTSHighlight as any).resume) {
                await (TTSHighlight as any).resume();
              }
            } catch (e) {
              // ignore resume errors
            }
            pendingDeletionRef.current = false;
            return;
          }

          // Perform DB-level reset
          await resetChaptersProgress(
            novel.id,
            chapter.position,
            toPosition,
            resetMode,
          );

          // Clear MMKV progress for those chapters
          let deletedCount = 0;
          for (const ch of chaptersToReset) {
            try {
              MMKVStorage.delete(`chapter_progress_${ch.id}`);
              deletedCount += 1;
            } catch (e) {
              devLogger.warn(`[TTS-DELETE] failed to delete MMKV for chapter ${ch.id} corr=${corrId}`, e);
            }
          }

          // Update global TTS position to current chapter
          const position: TTSLastPosition = {
            novelId: novel.id,
            chapterId: chapter.id,
            chapterName: chapter.name,
            chapterPosition: chapter.position,
            paragraphIndex: crossChapterInfo.currentParagraphIndex,
            timestamp: Date.now(),
          };
          MMKVStorage.set(TTS_LAST_POSITION, JSON.stringify(position));

          devLogger.debug(`[TTS-DELETE] deletion complete: removed ${deletedCount} MMKV entries corr=${corrId}`);
  devLogger.debug(`[TTS-DELETE] deletion complete: removed ${deletedCount} MMKV entries corr=${corrId}`);

          // Notify WebView (fire-and-forget) so UI can react — use safe JSON serialization
          try {
            const detail = JSON.stringify({ corrId, deleted: deletedCount });
            webViewRef.current?.injectJavaScript(`window.dispatchEvent(new CustomEvent('progress:deleted', { detail: ${detail} })); true;`);
          } catch (e) {
            // ignore
          }

          // Start TTS from current paragraph
          webViewRef.current?.injectJavaScript(
            `tts.startFromIndex(${crossChapterInfo.currentParagraphIndex})`
          );
          // Clear restart/refill flags now that operation is complete
          try {
            TTSAudioManager.setRefillInProgress(false);
            TTSAudioManager.setRestartInProgress(false);
          } catch (e) {
            // ignore
          }
        } catch (err) {
          devLogger.error('[TTS-DELETE] error during deletion flow', err);
            devLogger.error('[TTS-DELETE] error during deletion flow', err);
          } finally {
          // Clear the pending flag even if deletion failed or errored
          pendingDeletionRef.current = false;
          deletionGuard.end();
        }
      }
    }
  // showToastMessage is stable (useCallback) and intentionally omitted
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crossChapterInfo, chapter, novel.id, webViewRef, deletionGuard]);

  // Listen to live settings changes using the persisted hook; this will react
  // to changes coming from the settings screen and notify the WebView.
  const { tts: liveReaderTts } = useChapterReaderSettings();

  useEffect(() => {
    if (liveReaderTts) {
      // Check if voice/rate/pitch actually changed
      const oldTts = readerSettingsRef.current.tts;
      const voiceChanged = oldTts?.voice?.identifier !== liveReaderTts.voice?.identifier;
      const rateChanged = oldTts?.rate !== liveReaderTts.rate;
      const pitchChanged = oldTts?.pitch !== liveReaderTts.pitch;
      const settingsChanged = voiceChanged || rateChanged || pitchChanged;

      // Update our ref so other listeners will use the latest settings
      readerSettingsRef.current = { ...readerSettingsRef.current, tts: liveReaderTts } as any;
      applyTtsUpdateToWebView(liveReaderTts, webViewRef);

      // BUG 1 FIX: If TTS is actively reading and voice/rate/pitch changed,
      // restart playback from current position with new settings
      if (settingsChanged && isTTSReadingRef.current && currentParagraphIndexRef.current >= 0) {
        devLogger.debug('WebViewReader: TTS settings changed while playing, restarting with new settings');
  devLogger.debug('WebViewReader: TTS settings changed while playing, restarting with new settings');

        // CRITICAL: Set restart flag BEFORE stopping to prevent onQueueEmpty from firing
        TTSHighlight.setRestartInProgress(true);

        // Stop current playback
        TTSHighlight.stop();

        // Get current paragraph index and restart
        const idx = currentParagraphIndexRef.current;
        const paragraphs = extractParagraphs(html);

        if (paragraphs && paragraphs.length > idx) {
          const remaining = paragraphs.slice(idx);
          const ids = remaining.map((_, i) => `chapter_${chapter.id}_utterance_${idx + i}`);

          // Update TTS queue ref
          ttsQueueRef.current = {
            texts: remaining,
            startIndex: idx,
          };

          // Start batch playback with new settings
          // NOTE: speakBatch will clear restartInProgress on success
          TTSHighlight.speakBatch(remaining, ids, {
            voice: liveReaderTts.voice?.identifier,
            pitch: liveReaderTts.pitch || 1,
            rate: liveReaderTts.rate || 1,
          })
            .then(() => {
              devLogger.debug('WebViewReader: TTS restarted with new settings from index', idx);
                devLogger.debug('WebViewReader: TTS restarted with new settings from index', idx);
              isTTSReadingRef.current = true;
            })
            .catch(err => {
              devLogger.error('WebViewReader: Failed to restart TTS with new settings', err);
                devLogger.error('WebViewReader: Failed to restart TTS with new settings', err);
              isTTSReadingRef.current = false;
              // Clear restart flag on failure too
              TTSHighlight.setRestartInProgress(false);
            });
        } else {
          // No paragraphs available, clear the restart flag
          TTSHighlight.setRestartInProgress(false);
        }
      }
    }
  }, [liveReaderTts, webViewRef, html, chapter.id]);

  // FIX: Keep navigation refs synced to prevent stale closures in onQueueEmpty
  useEffect(() => {
    nextChapterRef.current = nextChapter;
    navigateChapterRef.current = navigateChapter;
  }, [nextChapter, navigateChapter]);

  // NEW: Effect to handle background TTS next chapter navigation
  // When chapter changes AND we have a pending background TTS request,
  // extract paragraphs from HTML and start TTS directly from RN
  useEffect(() => {
    // Check if chapter actually changed
    if (chapter.id === prevChapterIdRef.current) {
      return;
    }

    devLogger.debug(`WebViewReader: Chapter changed from ${prevChapterIdRef.current} to ${chapter.id}`);
      devLogger.debug(`WebViewReader: Chapter changed from ${prevChapterIdRef.current} to ${chapter.id}`);
    prevChapterIdRef.current = chapter.id;

    // Set grace period timestamp to ignore stale save events from old chapter
    chapterTransitionTimeRef.current = Date.now();

    // Instead of unconditionally resetting paragraph indexes to 0 (which can
    // race with native TTS events and cause the UI to jump to paragraph 0
    // after a background advance), initialise them from the most recent
    // persisted or TTS state we have available.
    const mmkvIndex = MMKVStorage.getNumber(`chapter_progress_${chapter.id}`) ?? -1;
    const dbIndex = savedParagraphIndex ?? -1;
    let ttsStateIndex = -1;
    try {
      ttsStateIndex = stableChapter.ttsState ? (JSON.parse(stableChapter.ttsState).paragraphIndex ?? -1) : -1;
    } catch (e) {
      ttsStateIndex = -1;
    }

    const initialIndex = Math.max(dbIndex, mmkvIndex, ttsStateIndex, -1);

    // Use -1 to mark "unknown" — caller checks >= 0 before acting.
    currentParagraphIndexRef.current = initialIndex >= 0 ? initialIndex : -1;
    latestParagraphIndexRef.current = initialIndex >= 0 ? initialIndex : -1;

    // Clear the old TTS queue since we're on a new chapter.
    ttsQueueRef.current = null;

    // Check if we need to start TTS directly (background mode)
    if (backgroundTTSPendingRef.current && html) {
      devLogger.debug('WebViewReader: Background TTS pending, starting directly from RN');
        devLogger.debug('WebViewReader: Background TTS pending, starting directly from RN');
      backgroundTTSPendingRef.current = false;

      // CRITICAL: Mark WebView as NOT synced - it still has old chapter's HTML
      // This prevents us from trying to inject JS into the wrong chapter context
      isWebViewSyncedRef.current = false;

      // Extract paragraphs from HTML
      const paragraphs = extractParagraphs(html);
      // Update totalParagraphsRef for percentage calculation in onSpeechDone
      totalParagraphsRef.current = paragraphs.length;
      devLogger.debug(`WebViewReader: Extracted ${paragraphs.length} paragraphs for background TTS`);
  devLogger.debug(`WebViewReader: Extracted ${paragraphs.length} paragraphs for background TTS`);

      if (paragraphs.length > 0) {
        // Start from any previously known index if available (for example
        // when background advance already progressed the native TTS inside
        // the new chapter). Otherwise start at 0.
        const startIndex = Math.max(0, currentParagraphIndexRef.current ?? 0);

        // Only queue the paragraphs that remain to be spoken starting at
        // startIndex — prevents restarting from 0 when we already progressed.
        const textsToSpeak = paragraphs.slice(startIndex);
        // Create utterance IDs with chapter ID to prevent stale event processing
        const utteranceIds = textsToSpeak.map((_, i) => `chapter_${chapter.id}_utterance_${startIndex + i}`);

        // Update TTS queue ref so event handlers know where the batch starts
        ttsQueueRef.current = {
          startIndex: startIndex,
          texts: textsToSpeak,
        };

        // Start from the resolved startIndex (may be > 0)
        currentParagraphIndexRef.current = startIndex;

        // DON'T call stop() here - it would release the foreground service
        // which we can't restart from background in Android 12+
        // Just call speakBatch which will QUEUE_FLUSH the old items

        // Start batch TTS (this will flush old queue and start new one)
        // If there are no remaining paragraphs (e.g. we already reached the
        // end), don't call speakBatch. Otherwise dispatch the slice.
        if (textsToSpeak.length > 0) {
          TTSHighlight.speakBatch(textsToSpeak, utteranceIds, {
            voice: readerSettingsRef.current.tts?.voice?.identifier,
            pitch: readerSettingsRef.current.tts?.pitch || 1,
            rate: readerSettingsRef.current.tts?.rate || 1,
          })
            .then(() => {
              devLogger.debug('WebViewReader: Background TTS batch started successfully');
              // CRITICAL FIX: Ensure isTTSReadingRef is true so onQueueEmpty can trigger next chapter
              isTTSReadingRef.current = true;
            })
            .catch(err => {
              devLogger.error('WebViewReader: Background TTS batch failed:', err);
              isTTSReadingRef.current = false;
            });
        } else {
          devLogger.warn('WebViewReader: No paragraphs extracted from HTML');
          isTTSReadingRef.current = false;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.id, html]);

  const memoizedHTML = useMemo(() => {
    return `
      <!DOCTYPE html>
      <html lang="en" style="background-color: ${readerSettings.theme}">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <link rel="stylesheet" href="${assetsUriPrefix}/css/index.css">
          <link rel="stylesheet" href="${assetsUriPrefix}/css/pageReader.css">
          <link rel="stylesheet" href="${assetsUriPrefix}/css/toolWrapper.css">
          <link rel="stylesheet" href="${assetsUriPrefix}/css/tts.css">
          <style>
            :root {
              --StatusBar-currentHeight: ${StatusBar.currentHeight}px;
              --readerSettings-theme: ${readerSettings.theme};
              --readerSettings-padding: ${readerSettings.padding}px;
              --readerSettings-textSize: ${readerSettings.textSize}px;
              --readerSettings-textColor: ${readerSettings.textColor};
              --readerSettings-textAlign: ${readerSettings.textAlign};
              --readerSettings-lineHeight: ${readerSettings.lineHeight};
              --readerSettings-fontFamily: ${readerSettings.fontFamily};
              --theme-primary: ${theme.primary};
              --theme-onPrimary: ${theme.onPrimary};
              --theme-secondary: ${theme.secondary};
              --theme-tertiary: ${theme.tertiary};
              --theme-onTertiary: ${theme.onTertiary};
              --theme-onSecondary: ${theme.onSecondary};
              --theme-surface: ${theme.surface};
              --theme-surface-0-9: ${color(theme.surface)
        .alpha(0.9)
        .toString()};
              --theme-onSurface: ${theme.onSurface};
              --theme-surfaceVariant: ${theme.surfaceVariant};
              --theme-onSurfaceVariant: ${theme.onSurfaceVariant};
              --theme-outline: ${theme.outline};
              --theme-rippleColor: ${theme.rippleColor};
            }
            @font-face {
              font-family: ${readerSettings.fontFamily};
              src: url("file:///android_asset/fonts/${readerSettings.fontFamily}.ttf");
            }
          </style>
          <link rel="stylesheet" href="${pluginCustomCSS}">
          <style>
            ${readerSettings.customCSS}
          </style>
        </head>
        <body class="${chapterGeneralSettings.pageReader ? 'page-reader' : ''}">
          <div class="transition-chapter" style="transform: translateX(0%);${chapterGeneralSettings.pageReader ? '' : 'display: none'}">
            ${stableChapter.name}
          </div>
          <div id="LNReader-chapter">
            ${html}
          </div>
          <div id="reader-ui"></div>
        </body>
        <script>
          var initialPageReaderConfig = ${JSON.stringify({
          nextChapterScreenVisible: false,
        })};


          var initialReaderConfig = ${JSON.stringify({
          readerSettings,
          chapterGeneralSettings,
          novel,
          chapter: stableChapter,
          nextChapter,
          prevChapter,
          batteryLevel,
          autoSaveInterval: 2222,
          DEBUG: __DEV__,
          strings: {
            finished: `${getString('readerScreen.finished')}: ${stableChapter.name.trim()}`,
            nextChapter: getString('readerScreen.nextChapter', {
              name: nextChapter?.name,
            }),
            noNextChapter: getString('readerScreen.noNextChapter'),
          },
          savedParagraphIndex: initialSavedParagraphIndex ?? -1,
          ttsRestoreState: stableChapter.ttsState
            ? JSON.parse(stableChapter.ttsState)
            : null,
          ttsButtonPosition: MMKVStorage.getString('tts_button_position')
            ? JSON.parse(MMKVStorage.getString('tts_button_position')!)
            : null,
        })}
        </script>
        <script src="${assetsUriPrefix}/js/polyfill-onscrollend.js"></script>
        <script src="${assetsUriPrefix}/js/icons.js"></script>
        <script src="${assetsUriPrefix}/js/van.js"></script>
        <script src="${assetsUriPrefix}/js/text-vibe.js"></script>
        <script src="${assetsUriPrefix}/js/core.js"></script>
        <script src="${assetsUriPrefix}/js/index.js"></script>
        <script src="${pluginCustomJS}"></script>
        <script>
          ${readerSettings.customJS}
        </script>
      </html>
    `;
  }, [
    readerSettings,
    chapterGeneralSettings,
    stableChapter,
    html,
    novel,
    nextChapter,
    prevChapter,
    batteryLevel,
    initialSavedParagraphIndex,
    pluginCustomCSS,
    pluginCustomJS,
    theme,
  ]);

  const resumeTTS = (storedState: any) => {
    webViewRef.current?.injectJavaScript(`
      window.tts.restoreState({ 
        shouldResume: true,
        paragraphIndex: ${storedState.paragraphIndex},
        autoStart: true
      });
      true;
    `);
  };

  const {
    value: resumeDialogVisible,
    setTrue: showResumeDialog,
    setFalse: hideResumeDialog,
  } = useBoolean();

  const {
    value: scrollSyncDialogVisible,
    setTrue: showScrollSyncDialog,
    setFalse: hideScrollSyncDialog,
  } = useBoolean();

  const {
    value: manualModeDialogVisible,
    setTrue: showManualModeDialog,
    setFalse: hideManualModeDialog,
  } = useBoolean();

  const {
    value: toastVisible,
    setTrue: showToast,
    setFalse: hideToast,
  } = useBoolean();

  const pendingResumeIndexRef = useRef<number>(-1);
  const resumeDialogPendingRef = useRef<boolean>(false);
  const deferredSpeakQueueRef = useRef<Array<{ text: string; paragraphIndex: number | undefined }>>([]);
  const resumePendingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Generation token protects against timeout races when setResumePending
  // is called multiple times in quick succession.
  const resumePendingGenerationRef = useRef<number>(0);
  const RESUME_PENDING_TIMEOUT_MS = 15000; // safety fallback

  const setResumePending = () => {
    resumeDialogPendingRef.current = true;
    // increment generation token and schedule a safety timeout
    resumePendingGenerationRef.current += 1;
    const gen = resumePendingGenerationRef.current;
    if (resumePendingTimeoutRef.current) clearTimeout(resumePendingTimeoutRef.current);
    resumePendingTimeoutRef.current = setTimeout(() => {
      // only act if this timeout corresponds to the latest generation
      if (resumePendingGenerationRef.current !== gen) return;
      devLogger.warn('WebViewReader: resumeDialogPendingRef timeout — clearing');
      resumeDialogPendingRef.current = false;
      resumePendingTimeoutRef.current = null;
      // drop any deferred items to avoid stale state
      deferredSpeakQueueRef.current = [];
      ttsQueueRef.current = null;
    }, RESUME_PENDING_TIMEOUT_MS);
  };

  const clearResumePending = () => {
    resumeDialogPendingRef.current = false;
    // bump generation so any outstanding timeout becomes a no-op
    resumePendingGenerationRef.current += 1;
    if (resumePendingTimeoutRef.current) {
      clearTimeout(resumePendingTimeoutRef.current);
      resumePendingTimeoutRef.current = null;
    }
  };
  const ttsScrollPromptDataRef = useRef<{
    currentIndex: number;
    visibleIndex: number;
    isResume?: boolean;
  } | null>(null);
  const toastMessageRef = useRef<string>('');
  // Guard used to ignore WebView save events while a deletion/reset is in progress

  // NEW: TTS Queue for background playback
  const ttsQueueRef = useRef<{ startIndex: number; texts: string[] } | null>(
    null,
  );
  const currentParagraphIndexRef = useRef<number>(-1);

  /**
   * Track how many additional chapters have been auto-played in this TTS session.
   * This is used to enforce the ttsContinueToNextChapter limit (5, 10, or continuous).
   * Reset when user manually starts TTS or navigates to a different chapter.
   */
  const chaptersAutoPlayedRef = useRef<number>(0);

  const handleResumeConfirm = async () => {
    // Always set both refs to the last read paragraph before resuming
    const mmkvValue = MMKVStorage.getNumber(`chapter_progress_${chapter.id}`) ?? -1;
    const refValue = latestParagraphIndexRef.current ?? -1;
    const savedIndex = pendingResumeIndexRef.current;
    // Pick the highest index as the last read paragraph
    const lastReadParagraph = Math.max(refValue, mmkvValue, savedIndex);
    // Ensure both refs are updated
    pendingResumeIndexRef.current = lastReadParagraph;
    latestParagraphIndexRef.current = lastReadParagraph;
    // Confirm resume dialog always appears (showResumeDialog is called on request-tts-confirmation)
    const ttsState = chapter.ttsState ? JSON.parse(chapter.ttsState) : {};
    devLogger.debug(
      'WebViewReader: Resuming TTS. Resolved index:',
      lastReadParagraph,
      '(Ref:',
      refValue,
      'MMKV:',
      mmkvValue,
      'Prop:',
      savedIndex,
      ')',
    );
    resumeTTS({
      ...ttsState,
      paragraphIndex: lastReadParagraph,
      autoStart: true,
      shouldResume: true,
    });

    // Process any deferred speaks/queues that were held while waiting for the user
    try {
      // Drain speak queue (in-order)
      while (deferredSpeakQueueRef.current && deferredSpeakQueueRef.current.length > 0) {
        const dsp = deferredSpeakQueueRef.current.shift()!;
        // best-effort speak; await so we don't flood native TTS
         
        await TTSHighlight.speak(dsp.text, {
          voice: readerSettingsRef.current.tts?.voice?.identifier,
          pitch: readerSettingsRef.current.tts?.pitch || 1,
          rate: readerSettingsRef.current.tts?.rate || 1,
          utteranceId: dsp.paragraphIndex !== undefined ? `chapter_${chapter.id}_utterance_${dsp.paragraphIndex}` : undefined,
        }).catch(e => devLogger.warn('WebViewReader: deferred speak failed', e));
      }

      if (ttsQueueRef.current && ttsQueueRef.current.texts.length > 0) {
        const q = ttsQueueRef.current;
        const ids = q.texts.map((_, i) => `chapter_${chapter.id}_utterance_${q.startIndex + i}`);
        try {
          await TTSHighlight.addToBatch(q.texts, ids);
        } catch (e) {
          devLogger.warn('WebViewReader: deferred addToBatch failed, falling back to webview', e);
          webViewRef.current?.injectJavaScript('tts.next?.()');
        }
        ttsQueueRef.current = null;
      }
    } catch (e) {
      devLogger.warn('WebViewReader: error processing deferred TTS items', e);
    } finally {
      clearResumePending();
    }
  };

  const handleResumeCancel = () => {
    // User said No, so we tell TTS to mark as "resumed" (skipped) and start normally
    webViewRef.current?.injectJavaScript(`
      window.tts.hasAutoResumed = true;
      window.tts.start();
    `);
    // user cancelled resume — drop any deferred playback payloads
    deferredSpeakQueueRef.current = [];
    ttsQueueRef.current = null;
    // ensure pending timeouts/generation are cleared
    clearResumePending();
  };

  const handleRestartChapter = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
            (function() {
                const elements = window.reader.getReadableElements();
                if (elements && elements.length > 0) {
                    window.tts.start(elements[0]);
                } else {
                    window.tts.start();
                }
            })();
        `);
    }
    hideResumeDialog();
  };

  const handleTTSScrollSyncConfirm = () => {
    if (ttsScrollPromptDataRef.current) {
      const { visibleIndex, isResume } = ttsScrollPromptDataRef.current;
      // Change TTS position to the visible paragraph
      webViewRef.current?.injectJavaScript(`
        if (window.tts && window.tts.changeParagraphPosition) {
          window.tts.changeParagraphPosition(${visibleIndex});
          ${isResume ? 'window.tts.resume(true);' : ''}
        }
        true;
      `);
    }
    ttsScrollPromptDataRef.current = null;
  };

  const handleTTSScrollSyncCancel = useCallback(() => {
    if (ttsScrollPromptDataRef.current) {
      const { isResume } = ttsScrollPromptDataRef.current;
      if (isResume) {
        // User chose to resume from original position
        webViewRef.current?.injectJavaScript(`
          if (window.tts && window.tts.resume) {
            window.tts.resume(true);
          }
          true;
        `);
      }
    }
    ttsScrollPromptDataRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showToast]);

  const handleStopTTS = () => {
    // Stop TTS and switch to manual reading mode - inform JavaScript first
    webViewRef.current?.injectJavaScript(`
      if (window.tts && window.tts.handleManualModeDialog) {
        window.tts.handleManualModeDialog('stop');
      }
      true;
    `);
    TTSHighlight.stop();
    showToastMessage('Switched to manual reading mode');
    hideManualModeDialog();
  };

  // Cleanup any pending resume timeout and queues on unmount
  useEffect(() => {
    return () => {
      if (resumePendingTimeoutRef.current) {
        clearTimeout(resumePendingTimeoutRef.current);
        resumePendingTimeoutRef.current = null;
      }
      // clear any deferred queues on unmount
      deferredSpeakQueueRef.current = [];
      ttsQueueRef.current = null;
      // bump generation so any outstanding timeouts are no-ops
      resumePendingGenerationRef.current += 1;
    };
  }, []);

  const handleContinueFollowing = () => {
    // Continue with TTS following mode - inform JavaScript to resume from locked position
    webViewRef.current?.injectJavaScript(`
      if (window.tts && window.tts.handleManualModeDialog) {
        window.tts.handleManualModeDialog('continue');
      }
      true;
    `);
    hideManualModeDialog();
  };

  const showToastMessage = useCallback((message: string) => {
    toastMessageRef.current = message;
    showToast();
  }, [showToast]);

  useEffect(() => {
    const onSpeechDoneSubscription = TTSHighlight.addListener(
      'onSpeechDone',
      () => {
        // Try to play next from queue first (Background/Robust Mode)
        // CRITICAL: Only use queue logic if background playback is actually enabled
        // Otherwise fall through to WebView-driven mode even if ttsQueueRef exists
        if (
          chapterGeneralSettingsRef.current.ttsBackgroundPlayback &&
          ttsQueueRef.current &&
          currentParagraphIndexRef.current >= 0
        ) {
          const nextIndex = currentParagraphIndexRef.current + 1;
          const queueStartIndex = ttsQueueRef.current.startIndex;
          const queueEndIndex =
            queueStartIndex + ttsQueueRef.current.texts.length;

          if (nextIndex >= queueStartIndex && nextIndex < queueEndIndex) {
            devLogger.debug('WebViewReader: Playing from queue. Index:', nextIndex);

            // Update refs
            currentParagraphIndexRef.current = nextIndex;

            // Sync State (Critical for Resume/Pause)
            if (ttsStateRef.current) {
              ttsStateRef.current = {
                ...ttsStateRef.current,
                paragraphIndex: nextIndex,
                timestamp: Date.now(),
              };
            }

            // Persist Progress (Critical for App Kill/Restart)
            // BUG FIX: Calculate percentage dynamically using totalParagraphsRef
            // instead of stale progressRef which doesn't update during background TTS
            const percentageByCount = totalParagraphsRef.current > 0
              ? Math.round(((nextIndex + 1) / totalParagraphsRef.current) * 100)
              : progressRef.current ?? 0;
            // Apply "highest wins" rule to prevent lowering progress
            const finalPercentage = Math.max(percentageByCount, progressRef.current ?? 0);
            saveProgress(finalPercentage, nextIndex);

            // In batch mode, we DO NOT call speak() here because the native queue
            // is already playing the next item. Calling speak() would flush the queue!
            // We only need to update the UI and state.
            // (This path is only reached when background playback is enabled)

            // Sync WebView UI & Logic (fire and forget)
            // Added 'true;' and console logs for debugging
            // CRITICAL: Pass chapter ID to prevent stale events from wrong chapter
            // CRITICAL: Only inject JS if WebView is synced with current chapter
            if (webViewRef.current && isWebViewSyncedRef.current) {
              const currentChapterId = prevChapterIdRef.current;
                webViewRef.current.injectJavaScript(`
                  try {
                    if (window.tts) {
                      console.debug('TTS: Syncing state to index ${nextIndex}');
                      window.tts.highlightParagraph(${nextIndex}, ${currentChapterId});
                      window.tts.updateState(${nextIndex}, ${currentChapterId});
                    } else {
                      console.warn('TTS: window.tts not found during sync');
                    }
                  } catch (e) {
                    console.error('TTS: Error syncing state:', e);
                  }
                  true;
                `);
            } else if (!isWebViewSyncedRef.current) {
              // WebView is not synced (background mode) - skip injection but log
              devLogger.debug(`WebViewReader: Skipping WebView sync (background mode) - index ${nextIndex}`);
            } else {
              devLogger.warn(
                'WebViewReader: webViewRef is null during queue playback',
              );
            }
            return;
          }
        }

        // Fallback to WebView driven (Foreground Mode)
        // This is used when:
        // 1. Background playback is disabled (normal single-utterance mode)
        // 2. Queue is exhausted
        // 3. No queue exists
        devLogger.debug('WebViewReader: onSpeechDone - calling tts.next()');
        webViewRef.current?.injectJavaScript('tts.next?.()');
      },
    );

    // Listen for native word-range updates to drive in-page highlighting
    const rangeSubscription = TTSHighlight.addListener('onWordRange', (event) => {
      try {
        const utteranceId = event?.utteranceId || '';
        let paragraphIndex = currentParagraphIndexRef.current ?? -1;

        // Parse utterance ID - may be "chapter_123_utterance_5" or legacy "utterance_5"
        if (typeof utteranceId === 'string') {
          // Check for chapter-aware format first
          const chapterMatch = utteranceId.match(/chapter_(\d+)_utterance_(\d+)/);
          if (chapterMatch) {
            const eventChapterId = Number(chapterMatch[1]);
            // CRITICAL: Ignore events from old chapters to prevent paragraph sync issues
            if (eventChapterId !== prevChapterIdRef.current) {
              devLogger.debug(`WebViewReader: Ignoring stale onWordRange from chapter ${eventChapterId}, current is ${prevChapterIdRef.current}`);
              return;
            }
            paragraphIndex = Number(chapterMatch[2]);
          } else {
            // Legacy format
            const m = utteranceId.match(/utterance_(\d+)/);
            if (m) paragraphIndex = Number(m[1]);
          }
        }

        const start = Number(event?.start) || 0;
        const end = Number(event?.end) || 0;

        // CRITICAL: Only inject JS if WebView is synced with current chapter
        if (webViewRef.current && paragraphIndex >= 0 && isWebViewSyncedRef.current) {
          webViewRef.current.injectJavaScript(`
              try {
                if (window.tts && window.tts.highlightRange) {
                  window.tts.highlightRange(${paragraphIndex}, ${start}, ${end});
                }
              } catch (e) { console.error('TTS: highlightRange inject failed', e); }
              true;
            `);
        }
        // Skip logging for word range to reduce spam
      } catch (e) {
        devLogger.warn('WebViewReader: onWordRange handler error', e);
      }
    });

    // Listen for utterance start to ensure paragraph highlight and state are synced
    const startSubscription = TTSHighlight.addListener('onSpeechStart', (event) => {
      try {
        // BUG FIX: Block events during wake transition to prevent ref mutation
        // This prevents race conditions where late events update currentParagraphIndexRef
        // during the async pause/sync/resume sequence
        if (wakeTransitionInProgressRef.current) {
          devLogger.debug('WebViewReader: Ignoring onSpeechStart during wake transition');
          return;
        }

        const utteranceId = event?.utteranceId || '';
        let paragraphIndex = currentParagraphIndexRef.current ?? -1;

        // Parse utterance ID - may be "chapter_123_utterance_5" or legacy "utterance_5"
        if (typeof utteranceId === 'string') {
          // Check for chapter-aware format first
          const chapterMatch = utteranceId.match(/chapter_(\d+)_utterance_(\d+)/);
          if (chapterMatch) {
            const eventChapterId = Number(chapterMatch[1]);
            // CRITICAL: Ignore events from old chapters to prevent paragraph sync issues
            if (eventChapterId !== prevChapterIdRef.current) {
              devLogger.debug(`WebViewReader: Ignoring stale onSpeechStart from chapter ${eventChapterId}, current is ${prevChapterIdRef.current}`);
              return;
            }
            paragraphIndex = Number(chapterMatch[2]);
          } else {
            // Legacy format
            const m = utteranceId.match(/utterance_(\d+)/);
            if (m) paragraphIndex = Number(m[1]);
          }
        }

        // Update current index
        if (paragraphIndex >= 0) currentParagraphIndexRef.current = paragraphIndex;

        // CRITICAL: Only inject JS if WebView is synced with current chapter
        if (webViewRef.current && paragraphIndex >= 0 && isWebViewSyncedRef.current) {
          // CRITICAL: Pass chapter ID to prevent stale events from wrong chapter
          const currentChapterId = prevChapterIdRef.current;
          webViewRef.current.injectJavaScript(`
              try {
                if (window.tts) {
                  window.tts.highlightParagraph(${paragraphIndex}, ${currentChapterId});
                  window.tts.updateState(${paragraphIndex}, ${currentChapterId});
                }
              } catch (e) { console.error('TTS: start inject failed', e); }
              true;
            `);
        }
        // Log periodically for background mode (every 10 paragraphs)
        if (!isWebViewSyncedRef.current && paragraphIndex % 10 === 0) {
          devLogger.debug(`WebViewReader: Background TTS progress - paragraph ${paragraphIndex}`);
        }
      } catch (e) {
        devLogger.warn('WebViewReader: onSpeechStart handler error', e);
      }
    });

    // Listen for native TTS queue becoming empty (all utterances spoken).
    // This fires when the screen is off and WebView JS can't drive the next chapter.
    // We use this to trigger chapter navigation from React Native side.
    const queueEmptySubscription = TTSHighlight.addListener('onQueueEmpty', () => {
      devLogger.debug('WebViewReader: onQueueEmpty event received');

      // BUG FIX: Don't proceed if a restart operation is in progress
      // This prevents false chapter navigation during settings change restarts
      if (TTSHighlight.isRestartInProgress()) {
        devLogger.debug('WebViewReader: Queue empty ignored - restart in progress');
        return;
      }

      // BUG FIX: Don't proceed if a refill operation is in progress
      // This prevents premature chapter navigation when async refill is still running
      if (TTSHighlight.isRefillInProgress()) {
        devLogger.debug('WebViewReader: Queue empty ignored - refill in progress');
        return;
      }

      // BUG FIX: Don't proceed if TTS was manually started recently
      // This prevents race conditions where the native queue hasn't been fully populated yet
      // (addToBatch is async and may not complete before first utterance finishes)
      const timeSinceManualStart = Date.now() - manualTTSStartTimeRef.current;
      if (timeSinceManualStart < MANUAL_TTS_GRACE_PERIOD) {
        devLogger.debug(`WebViewReader: Queue empty ignored - manual TTS start grace period (${timeSinceManualStart}ms ago)`);
        return;
      }

      // Only proceed if TTS was actually reading (and thus chapter end is meaningful)
      if (!isTTSReadingRef.current) {
        devLogger.debug('WebViewReader: Queue empty but TTS was not reading, ignoring');
        return;
      }

      // Check the ttsContinueToNextChapter setting
      const continueMode = chapterGeneralSettingsRef.current.ttsContinueToNextChapter || 'none';
      devLogger.debug('WebViewReader: Queue empty - continueMode:', continueMode);

      if (continueMode === 'none') {
        devLogger.debug('WebViewReader: ttsContinueToNextChapter is "none", stopping');
        isTTSReadingRef.current = false;
        return;
      }

      // Check chapter limit
      if (continueMode !== 'continuous') {
        const limit = parseInt(continueMode, 10);
        if (chaptersAutoPlayedRef.current >= limit) {
          devLogger.debug(`WebViewReader: Chapter limit (${limit}) reached, stopping`);
          chaptersAutoPlayedRef.current = 0;
          isTTSReadingRef.current = false;
          return;
        }
      }

      // If we have a next chapter, navigate to it
      // FIX: Use refs to get current values (avoid stale closure from empty deps)
      if (nextChapterRef.current) {
        devLogger.debug('WebViewReader: Navigating to next chapter via onQueueEmpty');

        // BUG FIX: Save chapter completion when TTS queue empties and requests next chapter
        // This ensures chapters are marked as read even when screen is off
        const currentProgress = progressRef.current ?? 0;
        saveProgress(
          100, // Mark chapter as complete
          undefined, // No need to save paragraph index as we're moving to next chapter
          ttsStateRef.current ? JSON.stringify({
            ...ttsStateRef.current,
            timestamp: Date.now(),
          }) : undefined
        );
        devLogger.debug(`WebViewReader: Saved chapter completion progress via onQueueEmpty (was ${currentProgress}%, now 100%)`);

        autoStartTTSRef.current = true;
        // NEW: Set background TTS pending flag so we can start TTS directly from RN
        // when the new chapter HTML is loaded (in case WebView is suspended)
        backgroundTTSPendingRef.current = true;
        chaptersAutoPlayedRef.current += 1;
        nextChapterScreenVisible.current = true;
        navigateChapterRef.current('NEXT');
      } else {
        devLogger.debug('WebViewReader: No next chapter available');
        isTTSReadingRef.current = false;
      }
    });

    const appStateSubscription = AppState.addEventListener(
      'change',
      nextAppState => {
        if (nextAppState === 'background') {
          if (ttsStateRef.current?.wasPlaying) {
            devLogger.debug(
              'WebViewReader: Saving TTS state on background',
              ttsStateRef.current,
            );
            saveProgress(
              progressRef.current ?? 0,
              undefined,
              JSON.stringify({
                ...ttsStateRef.current,
                timestamp: Date.now(),
              }),
            );
          }

          // NEW: Stop TTS if background playback is disabled
          if (!chapterGeneralSettingsRef.current.ttsBackgroundPlayback) {
            devLogger.debug(
              'WebViewReader: Stopping TTS (Background Playback Disabled)',
            );
            TTSHighlight.stop();
            isTTSReadingRef.current = false;
          }
        } else if (nextAppState === 'active') {
          // SCREEN WAKE HANDLING: When screen wakes during background TTS,
          // pause native playback, sync the WebView to the current paragraph
          // position to prevent stale scrolling, then resume playback once
          // the UI has been positioned.
          if (isTTSReadingRef.current && currentParagraphIndexRef.current >= 0) {
            // BUG FIX: IMMEDIATELY capture the current paragraph index BEFORE any async operations
            // This prevents race conditions where onSpeechStart events mutate the ref during pause
            const capturedParagraphIndex = currentParagraphIndexRef.current;
            capturedWakeParagraphIndexRef.current = capturedParagraphIndex;

            // BUG FIX: Set wake transition flag to block all native events from updating refs
            wakeTransitionInProgressRef.current = true;

            devLogger.debug(
              'WebViewReader: Screen wake detected, capturing paragraph index:',
              capturedParagraphIndex
            );

            // BUG FIX: Immediately set screen wake sync flag to block all scroll saves
            // This must happen FIRST before any other processing
            if (webViewRef.current) {
              webViewRef.current.injectJavaScript(`
                try {
                  window.ttsScreenWakeSyncPending = true;
                  window.ttsOperationActive = true;
                  reader.suppressSaveOnScroll = true;
                  console.debug('TTS: Screen wake - IMMEDIATELY blocking scroll operations');
                } catch (e) {}
                true;
              `);
            }

            // Pause native playback immediately so we don't keep playing
            // while the UI syncs. Mark we should resume after the sync.
            try {
              wasReadingBeforeWakeRef.current = true;
              autoResumeAfterWakeRef.current = true;
              // Pause may internally call stop — that's acceptable: we'll
              // requeue & resume from the correct index after the UI sync.
              TTSHighlight.pause()
                .then(() => {
                  devLogger.debug('WebViewReader: Paused native TTS on wake for UI sync');
                })
                .catch(e => {
                  devLogger.warn('WebViewReader: Failed to pause TTS on wake', e);
                });

              // mark as not currently playing while UI sync runs
              isTTSReadingRef.current = false;
            } catch (e) {
              devLogger.warn('WebViewReader: Error while attempting to pause TTS', e);
            }
            devLogger.debug(
              'WebViewReader: Screen woke during TTS, syncing to paragraph',
              capturedParagraphIndex,
              'WebView synced:', isWebViewSyncedRef.current,
            );

            // Check if WebView is synced with current chapter
            if (!isWebViewSyncedRef.current) {
              // CRITICAL FIX: WebView has old chapter's HTML and TTS may have advanced
              // to a different chapter. We MUST:
              // 1. Save the EXACT chapter ID and paragraph index at this moment
              // 2. STOP TTS completely (not just pause) to prevent further queue processing
              // 3. Navigate back to the correct chapter if needed on reload

              // BUG FIX: Use the captured paragraph index for out-of-sync case too
              const wakeChapterId = prevChapterIdRef.current;
              const wakeParagraphIdx = capturedWakeParagraphIndexRef.current ?? currentParagraphIndexRef.current;

              devLogger.debug(
                'WebViewReader: WebView out of sync - STOPPING TTS and saving position:',
                `Chapter ${wakeChapterId}, Paragraph ${wakeParagraphIdx}`
              );

              // Save wake position for verification on reload
              wakeChapterIdRef.current = wakeChapterId;
              wakeParagraphIndexRef.current = wakeParagraphIdx;

              // CRITICAL: STOP TTS completely to prevent onQueueEmpty from advancing chapters
              // This is different from pause() which allows the queue to continue
              TTSHighlight.stop()
                .then(() => {
                  devLogger.debug('WebViewReader: TTS stopped on wake (out-of-sync) for safe resume');
                })
                .catch(e => {
                  devLogger.warn('WebViewReader: Failed to stop TTS on wake', e);
                });

              // Mark as not playing - we'll restart from saved position after sync
              isTTSReadingRef.current = false;
              backgroundTTSPendingRef.current = false; // Don't auto-start on next chapter

              // BUG FIX: Clear wake transition flags for out-of-sync case
              // They will be set again when pending screen wake sync runs after WebView reloads
              wakeTransitionInProgressRef.current = false;
              capturedWakeParagraphIndexRef.current = null;

              // Mark that we need to sync position after WebView reloads
              pendingScreenWakeSyncRef.current = true;
              return;
            }

            // BUG 3 FIX: IMMEDIATELY set blocking flag to prevent calculatePages from scrolling
            // This must happen BEFORE the 300ms timeout to win the race condition
            if (webViewRef.current) {
              webViewRef.current.injectJavaScript(`
                try {
                  // Block calculatePages and any stale scroll operations
                  window.ttsScreenWakeSyncPending = true;
                  window.ttsOperationActive = true;
                  reader.suppressSaveOnScroll = true;
                  devLogger.debug('TTS: Screen wake - blocking scroll operations');
                } catch (e) {
                  devLogger.error('TTS: Screen wake block failed', e);
                }
                true;
              `);
            }

            // Give WebView a moment to stabilize after screen wake
            setTimeout(() => {
              if (webViewRef.current) {
                // BUG FIX: Use the captured paragraph index from when wake was detected
                // This is immune to race conditions with onSpeechStart events
                const capturedIndex = capturedWakeParagraphIndexRef.current;

                // Also check MMKV as a secondary source
                const mmkvIndex = MMKVStorage.getNumber(`chapter_progress_${chapter.id}`) ?? -1;
                const refIndex = currentParagraphIndexRef.current;

                // Priority: captured index > MMKV > current ref
                // The captured index is the most reliable because it was taken BEFORE pause
                let syncIndex: number;
                if (capturedIndex !== null && capturedIndex >= 0) {
                  syncIndex = capturedIndex;
                  devLogger.debug(`WebViewReader: Using captured wake index: ${capturedIndex}`);
                } else if (mmkvIndex >= 0) {
                  syncIndex = mmkvIndex;
                  devLogger.debug(`WebViewReader: Using MMKV index: ${mmkvIndex}`);
                } else {
                  syncIndex = refIndex;
                  devLogger.debug(`WebViewReader: Using ref index: ${refIndex}`);
                }

                // Update refs to match the chosen sync index
                currentParagraphIndexRef.current = syncIndex;
                latestParagraphIndexRef.current = syncIndex;

                const chapterId = prevChapterIdRef.current;

                // Force sync WebView to current TTS position with chapter validation
                // This overrides any stale operations that might be pending
                webViewRef.current.injectJavaScript(`
                  try {
                    if (window.tts) {
                      console.debug('TTS: Screen wake sync to index ${syncIndex}');
                      // Mark as background playback to prevent resume prompts
                      window.tts.isBackgroundPlaybackActive = true;
                      window.tts.reading = true;
                      window.tts.hasAutoResumed = true;
                      window.tts.started = true;
                      
                      // Update TTS internal state for proper continuation
                      const readableElements = reader.getReadableElements();
                      if (readableElements && readableElements[${syncIndex}]) {
                        window.tts.currentElement = readableElements[${syncIndex}];
                        window.tts.prevElement = ${syncIndex} > 0 ? readableElements[${syncIndex} - 1] : null;
                        
                        // Force scroll to current TTS position
                        window.tts.scrollToElement(window.tts.currentElement);
                        
                        // Highlight current paragraph with chapter validation
                        window.tts.highlightParagraph(${syncIndex}, ${chapterId});
                        
                        console.debug('TTS: Screen wake sync complete - scrolled to paragraph ${syncIndex}');
                      } else {
                        console.warn('TTS: Screen wake - paragraph ${syncIndex} not found');
                      }
                    }
                    
                        // Release blocking flags after sync is complete
                        setTimeout(() => {
                          window.ttsScreenWakeSyncPending = false;
                          window.ttsOperationActive = false;
                          reader.suppressSaveOnScroll = false;
                          devLogger.debug('TTS: Screen wake sync - released blocking flags');
                        }, 500);
                  } catch (e) {
                    devLogger.error('TTS: Screen wake sync failed', e);
                    // Release flags even on error
                    window.ttsScreenWakeSyncPending = false;
                    window.ttsOperationActive = false;
                    reader.suppressSaveOnScroll = false;
                  }
                  true;
                `);

                // Schedule a resume on RN side if we paused native playback earlier
                setTimeout(() => {
                  // BUG FIX: Clear the wake transition flag now that sync is complete
                  wakeTransitionInProgressRef.current = false;
                  capturedWakeParagraphIndexRef.current = null;

                  if (autoResumeAfterWakeRef.current && isTTSReadingRef.current === false) {
                    // BUG FIX: Use the sync index we already computed, not re-reading
                    // The sync index was already set to currentParagraphIndexRef in the outer timeout
                    const idx = currentParagraphIndexRef.current ?? -1;

                    if (idx >= 0) {
                      // Attempt to resume using native batch playback
                      try {
                        const paragraphs = extractParagraphs(html);
                        if (paragraphs && paragraphs.length > idx) {
                          const remaining = paragraphs.slice(idx);
                          const ids = remaining.map((_, i) => `chapter_${chapter.id}_utterance_${idx + i}`);

                          // BUG FIX: Update ttsQueueRef to match the new batch
                          // This ensures onSpeechDone handler has correct queue info for progression
                          // Without this, after multiple wake cycles the handler uses stale queue data
                          ttsQueueRef.current = {
                            texts: remaining,
                            startIndex: idx,
                          };

                          // Start batch playback from the resolved index
                          TTSHighlight.speakBatch(remaining, ids, {
                            voice: readerSettingsRef.current.tts?.voice?.identifier,
                            pitch: readerSettingsRef.current.tts?.pitch || 1,
                            rate: readerSettingsRef.current.tts?.rate || 1,
                          })
                            .then(() => {
                              devLogger.debug('WebViewReader: Resumed TTS after wake (RN-side) from index', idx);
                              isTTSReadingRef.current = true;
                            })
                            .catch(err => {
                              devLogger.error('WebViewReader: Failed to resume TTS after wake', err);
                            });
                        }
                      } catch (e) {
                        devLogger.warn('WebViewReader: Cannot resume TTS after wake (failed extract)', e);
                      }
                    }

                    autoResumeAfterWakeRef.current = false;
                  }
                }, 900);
              }
            }, 300);
          }
        }
      },
    );

    return () => {
      onSpeechDoneSubscription.remove();
      rangeSubscription.remove();
      startSubscription.remove();
      queueEmptySubscription.remove();
      appStateSubscription.remove();
      TTSHighlight.stop();
      if (ttsStateRef.current?.wasPlaying) {
        devLogger.debug(
          'WebViewReader: Saving TTS state on unmount',
          ttsStateRef.current,
        );
        saveProgress(
          progressRef.current ?? 0,
          undefined,
          JSON.stringify({
            ...ttsStateRef.current,
            timestamp: Date.now(),
            autoStartOnReturn: true,
          }),
        );
      }
      // Cleanup resume pending state & any deferred items to avoid leakage
      clearResumePending();
      deferredSpeakQueueRef.current = [];
      ttsQueueRef.current = null;
    };
    // Empty deps intentional - only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const mmkvListener = MMKVStorage.addOnValueChangedListener(key => {
      switch (key) {
        case CHAPTER_READER_SETTINGS:
          webViewRef.current?.injectJavaScript(
            `reader.readerSettings.val = ${MMKVStorage.getString(
              CHAPTER_READER_SETTINGS,
            )}`,
          );
          break;
        case CHAPTER_GENERAL_SETTINGS:
          const newSettings = MMKVStorage.getString(CHAPTER_GENERAL_SETTINGS);
          devLogger.debug(
            'WebViewReader: MMKV listener fired for CHAPTER_GENERAL_SETTINGS',
            newSettings,
          );
          webViewRef.current?.injectJavaScript(
            `if (window.reader && window.reader.generalSettings) {
               window.reader.generalSettings.val = ${newSettings};
               console.debug('TTS: Updated general settings via listener');
             }`,
          );
          break;
      }
    });

    // Safety: Inject current settings on mount to ensure WebView is in sync
    // even if useMemo was stale or listener missed something.
    const currentSettings = MMKVStorage.getString(CHAPTER_GENERAL_SETTINGS);
    if (currentSettings) {
      webViewRef.current?.injectJavaScript(
        `setTimeout(() => {
           if (window.reader && window.reader.generalSettings) {
             const current = window.reader.generalSettings.val;
             const fresh = ${currentSettings};
             
             // Helper to sort keys for deep comparison
             const sortKeys = (obj) => {
               if (typeof obj !== 'object' || obj === null) return obj;
               return Object.keys(obj).sort().reduce((acc, key) => {
                 acc[key] = sortKeys(obj[key]);
                 return acc;
               }, {});
             };

             const currentStr = JSON.stringify(sortKeys(current));
             const freshStr = JSON.stringify(sortKeys(fresh));
             
             // Only inject if different
             if (currentStr !== freshStr) {
               console.debug('TTS: Settings changed, injecting. Current len: ' + currentStr.length + ', Fresh len: ' + freshStr.length);
               window.reader.generalSettings.val = fresh;
             } else {
               console.debug('TTS: Settings in sync');
             }
           }
         }, 1000);`,
      );
    }

    const subscription = deviceInfoEmitter.addListener(
      'RNDeviceInfo_batteryLevelDidChange',
      (level: number) => {
        webViewRef.current?.injectJavaScript(
          `reader.batteryLevel.val = ${level}`,
        );
      },
    );
    return () => {
      mmkvListener?.remove();
      subscription?.remove();
    };
    // Empty deps intentional - listener setup only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <WebView
        ref={webViewRef}
        style={{ backgroundColor: readerSettings.theme }}
        allowFileAccess={true}
        originWhitelist={['*']}
        scalesPageToFit={true}
        showsVerticalScrollIndicator={false}
        javaScriptEnabled={true}
        webviewDebuggingEnabled={__DEV__}
        onLoadEnd={() => {
          // Mark WebView as synced with current chapter
          isWebViewSyncedRef.current = true;
          devLogger.debug(`WebViewReader: onLoadEnd - WebView synced with chapter ${chapter.id}`);

          // If the chapter was loaded as part of background TTS navigation
          // we may need to resume a screen-wake sync or skip WebView-driven start
          if (backgroundTTSPendingRef.current) {
            devLogger.debug('WebViewReader: onLoadEnd skipped TTS start - background TTS pending');
            return;
          }

          // CRITICAL FIX: Handle pending screen-wake sync with chapter verification
          // When screen woke while TTS was playing in background, we saved the exact
          // chapter ID and paragraph index. Now we must verify we're on the correct chapter.
          if (pendingScreenWakeSyncRef.current) {
            pendingScreenWakeSyncRef.current = false;

            const savedWakeChapterId = wakeChapterIdRef.current;
            const savedWakeParagraphIdx = wakeParagraphIndexRef.current;
            const currentChapterId = chapter.id;

            devLogger.debug(
              'WebViewReader: Processing pending screen-wake sync.',
              `Saved: Chapter ${savedWakeChapterId}, Paragraph ${savedWakeParagraphIdx}.`,
              `Current: Chapter ${currentChapterId}`
            );

            // ENFORCE CHAPTER MATCH: If the loaded chapter doesn't match where TTS was,
            // attempt to navigate to the correct chapter automatically.
            if (savedWakeChapterId !== null && savedWakeChapterId !== currentChapterId) {
              devLogger.warn(
                `WebViewReader: Chapter mismatch! TTS was at chapter ${savedWakeChapterId} but WebView loaded chapter ${currentChapterId}.`,
                'Attempting to navigate to correct chapter...'
              );

              // Check retry count to prevent infinite loops
              if (syncRetryCountRef.current >= MAX_SYNC_RETRIES) {
                devLogger.error('WebViewReader: Max sync retries reached, showing failure dialog');

                // Calculate progress info for the error dialog
                const paragraphs = extractParagraphs(html);
                const totalParagraphs = paragraphs?.length ?? 0;
                const paragraphIdx = savedWakeParagraphIdx ?? 0;
                const progressPercent = totalParagraphs > 0
                  ? (paragraphIdx / totalParagraphs) * 100
                  : 0;

                // Try to get chapter name from DB
                getChapterFromDb(savedWakeChapterId).then(savedChapter => {
                  setSyncDialogInfo({
                    chapterName: savedChapter?.name ?? `Chapter ID: ${savedWakeChapterId}`,
                    paragraphIndex: paragraphIdx,
                    totalParagraphs: totalParagraphs,
                    progress: progressPercent,
                  });
                  setSyncDialogStatus('failed');
                  setSyncDialogVisible(true);
                }).catch(() => {
                  setSyncDialogInfo({
                    chapterName: `Chapter ID: ${savedWakeChapterId}`,
                    paragraphIndex: paragraphIdx,
                    totalParagraphs: totalParagraphs,
                    progress: progressPercent,
                  });
                  setSyncDialogStatus('failed');
                  setSyncDialogVisible(true);
                });

                // Clear wake refs since we're not resuming
                wakeChapterIdRef.current = null;
                wakeParagraphIndexRef.current = null;
                autoResumeAfterWakeRef.current = false;
                wasReadingBeforeWakeRef.current = false;
                syncRetryCountRef.current = 0;
                return;
              }

              // Show syncing dialog
              setSyncDialogStatus('syncing');
              setSyncDialogVisible(true);
              syncRetryCountRef.current += 1;

              // Fetch the saved chapter info and navigate to it
              getChapterFromDb(savedWakeChapterId).then(savedChapter => {
                if (savedChapter) {
                  devLogger.debug(`WebViewReader: Navigating to saved chapter: ${savedChapter.name}`);
                  // Keep wake refs intact so we can resume after navigation
                  // Set flag so we continue the sync process on next load
                  pendingScreenWakeSyncRef.current = true;
                  // Navigate to the correct chapter
                  getChapter(savedChapter);
                } else {
                  devLogger.error(`WebViewReader: Could not find chapter ${savedWakeChapterId} in database`);
                  setSyncDialogStatus('failed');
                  setSyncDialogInfo({
                    chapterName: `Unknown Chapter (ID: ${savedWakeChapterId})`,
                    paragraphIndex: savedWakeParagraphIdx ?? 0,
                    totalParagraphs: 0,
                    progress: 0,
                  });
                  // Clear refs
                  wakeChapterIdRef.current = null;
                  wakeParagraphIndexRef.current = null;
                  autoResumeAfterWakeRef.current = false;
                  wasReadingBeforeWakeRef.current = false;
                  syncRetryCountRef.current = 0;
                }
              }).catch(err => {
                  devLogger.error('WebViewReader: Failed to fetch saved chapter', err);
                setSyncDialogStatus('failed');
                // Clear refs
                wakeChapterIdRef.current = null;
                wakeParagraphIndexRef.current = null;
                autoResumeAfterWakeRef.current = false;
                wasReadingBeforeWakeRef.current = false;
                syncRetryCountRef.current = 0;
              });

              return;
            }

            // Chapter matches! Now we can safely sync and resume.
            // Reset retry counter on success
            syncRetryCountRef.current = 0;

            // Hide sync dialog if it was showing
            if (syncDialogVisible) {
              setSyncDialogStatus('success');
              // Auto-hide after a short delay
              setTimeout(() => setSyncDialogVisible(false), 1500);
            }
            const syncIndex = savedWakeParagraphIdx ?? currentParagraphIndexRef.current ?? 0;
            const chapterId = currentChapterId;

            devLogger.debug(`WebViewReader: Chapter verified, syncing to paragraph ${syncIndex}`);

            // Clear wake refs
            wakeChapterIdRef.current = null;
            wakeParagraphIndexRef.current = null;

            if (webViewRef.current) {
              webViewRef.current.injectJavaScript(`
                try {
                  if (window.tts) {
                    devLogger.debug('TTS: Pending screen wake sync to index ${syncIndex}');
                    window.tts.isBackgroundPlaybackActive = true;
                    window.tts.reading = true;
                    window.tts.hasAutoResumed = true;
                    window.tts.started = true;

                    const readableElements = reader.getReadableElements();
                    if (readableElements && readableElements[${syncIndex}]) {
                      window.tts.currentElement = readableElements[${syncIndex}];
                      window.tts.prevElement = ${syncIndex} > 0 ? readableElements[${syncIndex} - 1] : null;
                      window.tts.scrollToElement(window.tts.currentElement);
                      window.tts.highlightParagraph(${syncIndex}, ${chapterId});
                      devLogger.debug('TTS: Pending screen wake sync complete - scrolled to paragraph ${syncIndex}');
                    } else {
                      devLogger.warn('TTS: Pending screen wake - paragraph ${syncIndex} not found');
                    }
                  }
                } catch (e) {
                  devLogger.error('TTS: Pending screen wake sync failed', e);
                }
                true;
              `);

              // Resume TTS playback from the verified position
              if (wasReadingBeforeWakeRef.current || autoResumeAfterWakeRef.current) {
                setTimeout(() => {
                  try {
                    const paragraphs = extractParagraphs(html);
                    if (paragraphs && paragraphs.length > syncIndex) {
                      const remaining = paragraphs.slice(syncIndex);
                      const ids = remaining.map((_, i) => `chapter_${chapterId}_utterance_${syncIndex + i}`);

                      currentParagraphIndexRef.current = syncIndex;
                      latestParagraphIndexRef.current = syncIndex;

                      TTSHighlight.speakBatch(remaining, ids, {
                        voice: readerSettingsRef.current.tts?.voice?.identifier,
                        pitch: readerSettingsRef.current.tts?.pitch || 1,
                        rate: readerSettingsRef.current.tts?.rate || 1,
                      })
                        .then(() => {
                          devLogger.debug(`WebViewReader: Resumed TTS after wake from chapter ${chapterId}, paragraph ${syncIndex}`);
                          isTTSReadingRef.current = true;
                        })
                        .catch(err => {
                          devLogger.error('WebViewReader: Failed to resume TTS after wake', err);
                        });
                    }
                  } catch (e) {
                    devLogger.warn('WebViewReader: Cannot resume TTS after wake (failed extract)', e);
                  }

                  autoResumeAfterWakeRef.current = false;
                  wasReadingBeforeWakeRef.current = false;
                }, 500);
              }
            }
            return; // Don't process autoStartTTSRef when handling wake sync
          }

          if (autoStartTTSRef.current) {
            autoStartTTSRef.current = false;
            setTimeout(() => {
              webViewRef.current?.injectJavaScript(`
              (function() {
                if (window.tts && reader.generalSettings.val.TTSEnable) {
                  setTimeout(() => {
                    tts.start();
                    const controller = document.getElementById('TTS-Controller');
                    if (controller && controller.firstElementChild) {
                      controller.firstElementChild.innerHTML = pauseIcon;
                    }
                  }, 500);
                }
              })();
            `);
            }, 300);
          }
        }}
        onMessage={(ev: { nativeEvent: { data: string } }) => {
          __DEV__ && onLogMessage(ev);
          const event: WebViewPostEvent = JSON.parse(ev.nativeEvent.data);
          switch (event.type) {
            
            case 'hide':
              onPress();
              break;
            case 'next':
              nextChapterScreenVisible.current = true;
              if (event.autoStartTTS) {
                // BUG FIX: Save chapter completion when TTS reaches end and requests next chapter
                // This ensures chapters are marked as read even when screen is off
                const currentProgress = progressRef.current ?? 0;
                saveProgress(
                  100, // Mark chapter as complete
                  undefined, // No need to save paragraph index as we're moving to next chapter
                  ttsStateRef.current ? JSON.stringify({
                    ...ttsStateRef.current,
                    timestamp: Date.now(),
                  }) : undefined
                );
                devLogger.debug(`WebViewReader: Saved chapter completion progress via 'next' event (was ${currentProgress}%, now 100%)`);

                // Check if we should continue to next chapter based on setting
                const continueMode = chapterGeneralSettingsRef.current.ttsContinueToNextChapter || 'none';

                if (continueMode === 'none') {
                  // User chose to stop at end of chapter - don't auto-start TTS
                  autoStartTTSRef.current = false;
                  chaptersAutoPlayedRef.current = 0; // Reset counter
                } else if (continueMode === 'continuous') {
                  // Unlimited continuation
                  autoStartTTSRef.current = true;
                  chaptersAutoPlayedRef.current += 1;
                } else {
                  // Limited continuation (5 or 10 chapters)
                  const limit = parseInt(continueMode, 10);
                  if (chaptersAutoPlayedRef.current < limit) {
                    autoStartTTSRef.current = true;
                    chaptersAutoPlayedRef.current += 1;
                  } else {
                    // Limit reached - stop auto-continue
                    autoStartTTSRef.current = false;
                    chaptersAutoPlayedRef.current = 0; // Reset counter
                  }
                }
              }
              navigateChapter('NEXT');
              break;
            case 'prev':
              // Reset auto-play counter when user manually navigates
              chaptersAutoPlayedRef.current = 0;
              navigateChapter('PREV');
              break;
            case 'save':
              if (event.data && typeof event.data === 'number') {
                // Centralized guard: ignore saves while deletion pending / during grace period / invalid TTS saves
                const saveEvent = { data: event.data, paragraphIndex: event.paragraphIndex, chapterId: event.chapterId };
                if (shouldIgnoreSaveEvent(saveEvent, {
                  pendingDeletion: pendingDeletionRef.current,
                  chapterTransitionTime: chapterTransitionTimeRef.current,
                  currentChapterId: chapter.id,
                  isTTSReading: isTTSReadingRef.current,
                  currentIdx: currentParagraphIndexRef.current ?? -1,
                  latestIdx: latestParagraphIndexRef.current ?? -1,
                })) {
                  devLogger.debug('WebViewReader: Ignoring save event due to guard');
                  break;
                }
                // Safety: ignore save events while a deletion/reset is in progress
                if (pendingDeletionRef.current) {
                  devLogger.debug('WebViewReader: Ignoring save event during pending deletion');
                  break;
                }
                // CRITICAL: Validate chapterId to prevent stale save events from old chapter
                // corrupting new chapter's progress during transitions
                const GRACE_PERIOD_MS = 1000; // 1 second grace period after chapter change
                const timeSinceTransition = Date.now() - chapterTransitionTimeRef.current;

                if (event.chapterId !== undefined && event.chapterId !== chapter.id) {
                  devLogger.debug(
                    `WebViewReader: Ignoring stale save event from chapter ${event.chapterId}, current is ${chapter.id}`,
                  );
                  break;
                }

                // BUG FIX: When TTS is actively reading, only accept saves from TTS itself
                // (identified by having a valid paragraphIndex). Scroll-based saves should be blocked.
                // This ensures TTS is the single source of truth for progress during playback.
                if (isTTSReadingRef.current) {
                  // TTS is reading - only allow saves that came from TTS (via tts-state or direct paragraph save)
                  // Scroll-based saves from core.js don't have ttsSource flag, so they'll be blocked
                  if (event.paragraphIndex === undefined) {
                    devLogger.debug('WebViewReader: Ignoring non-TTS save while TTS is reading');
                    break;
                  }
                  // If paragraph is going BACKWARDS, it's likely a scroll-based save trying to override TTS
                  const currentIdx = currentParagraphIndexRef.current ?? -1;
                  if (typeof event.paragraphIndex === 'number' && currentIdx >= 0 && event.paragraphIndex < currentIdx - 1) {
                    devLogger.debug(`WebViewReader: Ignoring backwards save (${event.paragraphIndex}) while TTS at ${currentIdx}`);
                    break;
                  }
                }

                // During the grace period, we should ignore legacy saves without
                // chapterId (old WebView) — and also avoid accepting early
                // save events that would overwrite recently-known TTS progress
                // (e.g. the WebView may send a default 0 index on load).
                if (timeSinceTransition < GRACE_PERIOD_MS) {
                  if (event.chapterId === undefined) {
                    devLogger.debug(
                      `WebViewReader: Ignoring save event without chapterId during grace period (${timeSinceTransition}ms)`,
                    );
                    break;
                  }

                  // If the event explicitly includes a paragraphIndex but that
                  // index is older/behind our current TTS progress (or is the
                  // initial 0) then ignore it to avoid clobbering the correct
                  // position written by the native TTS playback.
                  const incomingIdx = typeof event.paragraphIndex === 'number' ? event.paragraphIndex : -1;
                  const currentIdx = currentParagraphIndexRef.current ?? -1;
                  const latestIdx = latestParagraphIndexRef.current ?? -1;

                  if (incomingIdx >= 0) {
                    // If incoming progress is strictly less than our last known
                    // progress, treat it as stale and ignore it.
                    if (latestIdx >= 0 && incomingIdx < latestIdx) {
                      devLogger.debug(`WebViewReader: Ignoring early/stale save event (incoming=${incomingIdx} vs latest=${latestIdx})`);
                      break;
                    }

                    // Some WebView instances emit 0 as an initial save; if we
                    // already have a positive index for this chapter ignore the 0.
                    if (incomingIdx === 0 && Math.max(currentIdx, latestIdx) > 0) {
                      devLogger.debug('WebViewReader: Ignoring initial 0 save during grace period');
                      break;
                    }
                  }
                }

                devLogger.debug(
                  'WebViewReader: Received save event. Progress:',
                  event.data,
                  'Paragraph:',
                  event.paragraphIndex,
                );
                // NEW: Track latest paragraph index
                if (event.paragraphIndex !== undefined) {
                  latestParagraphIndexRef.current = event.paragraphIndex;
                  MMKVStorage.set(
                    `chapter_progress_${chapter.id}`,
                    event.paragraphIndex,
                  );
                }
                saveProgress(
                  event.data,
                  event.paragraphIndex as number | undefined,
                );
              }
              break;
            case 'speak':
              if (event.data && typeof event.data === 'string') {
                // Check if user is starting TTS from earlier chapter
                const paragraphIdx = typeof event.paragraphIndex === 'number'
                  ? event.paragraphIndex
                  : currentParagraphIndexRef.current;

                // If cross-chapter dialog is shown, don't start TTS yet
                                // If cross-chapter dialog is shown, don't start TTS yet
                                if (resumeDialogPendingRef.current) {
                                  devLogger.debug('WebViewReader: Deferring speak() while resume confirmation pending');
                                  deferredSpeakQueueRef.current.push({ text: event.data as string, paragraphIndex: paragraphIdx });
                                  break;
                                }
                if (checkCrossChapterTTS(paragraphIdx)) {
                  break;
                }

                if (!isTTSReadingRef.current) {
                  isTTSReadingRef.current = true;
                }

                // BUG FIX: Mark this as a manual TTS start to enable grace period
                // This prevents onQueueEmpty from firing prematurely while addToBatch is async
                manualTTSStartTimeRef.current = Date.now();

                // BUG FIX: Reset background TTS pending flag when user manually starts TTS
                // This prevents chapter change effect from starting a conflicting batch
                backgroundTTSPendingRef.current = false;

                // BUG FIX: Reset chapters auto-played counter on manual TTS start
                // User is manually starting TTS, so they're taking control
                chaptersAutoPlayedRef.current = 0;

                // Use chapter_N_utterance_N format so event handlers can validate chapter
                // paragraphIdx already declared above for cross-chapter check
                const utteranceId = paragraphIdx >= 0
                  ? `chapter_${chapter.id}_utterance_${paragraphIdx}`
                  : undefined;

                // Update current index
                if (paragraphIdx >= 0) {
                  currentParagraphIndexRef.current = paragraphIdx;
                }

                // CRITICAL: Clear queue ref when not in background mode
                // This prevents onSpeechDone from incorrectly thinking we're in batch mode
                // when we're actually doing single-utterance playback (e.g., resume with autoStart)
                if (!chapterGeneralSettings.ttsBackgroundPlayback) {
                  ttsQueueRef.current = null;
                }

                // FIX: Use readerSettingsRef.current to get latest TTS settings
                // (the prop doesn't update when settings change in the panel)
                TTSHighlight.speak(event.data, {
                  voice: readerSettingsRef.current.tts?.voice?.identifier,
                  pitch: readerSettingsRef.current.tts?.pitch || 1,
                  rate: readerSettingsRef.current.tts?.rate || 1,
                  utteranceId,
                });
              } else {
                webViewRef.current?.injectJavaScript('tts.next?.()');
              }
              break;
            case 'stop-speak':
              // Save global TTS position for cross-chapter tracking
              saveGlobalTTSPosition();
              TTSHighlight.fullStop();
              isTTSReadingRef.current = false;
              break;
            case 'tts-state':
              if (
                event.data &&
                !Array.isArray(event.data) &&
                typeof event.data === 'object'
              ) {
                ttsStateRef.current = event.data;
                if (typeof event.data.paragraphIndex === 'number') {
                  currentParagraphIndexRef.current = event.data.paragraphIndex;
                }
              }
              break;
            case 'request-tts-confirmation':
              if (
                event.data &&
                !Array.isArray(event.data) &&
                event.data.savedIndex !== undefined
              ) {
                // handleTTSConfirmation(Number(event.data.savedIndex));
                const idx = Number(event.data.savedIndex);
                pendingResumeIndexRef.current = Number.isFinite(idx) ? idx : -1;
                // Mark that a resume confirmation is pending so incoming speak/queue
                // messages are deferred until user responds.
                setResumePending();
                showResumeDialog();
              }
              break;
            case 'tts-scroll-prompt':
              if (
                event.data &&
                !Array.isArray(event.data) &&
                event.data.currentIndex !== undefined &&
                event.data.visibleIndex !== undefined
              ) {
                ttsScrollPromptDataRef.current = {
                  currentIndex: Number(event.data.currentIndex),
                  visibleIndex: Number(event.data.visibleIndex),
                };
                showScrollSyncDialog();
              }
              break;
            case 'tts-manual-mode-prompt':
              showManualModeDialog();
              break;
            case 'tts-resume-location-prompt':
              if (
                event.data &&
                !Array.isArray(event.data) &&
                event.data.currentIndex !== undefined &&
                event.data.visibleIndex !== undefined
              ) {
                ttsScrollPromptDataRef.current = {
                  currentIndex: Number(event.data.currentIndex),
                  visibleIndex: Number(event.data.visibleIndex),
                  isResume: true, // Mark as resume prompt
                };
                showScrollSyncDialog();
              }
              break;
            case 'show-toast':
              if (event.data && typeof event.data === 'string') {
                showToastMessage(event.data);
              }
              break;
            case 'tts-queue':
                              if (resumeDialogPendingRef.current) {
                                devLogger.debug('WebViewReader: Deferring TTS queue until resume confirmation resolved');
                                // store for diagnostics but do not start playback
                                ttsQueueRef.current = {
                                  startIndex: typeof event.startIndex === 'number' ? event.startIndex : 0,
                                  texts: event.data as string[],
                                };
                                break;
                              }
              if (
                event.data &&
                Array.isArray(event.data) &&
                typeof event.startIndex === 'number'
              ) {
                ttsQueueRef.current = {
                  startIndex: typeof event.startIndex === 'number' ? event.startIndex : 0,
                  texts: event.data as string[],
                };

                // Use batch TTS for background playback
                // BUG 2 FIX: Use addToBatch instead of speakBatch when queue is received
                // The first paragraph was already queued via the 'speak' event which uses QUEUE_FLUSH.
                // If we call speakBatch here, it would QUEUE_FLUSH again, clearing the first paragraph.
                // Instead, we use addToBatch to ADD remaining paragraphs to the queue.
                if (chapterGeneralSettings.ttsBackgroundPlayback && event.data.length > 0 && typeof event.startIndex === 'number') {
                  const startIndex = event.startIndex;
                  // Include chapter ID in utterance IDs to prevent stale event processing
                  const utteranceIds = (event.data as string[]).map((_, i) =>
                    `chapter_${chapter.id}_utterance_${startIndex + i}`
                  );

                  devLogger.debug(`WebViewReader: Adding ${event.data.length} paragraphs to TTS queue from index ${startIndex}`);

                  // Use addToBatch to preserve the currently playing utterance
                  const addToBatchWithRetry = async (texts: string[], ids: string[]) => {
                    const maxAttempts = 3;
                    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                      try {
                        devLogger.debug(`WebViewReader: addToBatch attempt ${attempt} startIndex=${startIndex} count=${texts.length}`);
                        await TTSHighlight.addToBatch(texts, ids);
                        devLogger.debug('WebViewReader: addToBatch succeeded');
                        return true;
                      } catch (err) {
                        devLogger.error(`WebViewReader: addToBatch failed (attempt ${attempt}):`, err);
                        if (attempt < maxAttempts) {
                          await new Promise(r => setTimeout(r, 150 * attempt));
                        }
                      }
                    }
                    return false;
                  };

                  addToBatchWithRetry(event.data as string[], utteranceIds).then(success => {
                    if (!success) {
                      devLogger.error('WebViewReader: Add to batch failed after retries. Falling back to WebView-driven TTS');
                      // Fallback to WebView-driven TTS
                      webViewRef.current?.injectJavaScript('tts.next?.()');
                    }
                  });
                }
                
              }
              break;
            case 'save-tts-position':
              if (event.data && typeof event.data === 'object') {
                MMKVStorage.set(
                  'tts_button_position',
                  JSON.stringify(event.data),
                );
              }
              break;
            case 'tts-update-settings':
            case 'tts-apply-settings':
              // Handle live TTS settings updates from WebView.
              // DO NOT echo these back to WebView via applyTtsUpdateToWebView, as that causes an infinite loop.
              if (event.data && typeof event.data === 'object' && !Array.isArray(event.data)) {
                const ttsData = event.data as { rate?: number; pitch?: number; voice?: string; enabled?: boolean; showParagraphHighlight?: boolean };
                devLogger.debug('WebViewReader: Received TTS settings update:', ttsData);

                // Update the refs so future speak() calls use new params
                if (ttsData.rate !== undefined || ttsData.pitch !== undefined || ttsData.voice !== undefined) {
                  const currentTTS = readerSettingsRef.current.tts || {};
                  const currentVoice = currentTTS.voice;

                  readerSettingsRef.current = {
                    ...readerSettingsRef.current,
                    tts: {
                      ...currentTTS,
                      rate: ttsData.rate ?? currentTTS.rate,
                      pitch: ttsData.pitch ?? currentTTS.pitch,
                      // Only update voice if we have a valid current voice to spread from
                      voice: ttsData.voice !== undefined && currentVoice
                        ? { ...currentVoice, identifier: ttsData.voice }
                        : currentVoice,
                    },
                  };
                }

                // Update general settings ref
                if (ttsData.enabled !== undefined || ttsData.showParagraphHighlight !== undefined) {
                  chapterGeneralSettingsRef.current = {
                    ...chapterGeneralSettingsRef.current,
                    TTSEnable: ttsData.enabled ?? chapterGeneralSettingsRef.current.TTSEnable,
                    showParagraphHighlight: ttsData.showParagraphHighlight ?? chapterGeneralSettingsRef.current.showParagraphHighlight,
                  };
                }

                // Note: For background/batch TTS, rate/pitch/voice changes will apply
                // on next paragraph or when TTS restarts. The native TTS engine doesn't
                // support changing parameters mid-utterance.
              }
              break;
          }
        }}
        source={{
          baseUrl: !chapter.isDownloaded ? plugin?.site : undefined,
          html: memoizedHTML,
        }}
      />
      <TTSResumeDialog
        visible={resumeDialogVisible}
        theme={theme}
        onResume={handleResumeConfirm}
        onRestart={handleResumeCancel}
        onRestartChapter={handleRestartChapter}
        onDismiss={hideResumeDialog}
      />
      <TTSScrollSyncDialog
        visible={scrollSyncDialogVisible}
        theme={theme}
        currentIndex={ttsScrollPromptDataRef.current?.currentIndex || 0}
        visibleIndex={ttsScrollPromptDataRef.current?.visibleIndex || 0}
        onSyncToVisible={handleTTSScrollSyncConfirm}
        onKeepCurrent={handleTTSScrollSyncCancel}
        onDismiss={hideScrollSyncDialog}
      />
      <TTSManualModeDialog
        visible={manualModeDialogVisible}
        theme={theme}
        onStopTTS={handleStopTTS}
        onContinueFollowing={handleContinueFollowing}
        onDismiss={hideManualModeDialog}
      />
      <TTSSyncDialog
        visible={syncDialogVisible}
        theme={theme}
        status={syncDialogStatus}
        syncInfo={syncDialogInfo}
        onDismiss={() => {
          setSyncDialogVisible(false);
          syncRetryCountRef.current = 0;
        }}
        onRetry={() => {
          // Reset and try again
          syncRetryCountRef.current = 0;
          if (wakeChapterIdRef.current) {
            pendingScreenWakeSyncRef.current = true;
            setSyncDialogStatus('syncing');
            getChapterFromDb(wakeChapterIdRef.current).then(savedChapter => {
              if (savedChapter) {
                getChapter(savedChapter);
              } else {
                setSyncDialogStatus('failed');
              }
            }).catch(() => {
              setSyncDialogStatus('failed');
            });
          } else {
            setSyncDialogVisible(false);
          }
        }}
      />
      {/* Cross-chapter TTS Dialog */}
      {crossChapterDialogVisible && crossChapterInfo && (
        <View style={styles.crossChapterOverlay}>
          <View style={[styles.crossChapterContainer, { backgroundColor: theme.surface }]}>
            <View style={styles.crossChapterContent}>
              <Text style={[styles.crossChapterTitle, { color: theme.onSurface }]}>
                Resume TTS from different chapter?
              </Text>
              <Text style={[styles.crossChapterDescription, { color: theme.onSurfaceVariant }]}>
                You were reading "{crossChapterInfo.lastChapter.chapterName}" (position {crossChapterInfo.lastChapter.chapterPosition}) at paragraph {crossChapterInfo.lastChapter.paragraphIndex + 1}.
                Starting from the current chapter will reset progress of chapters read ahead.
              </Text>
              <Text style={[styles.crossChapterSub, { color: theme.onSurfaceVariant }]}> {
                // Show a short summary how many positions will be reset (best-effort)
                Math.max(0, (crossChapterInfo.lastChapter.chapterPosition ?? 0) - (chapter.position ?? 0)) > 0
                  ? `Will reset ${Math.max(0, (crossChapterInfo.lastChapter.chapterPosition ?? 0) - (chapter.position ?? 0))} chapters ahead.`
                  : 'No later chapters will be reset.'
              } </Text>
            </View>
            <View style={styles.crossChapterButtons}>
              <Pressable
                onPress={handleCrossChapterContinue}
                style={[styles.crossChapterPrimaryButton, { backgroundColor: theme.primary }]}
              >
                <Text style={[styles.crossChapterButtonText, { color: theme.onPrimary }]}>
                  Continue from "{crossChapterInfo.lastChapter.chapterName.slice(0, 24)}..." (pos {crossChapterInfo.lastChapter.chapterPosition}, para {crossChapterInfo.lastChapter.paragraphIndex + 1})
                </Text>
              </Pressable>
              <Pressable
                onPress={handleCrossChapterRestart}
                style={[styles.crossChapterSecondaryButton, { backgroundColor: theme.surfaceVariant }]}
              >
                  <Text style={[styles.crossChapterButtonText, { color: theme.onSurfaceVariant }]}>
                  Start from "{chapter.name.slice(0, 24)}..." (pos {chapter.position}) — reset forward chapters
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setCrossChapterDialogVisible(false)}
                style={styles.crossChapterCancelButton}
              >
                <Text style={{ color: theme.onSurfaceVariant }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
      <Toast
        visible={toastVisible}
        message={toastMessageRef.current}
        theme={theme}
        onHide={hideToast}
      />
    </>
  );
};

export default memo(WebViewReader);

const styles = StyleSheet.create({
  crossChapterOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  crossChapterContainer: {
    borderRadius: 12,
    padding: 20,
    margin: 20,
    maxWidth: 320,
  },
  crossChapterContent: {
    marginBottom: 16,
  },
  crossChapterTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  crossChapterDescription: {
    fontSize: 14,
  },
  crossChapterSub: {
    fontSize: 13,
    marginTop: 8,
    opacity: 0.95,
  },
  crossChapterButtons: {
    gap: 8,
  },
  crossChapterPrimaryButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  crossChapterSecondaryButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  crossChapterCancelButton: {
    padding: 12,
    alignItems: 'center',
  },
  crossChapterButtonText: {
    fontWeight: '600',
  },
});
