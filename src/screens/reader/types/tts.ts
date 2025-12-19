/**
 * TTS Type Definitions
 *
 * This file contains all TypeScript types used by the TTS (Text-to-Speech) system
 * in the reader. These types are shared between WebViewReader.tsx and useTTSController.ts
 *
 * @module reader/types/tts
 */

/**
 * WebView message event structure.
 * Messages are sent from the WebView JavaScript to React Native via postMessage.
 */
export type WebViewPostEvent = {
  /** The type of message (e.g., 'speak', 'stop-speak', 'tts-queue', etc.) */
  type: string;
  /** Optional data payload - can be key-value pairs or an array of strings */
  data?: { [key: string]: string | number } | string[];
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

/**
 * TTS scroll prompt dialog data.
 * Shown when TTS position and visible scroll position are out of sync.
 */
export type TTSScrollPromptData = {
  /** Current TTS paragraph index */
  currentIndex: number;
  /** Currently visible paragraph index in viewport */
  visibleIndex: number;
  /** Whether this prompt is for resume (vs initial start) */
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
  /** Number of paragraphs to read before confirming media navigation */
  PARAGRAPHS_TO_CONFIRM_NAVIGATION: 5,
  /** Debounce time for rapid media actions (ms) */
  MEDIA_ACTION_DEBOUNCE_MS: 500,
  /** Maximum sync retry attempts */
  MAX_SYNC_RETRIES: 2,
  /** Grace period after chapter transition to ignore stale events (ms) */
  CHAPTER_TRANSITION_GRACE_MS: 1000,
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
