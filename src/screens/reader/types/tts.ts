/**
 * TTS Type Definitions
 *
 * This file contains all TypeScript types used by the TTS (Text-to-Speech) system
 * in the reader. These types are shared between WebViewReader.tsx and useTTSController.ts
 *
 * @module reader/types/tts
 */

// ============================================================================
// WebView Event Data Types
// ============================================================================

/**
 * Base unknown event data type for type-safe event handling.
 * Used when event data hasn't been validated yet.
 */
export type UnknownEventData = unknown;

/**
 * TTS state persistence data from WebView.
 */
export type TTSPersistenceEventData = TTSPersistenceState;

/**
 * Exit dialog request data.
 */
export type TTSExitDialogData = {
  visible: number;
  ttsIndex: number;
};

/**
 * TTS confirmation request data.
 */
export type TTSConfirmationData = {
  savedIndex: number;
};

/**
 * Scroll sync prompt data.
 */
export type TTSScrollPromptEventData = {
  currentIndex: number;
  visibleIndex: number;
  currentChapterName?: string;
  visibleChapterName?: string;
  isStitched?: boolean;
};

/**
 * Chapter appended event data.
 */
export type ChapterAppendedData = {
  chapterId: number;
  chapterName: string;
  loadedChapters: string[];
};

/**
 * Stitched chapters cleared event data.
 */
export interface StitchedClearedData {
  chapterId: number;
  chapterName: string;
  localParagraphIndex?: number;
}

/**
 * Chapter transition event data.
 */
export interface ChapterTransitionData {
  previousChapterId: number;
  currentChapterId: number;
  currentChapterName: string;
  currentParagraphIndex?: number;
  reason: 'trim' | 'append';
}

// ============================================================================
// WebView Message Event
// ============================================================================

/**
 * WebView message event structure.
 * Messages are sent from the WebView JavaScript to React Native via postMessage.
 */
export type WebViewPostEvent = {
  /** The type of message (e.g., 'speak', 'stop-speak', 'tts-queue', etc.) */
  type: string;
  /** Optional data payload - varies by event type */
  data?: UnknownEventData;
  /** Starting paragraph index for TTS queue operations */
  startIndex?: number;
  /** Whether TTS should auto-start after WebView loads */
  autoStartTTS?: boolean;
  /** Current paragraph index being read */
  paragraphIndex?: number;
  /** Full TTS state object for persistence */
  ttsState?: TTSPersistenceState;
  /** Chapter ID for message validation (prevents stale message processing) */
  chapterId?: number;
};

// ============================================================================
// Type Guards for Event Data
// ============================================================================

/**
 * Type guard to check if data is an object with specific properties.
 */
export function isObjectWithProperties<T extends Record<string, unknown>>(
  data: unknown,
  properties: (keyof T)[],
): data is T {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }
  for (const prop of properties) {
    if (!(prop in data)) {
      return false;
    }
  }
  return true;
}

/**
 * Type guard for TTS persistence event data.
 */
export function isTTSPersistenceEventData(
  data: unknown,
): data is TTSPersistenceEventData {
  return isObjectWithProperties(data, ['paragraphIndex', 'timestamp']);
}

/**
 * Type guard for exit dialog event data.
 */
export function isTTSExitDialogData(data: unknown): data is TTSExitDialogData {
  return isObjectWithProperties(data, ['visible', 'ttsIndex']);
}

/**
 * Type guard for confirmation event data.
 */
export function isTTSConfirmationData(
  data: unknown,
): data is TTSConfirmationData {
  return isObjectWithProperties(data, ['savedIndex']);
}

/**
 * Type guard for scroll prompt event data.
 */
export function isTTSScrollPromptEventData(
  data: unknown,
): data is TTSScrollPromptEventData {
  return isObjectWithProperties(data, ['currentIndex', 'visibleIndex']);
}

/**
 * Type guard for chapter appended event data.
 */
export function isChapterAppendedData(
  data: unknown,
): data is ChapterAppendedData {
  return isObjectWithProperties(data, [
    'chapterId',
    'chapterName',
    'loadedChapters',
  ]);
}

/**
 * Type guard for stitched cleared event data.
 */
export function isStitchedClearedData(
  data: unknown,
): data is StitchedClearedData {
  return isObjectWithProperties(data, ['chapterId', 'chapterName']);
}

/**
 * Type guard for chapter transition event data.
 */
export function isChapterTransitionData(
  data: unknown,
): data is ChapterTransitionData {
  return isObjectWithProperties(data, [
    'previousChapterId',
    'currentChapterId',
    'currentChapterName',
    'reason',
  ]);
}

/**
 * TTS scroll prompt dialog data.
 * Shown when TTS position and visible scroll position are out of sync.
 */
export type TTSScrollPromptData = {
  /** Current TTS paragraph index */
  currentIndex: number;
  /** Currently visible paragraph index in viewport */
  visibleIndex: number; /** Chapter name at current TTS position (for stitched mode) */
  currentChapterName?: string;
  /** Chapter name at visible position (for stitched mode) */
  visibleChapterName?: string;
  /** Whether multiple chapters are stitched in DOM */
  isStitched?: boolean; /** Whether this prompt is for resume (vs initial start) */
  isResume?: boolean;
};

/**
 * Conflicting chapter for selection dialog.
 * Used when multiple chapters have saved TTS progress.
 */
export type ConflictingChapter = {
  /** Database chapter ID */
  id: number;
  /** Chapter name/title for display */
  name: string;
  /** Last saved paragraph index */
  paragraph: number;
};

/**
 * Sync dialog information.
 * Displayed when screen wakes and chapter needs to be synchronized.
 */
export type SyncDialogInfo = {
  /** Name of the chapter being synced to */
  chapterName: string;
  /** Paragraph index to resume from */
  paragraphIndex: number;
  /** Total paragraphs in the chapter */
  totalParagraphs: number;
  /** Reading progress percentage (0-100) */
  progress: number;
};

/**
 * TTS queue state for batch playback.
 * Maintains the current queue of paragraphs being spoken.
 */
export type TTSQueueState = {
  /** Index of first paragraph in the queue */
  startIndex: number;
  /** Array of paragraph texts to speak */
  texts: string[];
} | null;

/**
 * Exit dialog data for TTS position mismatch.
 * Shown when exiting reader with TTS at different position than scroll.
 */
export type ExitDialogData = {
  /** Current TTS paragraph position */
  ttsParagraph: number;
  /** Current reader scroll position */
  readerParagraph: number;
  /** Total paragraphs in the chapter */
  totalParagraphs: number;
};

/**
 * TTS persistence state.
 * Saved to database for resume functionality.
 */
export type TTSPersistenceState = {
  /** Current paragraph index */
  paragraphIndex: number;
  /** Timestamp of last update */
  timestamp: number;
  /** Whether TTS was actively reading */
  isReading?: boolean;
  /** Chapter ID for validation */
  chapterId?: number;
};

/**
 * Media action event from notification controls.
 */
export type MediaActionEvent = {
  /** Action identifier string */
  action: string;
};

/**
 * Speech event with utterance information.
 */
export type SpeechEvent = {
  /** Utterance ID in format "chapter_{id}_utterance_{index}" or legacy "utterance_{index}" */
  utteranceId?: string;
  /** Word start position (for highlighting) */
  start?: number;
  /** Word end position (for highlighting) */
  end?: number;
};

/**
 * Voice fallback event when primary voice is unavailable.
 */
export type VoiceFallbackEvent = {
  /** Original voice identifier that was requested */
  originalVoice: string;
  /** Fallback voice identifier that will be used */
  fallbackVoice: string;
};

/**
 * TTS media notification state update.
 */
export type TTSMediaState = {
  /** Novel name for notification */
  novelName: string;
  /** Chapter label for notification */
  chapterLabel: string;
  /** Current chapter ID */
  chapterId: number;
  /** Current paragraph index */
  paragraphIndex: number;
  /** Total paragraphs in chapter */
  totalParagraphs: number;
  /** Whether TTS is currently playing */
  isPlaying: boolean;
};

/**
 * TTS voice settings from reader settings.
 */
export type TTSVoiceSettings = {
  /** Voice identifier string */
  identifier?: string;
  /** Voice display name */
  name?: string;
  /** Voice language code */
  language?: string;
};

/**
 * TTS settings subset from ChapterReaderSettings.
 */
export type TTSSettings = {
  /** Selected voice */
  voice?: TTSVoiceSettings;
  /** Speech rate (0.5 - 2.0) */
  rate?: number;
  /** Speech pitch (0.5 - 2.0) */
  pitch?: number;
};

/**
 * Media navigation direction for chapter changes via notification.
 */
export type MediaNavDirection = 'NEXT' | 'PREV' | null;

/**
 * Sync dialog status states.
 */
export type SyncDialogStatus = 'syncing' | 'success' | 'failed';

/**
 * Constants for TTS behavior.
 */
export const TTS_CONSTANTS = {
  // ============================================================================
  // Queue Management Constants
  // ============================================================================
  /** Number of paragraphs to queue at once (batch size) */
  BATCH_SIZE: 25,
  /** Refill queue when this many items left */
  REFILL_THRESHOLD: 10,
  /** Start refilling earlier to avoid queue drain */
  PREFETCH_THRESHOLD: 12,
  /** Emergency threshold - attempt immediate refill if very low */
  EMERGENCY_THRESHOLD: 4,
  /** Calibrate queue cache every N spoken items */
  CALIBRATION_INTERVAL: 10,
  /** Detect and correct drift in lastKnownQueueSize */
  CACHE_DRIFT_THRESHOLD: 5,

  // ============================================================================
  // Timing Constants (milliseconds)
  // ============================================================================
  /** Debounce time for rapid media actions */
  MEDIA_ACTION_DEBOUNCE_MS: 500,
  /** Grace period after chapter transition to ignore stale events */
  CHAPTER_TRANSITION_GRACE_MS: 1000,
  /** Delay before TTS start/resume after state change */
  TTS_START_DELAY_MS: 500,
  /** Delay after chapter transition before WebView operations */
  CHAPTER_TRANSITION_DELAY_MS: 300,
  /** Delay for wake transition handling */
  WAKE_TRANSITION_DELAY_MS: 900,
  /** Wake transition retry delay */
  WAKE_TRANSITION_RETRY_MS: 300,
  /** Fallback delay after seek back failure */
  SEEK_BACK_FALLBACK_DELAY_MS: 120,
  /** Scroll lock reset delay */
  SCROLL_LOCK_RESET_MS: 600,
  /** Grace period for scroll-based saves after TTS stops */
  TTS_STOP_GRACE_PERIOD_MS: 2000,
  /** Auto-save interval for reader progress */
  AUTO_SAVE_INTERVAL_MS: 2222,
  /** Interval for battery level updates */
  BATTERY_UPDATE_INTERVAL_MS: 60000,
  /** Debounce for stale log messages to prevent spam */
  STALE_LOG_DEBOUNCE_MS: 500,

  // ============================================================================
  // Media Navigation Constants
  // ============================================================================
  /** Number of paragraphs to read before confirming media navigation */
  PARAGRAPHS_TO_CONFIRM_NAVIGATION: 5,
  /** Debounce time for wake resume to prevent premature action */
  WAKE_RESUME_DEBOUNCE_MS: 500,
  /** Additional debounce time for wake resume validation */
  WAKE_RESUBE_ADDITIONAL_DEBOUNCE_MS: 1000,

  // ============================================================================
  // Retry and Sync Constants
  // ============================================================================
  /** Maximum sync retry attempts */
  MAX_SYNC_RETRIES: 2,
  /** Maximum number of paragraphs to skip on seek */
  SEEK_SKIP_PARAGRAPHS: 5,
} as const;

/**
 * Media action intent strings from Android notification.
 */
export const TTS_MEDIA_ACTIONS = {
  PLAY_PAUSE: 'com.rajarsheechatterjee.LNReader.TTS.PLAY_PAUSE',
  SEEK_FORWARD: 'com.rajarsheechatterjee.LNReader.TTS.SEEK_FORWARD',
  SEEK_BACK: 'com.rajarsheechatterjee.LNReader.TTS.SEEK_BACK',
  PREV_CHAPTER: 'com.rajarsheechatterjee.LNReader.TTS.PREV_CHAPTER',
  NEXT_CHAPTER: 'com.rajarsheechatterjee.LNReader.TTS.NEXT_CHAPTER',
  STOP: 'com.rajarsheechatterjee.LNReader.TTS.STOP',
} as const;
