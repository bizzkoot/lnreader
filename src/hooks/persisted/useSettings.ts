import {
  DisplayModes,
  LibraryFilter,
  LibrarySortOrder,
} from '@screens/library/constants/constants';
import { useMMKVObject } from 'react-native-mmkv';
import { Voice } from 'expo-speech';
import { clampUIScale } from '@theme/scaling';
import { DoHProvider } from '@services/network/DoHManager';
import {
  TtsTextCleanupSettings,
  DEFAULT_TTS_CLEANUP_SETTINGS,
} from '@utils/htmlParagraphExtractor';
import { getMMKVObject } from '@utils/mmkv/mmkv';

export const APP_SETTINGS = 'APP_SETTINGS';

/**
 * Cooldown applied between sequential chapter downloads when no override
 * is configured. Matches the historical hard-coded sleep so installs
 * upgrading from earlier builds keep the same behaviour.
 */
export const DEFAULT_CHAPTER_DOWNLOAD_COOLDOWN_MS = 1000;

/**
 * Resolve the cooldown without subscribing to changes. Safe to call from
 * background services and the headless task runner.
 */
export const getChapterDownloadCooldownMs = (): number => {
  const settings = getMMKVObject<AppSettings>(APP_SETTINGS);
  const ms = settings?.chapterDownloadCooldownMs;
  return typeof ms === 'number' && Number.isFinite(ms) && ms >= 0
    ? ms
    : DEFAULT_CHAPTER_DOWNLOAD_COOLDOWN_MS;
};
export const BROWSE_SETTINGS = 'BROWSE_SETTINGS';
export const LIBRARY_SETTINGS = 'LIBRARY_SETTINGS';
export const CHAPTER_GENERAL_SETTINGS = 'CHAPTER_GENERAL_SETTINGS';
export const CHAPTER_READER_SETTINGS = 'CHAPTER_READER_SETTINGS';

export const SUPPORTED_LIBRARY_UPDATE_INTERVAL_HOURS = [
  0, 12, 24, 48, 72, 168,
] as const;

export type SupportedLibraryUpdateIntervalHours =
  (typeof SUPPORTED_LIBRARY_UPDATE_INTERVAL_HOURS)[number];

export const isSupportedLibraryUpdateIntervalHours = (
  value: unknown,
): value is SupportedLibraryUpdateIntervalHours =>
  typeof value === 'number' &&
  (SUPPORTED_LIBRARY_UPDATE_INTERVAL_HOURS as readonly number[]).includes(
    value,
  );

export const normalizeLibraryUpdateIntervalHours = (
  value: unknown,
): SupportedLibraryUpdateIntervalHours =>
  isSupportedLibraryUpdateIntervalHours(value) ? value : 0;

export interface AppSettings {
  /**
   * General settings
   */

  incognitoMode: boolean;
  disableHapticFeedback: boolean;

  /**
   * Appearence settings
   */

  showHistoryTab: boolean;
  showUpdatesTab: boolean;
  showLabelsInNav: boolean;
  useFabForContinueReading: boolean;
  disableLoadingAnimations: boolean;
  /**
   * UI Scale factor for app-wide UI element sizing (padding, margins, icons, etc.)
   * - Range: 0.8 (80%) to 1.3 (130%) - Safe range prevents UX disasters
   * - Default: 1.0 (100% - Material Design 3 baseline)
   * - Note: Does NOT affect chapter text size (use textSize for that)
   */
  uiScale: number;

  /**
   * Library settings
   */

  downloadedOnlyMode: boolean;
  useLibraryFAB: boolean;

  /**
   * Update settings
   */

  onlyUpdateOngoingNovels: boolean;
  updateLibraryOnLaunch: boolean;
  downloadNewChapters: boolean;
  refreshNovelMetadata: boolean;

  /**
   * Novel settings
   */

  hideBackdrop: boolean;
  defaultChapterSort: string;

  /**
   * Auto-download settings
   * Automatically download chapters when remaining downloaded chapters fall below threshold
   * - 'disabled': No auto-download
   * - '5': Auto-download when 5 or fewer chapters remain
   * - '10': Auto-download when 10 or fewer chapters remain
   * - '15': Auto-download when 15 or fewer chapters remain
   */
  autoDownloadOnRemaining: 'disabled' | '5' | '10' | '15';
  /**
   * Number of chapters to download when auto-download triggers
   */
  autoDownloadAmount: '5' | '10' | '15' | '20';
  /**
   * Cooldown between sequential chapter downloads in milliseconds.
   */
  chapterDownloadCooldownMs?: number;

  /**
   * Automatic backup settings
   * Backups are triggered when the app launches if enough time has passed
   */
  autoBackupFrequency: 'manual' | '6h' | '12h' | 'daily' | '2days' | 'weekly';
  /**
   * Maximum number of automatic backups to keep (oldest are deleted)
   */
  maxAutoBackups: 1 | 2 | 3 | 4 | 5;

  /**
   * Backup contents selection for local backups.
   * When true, that category is included in the backup zip.
   */
  backupIncludeOptions?: {
    settings: boolean;
    novelsAndChapters: boolean;
    categories: boolean;
    repositories: boolean;
    downloads: boolean;
  };

  /**
   * DNS-over-HTTPS provider
   * - DoHProvider.DISABLED: Use system DNS (default)
   * - DoHProvider.CLOUDFLARE: Cloudflare DoH (1.1.1.1)
   * - DoHProvider.GOOGLE: Google DoH (8.8.8.8)
   * - DoHProvider.ADGUARD: AdGuard DoH (94.140.14.140)
   */
  doHProvider: DoHProvider;

  /**
   * Reading time tracking (PRD 3.2, smallest safe impl)
   * - readingTimeTrackingEnabled: opt-in manual reading timer; TTS PLAYING pauses it
   * - readingTimeInactivityTimeoutMs: 0 = never auto-pause on inactivity, else auto-pause after N ms without user activity
   */
  readingTimeTrackingEnabled?: boolean;
  readingTimeInactivityTimeoutMs?: number;

  /**
   * Scheduled background library updates (PRD 3.4)
   * - 0 = off (default)
   * - Supported intervals: 12, 24, 48, 72, 168 hours
   */
  automaticLibraryUpdateIntervalHours?: number;
}

export interface BrowseSettings {
  showMyAnimeList: boolean;
  showAniList: boolean;
  globalSearchConcurrency?: number;
}

export interface LibrarySettings {
  sortOrder?: LibrarySortOrder;
  filter?: LibraryFilter;
  showDownloadBadges?: boolean;
  showUnreadBadges?: boolean;
  showNumberOfNovels?: boolean;
  displayMode?: DisplayModes;
  novelsPerRow?: number;
  incognitoMode?: boolean;
  downloadedOnlyMode?: boolean;
}

export interface ChapterGeneralSettings {
  keepScreenOn: boolean;
  fullScreenMode: boolean;
  pageReader: boolean;
  swipeGestures: boolean;
  showScrollPercentage: boolean;
  useVolumeButtons: boolean;
  volumeButtonsOffset: number | null;
  showBatteryAndTime: boolean;
  autoScroll: boolean;
  autoScrollInterval: number;
  autoScrollOffset: number | null;
  verticalSeekbar: boolean;
  removeExtraParagraphSpacing: boolean;
  bionicReading: boolean;
  tapToScroll: boolean;
  TTSEnable: boolean;
  showParagraphHighlight: boolean;
  ttsAutoResume: 'always' | 'prompt' | 'never';
  ttsScrollPrompt: 'always-ask' | 'auto-change' | 'never-change';
  ttsScrollBehavior: 'continue' | 'pause-on-scroll';
  ttsBackgroundPlayback: boolean;
  /**
   * Auto-stop playback after a limit.
   * - 'off': no limit
   * - 'minutes': stop after N minutes from start
   * - 'chapters': stop after N chapters finish
   * - 'paragraphs': stop after N paragraphs are spoken
   */
  ttsAutoStopMode: 'off' | 'paragraphs' | 'chapters' | 'minutes';
  /**
   * Limit value for the selected auto-stop mode.
   * Meaning depends on mode: minutes | chapters | paragraphs.
   */
  ttsAutoStopAmount: number;
  /**
   * TTS-specific auto-download setting.
   * When TTS is playing and remaining downloaded chapters fall below threshold,
   * automatically download more chapters.
   * - 'disabled': Use app-level auto-download setting (Step 1)
   * - '5': Auto-download when 5 or fewer chapters remain
   * - '10': Auto-download when 10 or fewer chapters remain
   * Works even when screen is off.
   */
  ttsAutoDownload: 'disabled' | '5' | '10';
  /**
   * Number of chapters to download when TTS auto-download triggers
   */
  ttsAutoDownloadAmount: '5' | '10' | '15';
  /**
   * Control chapter progress reset behavior when starting TTS on a previous chapter
   * - 'none': Don't reset ANY future chapters (default)
   * - 'reset-next': Reset only the immediate next chapter's progress
   * - 'reset-until-5': Reset progress for next 5 chapters
   * - 'reset-until-10': Reset progress for next 10 chapters
   * - 'reset-all': Reset progress for ALL future chapters
   */
  ttsForwardChapterReset:
    | 'none'
    | 'reset-next'
    | 'reset-until-5'
    | 'reset-until-10'
    | 'reset-all';
  /**
   * Automatically mark short chapters (that fit entirely on screen) as 100% read
   * when navigating to the next chapter.
   * - true: Auto-mark short chapters (default)
   * - false: Don't auto-mark
   */
  autoMarkShortChapters: boolean;
  /**
   * Continuous scrolling mode - automatically load next chapter when scrolling near the end
   * - 'disabled': Manual navigation only (default)
   * - 'always': Auto-load next chapter at 95% scroll
   * - 'ask': Show confirmation dialog before loading
   */
  continuousScrolling: 'disabled' | 'always' | 'ask';
  /**
   * Chapter boundary display style for continuous scrolling
   * Only applies when continuousScrolling is not 'disabled'
   * - 'bordered': Show chapter markers with gap (default)
   * - 'stitched': Seamless flow without visual separation
   */
  continuousScrollBoundary: 'stitched' | 'bordered';
  /**
   * Threshold for automatic chapter transition when using continuous scrolling.
   * When user scrolls past this percentage into an appended chapter, the app
   * automatically navigates to that chapter (clears previous chapter from DOM).
   * This keeps DOM clean and prevents TTS issues.
   *
   * Options: 5, 10, 15, 20 (percent)
   * Default: 15
   */
  continuousScrollTransitionThreshold: 5 | 10 | 15 | 20;
  /**
   * Threshold for automatic chapter stitching when using continuous scrolling.
   * When user scrolls past this percentage in current chapter, automatically
   * fetch and append the next chapter to the DOM.
   *
   * Options: 50, 55, 60, 65, 70, 75, 80, 85, 90, 95 (percent)
   * Default: 90
   */
  continuousScrollStitchThreshold:
    | 50
    | 55
    | 60
    | 65
    | 70
    | 75
    | 80
    | 85
    | 90
    | 95;
  /**
   * Show discoverability hint toast for TTS floating button gestures
   */
  ttsShowGestureHints: boolean;
  /**
   * TTS text cleanup pipeline applied to every paragraph before it reaches
   * the native TTS engine. Includes ordered find/replace rules, a phonetic
   * pronunciation dictionary, and optional Unicode normalization.
   * Applied across ALL playback modes and paths (initial queue, WebView
   * refills, fallback single-speak). Length-preserving: never drops or merges
   * paragraphs, so the RN <-> WebView paragraph index contract stays intact.
   */
  ttsTextCleanup: TtsTextCleanupSettings;
}

export interface ReaderTheme {
  backgroundColor: string;
  textColor: string;
}

export interface ChapterReaderSettings {
  theme: string;
  textColor: string;
  textSize: number;
  textAlign: string;
  padding: number;
  fontFamily: string;
  lineHeight: number;
  customCSS: string;
  customJS: string;
  customThemes: ReaderTheme[];
  tts?: {
    voice?: Voice;
    rate?: number;
    pitch?: number;
    engine?: string;
  };
  epubLocation: string;
  epubUseAppTheme: boolean;
  epubUseCustomCSS: boolean;
  epubUseCustomJS: boolean;
  epubIncludeChapterNumber: boolean;
}

const initialAppSettings: AppSettings = {
  /**
   * General settings
   */

  incognitoMode: false,
  disableHapticFeedback: false,

  /**
   * Appearence settings
   */

  showHistoryTab: true,
  showUpdatesTab: true,
  showLabelsInNav: true,
  useFabForContinueReading: false,
  disableLoadingAnimations: false,
  uiScale: 1.0,

  /**
   * Library settings
   */

  downloadedOnlyMode: false,
  useLibraryFAB: false,

  /**
   * Update settings
   */

  onlyUpdateOngoingNovels: false,
  updateLibraryOnLaunch: false,
  downloadNewChapters: false,
  refreshNovelMetadata: false,

  /**
   * Novel settings
   */

  hideBackdrop: false,
  defaultChapterSort: 'ORDER BY position ASC',

  /**
   * Auto-download settings
   */

  autoDownloadOnRemaining: 'disabled',
  autoDownloadAmount: '10',

  /**
   * Automatic backup settings
   */
  autoBackupFrequency: 'manual',
  maxAutoBackups: 2,

  backupIncludeOptions: {
    settings: true,
    novelsAndChapters: true,
    categories: true,
    repositories: true,
    downloads: true,
  },

  /**
   * DNS-over-HTTPS provider
   */
  doHProvider: DoHProvider.DISABLED,

  /**
   * Reading time tracking (PRD 3.2)
   */
  readingTimeTrackingEnabled: true,
  readingTimeInactivityTimeoutMs: 0,

  /**
   * Scheduled background library updates (PRD 3.4)
   */
  automaticLibraryUpdateIntervalHours: 0,
};

const initialBrowseSettings: BrowseSettings = {
  showMyAnimeList: true,
  showAniList: true,
  globalSearchConcurrency: 3,
};

export const initialChapterGeneralSettings: ChapterGeneralSettings = {
  keepScreenOn: true,
  fullScreenMode: true,
  pageReader: false,
  swipeGestures: false,
  showScrollPercentage: true,
  useVolumeButtons: false,
  volumeButtonsOffset: null,
  showBatteryAndTime: false,
  autoScroll: false,
  autoScrollInterval: 10,
  autoScrollOffset: null,
  verticalSeekbar: true,
  removeExtraParagraphSpacing: false,
  bionicReading: false,
  tapToScroll: false,
  TTSEnable: false,
  showParagraphHighlight: true,
  ttsAutoResume: 'prompt',
  ttsScrollPrompt: 'always-ask',
  ttsScrollBehavior: 'continue',
  ttsBackgroundPlayback: true,
  ttsAutoStopMode: 'off',
  ttsAutoStopAmount: 0,
  ttsAutoDownload: 'disabled',
  ttsAutoDownloadAmount: '10',
  ttsForwardChapterReset: 'none',
  autoMarkShortChapters: true,
  continuousScrolling: 'disabled',
  continuousScrollBoundary: 'bordered',
  continuousScrollTransitionThreshold: 15,
  continuousScrollStitchThreshold: 90,
  ttsShowGestureHints: true,
  ttsTextCleanup: DEFAULT_TTS_CLEANUP_SETTINGS,
};

export const initialChapterReaderSettings: ChapterReaderSettings = {
  theme: '#292832',
  textColor: '#CCCCCC',
  textSize: 16,
  textAlign: 'left',
  padding: 16,
  fontFamily: '',
  lineHeight: 1.5,
  customCSS: '',
  customJS: '',
  customThemes: [],
  tts: {
    rate: 1,
    pitch: 1,
  },
  epubLocation: '',
  epubUseAppTheme: false,
  epubUseCustomCSS: false,
  epubUseCustomJS: false,
  epubIncludeChapterNumber: false,
};

export const useAppSettings = () => {
  const [appSettings = initialAppSettings, setSettings] =
    useMMKVObject<AppSettings>(APP_SETTINGS);

  // Clamp uiScale on load (migration for existing out-of-range values)
  const clampedSettings = {
    ...appSettings,
    uiScale: clampUIScale(appSettings.uiScale ?? 1.0),
    automaticLibraryUpdateIntervalHours: normalizeLibraryUpdateIntervalHours(
      appSettings.automaticLibraryUpdateIntervalHours,
    ),
  };

  const setAppSettings = (values: Partial<AppSettings>) => {
    // Clamp uiScale on write
    const valuesToSet = { ...values };
    if (valuesToSet.uiScale !== undefined) {
      valuesToSet.uiScale = clampUIScale(valuesToSet.uiScale);
    }
    if (valuesToSet.automaticLibraryUpdateIntervalHours !== undefined) {
      valuesToSet.automaticLibraryUpdateIntervalHours =
        normalizeLibraryUpdateIntervalHours(
          valuesToSet.automaticLibraryUpdateIntervalHours,
        );
    }
    setSettings({ ...clampedSettings, ...valuesToSet });
  };

  return {
    ...clampedSettings,
    setAppSettings,
  };
};

export const useBrowseSettings = () => {
  const [browseSettings = initialBrowseSettings, setSettings] =
    useMMKVObject<BrowseSettings>(BROWSE_SETTINGS);

  const setBrowseSettings = (values: Partial<BrowseSettings>) =>
    setSettings({ ...browseSettings, ...values });

  return {
    ...browseSettings,
    setBrowseSettings,
  };
};

const defaultLibrarySettings: LibrarySettings = {
  showNumberOfNovels: false,
  downloadedOnlyMode: false,
  incognitoMode: false,
  displayMode: DisplayModes.Comfortable,
  showDownloadBadges: true,
  showUnreadBadges: true,
  novelsPerRow: 3,
  sortOrder: LibrarySortOrder.DateAdded_DESC,
};

export const useLibrarySettings = () => {
  const [librarySettings, setSettings] =
    useMMKVObject<LibrarySettings>(LIBRARY_SETTINGS);

  const setLibrarySettings = (value: Partial<LibrarySettings>) =>
    setSettings({ ...librarySettings, ...value });

  return {
    ...{ ...defaultLibrarySettings, ...librarySettings },
    setLibrarySettings,
  };
};

export const useChapterGeneralSettings = () => {
  const [chapterGeneralSettings = initialChapterGeneralSettings, setSettings] =
    useMMKVObject<ChapterGeneralSettings>(CHAPTER_GENERAL_SETTINGS);

  const setChapterGeneralSettings = (values: Partial<ChapterGeneralSettings>) =>
    setSettings({ ...chapterGeneralSettings, ...values });

  return {
    ...chapterGeneralSettings,
    setChapterGeneralSettings,
  };
};

export const useChapterReaderSettings = () => {
  const [chapterReaderSettings = initialChapterReaderSettings, setSettings] =
    useMMKVObject<ChapterReaderSettings>(CHAPTER_READER_SETTINGS);

  const setChapterReaderSettings = (values: Partial<ChapterReaderSettings>) =>
    setSettings({ ...chapterReaderSettings, ...values });

  const saveCustomReaderTheme = (theme: ReaderTheme) =>
    setSettings({
      ...chapterReaderSettings,
      customThemes: [theme, ...chapterReaderSettings.customThemes],
    });

  const deleteCustomReaderTheme = (theme: ReaderTheme) =>
    setSettings({
      ...chapterReaderSettings,
      customThemes: chapterReaderSettings.customThemes.filter(
        v =>
          !(
            v.backgroundColor === theme.backgroundColor &&
            v.textColor === theme.textColor
          ),
      ),
    });

  return {
    ...chapterReaderSettings,
    setChapterReaderSettings,
    saveCustomReaderTheme,
    deleteCustomReaderTheme,
  };
};
