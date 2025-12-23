import {
  DisplayModes,
  LibraryFilter,
  LibrarySortOrder,
} from '@screens/library/constants/constants';
import { useMMKVObject } from 'react-native-mmkv';
import { Voice } from 'expo-speech';

export const APP_SETTINGS = 'APP_SETTINGS';
export const BROWSE_SETTINGS = 'BROWSE_SETTINGS';
export const LIBRARY_SETTINGS = 'LIBRARY_SETTINGS';
export const CHAPTER_GENERAL_SETTINGS = 'CHAPTER_GENERAL_SETTINGS';
export const CHAPTER_READER_SETTINGS = 'CHAPTER_READER_SETTINGS';

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
   * - Range: 0.2 (20% - extremely compact) to 1.5 (150% - very spacious)
   * - Default: 0.8 (80% - comfortable, Material Design 3 adapted for mobile)
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
   * Continue to next chapter when TTS finishes current chapter.
   * - 'none': Stop at end of chapter (default)
   * - '5': Auto-continue up to 5 additional chapters
   * - '10': Auto-continue up to 10 additional chapters
   * - 'continuous': Keep auto-advancing until stopped or content ends
   */
  ttsContinueToNextChapter: 'none' | '5' | '10' | 'continuous';
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
  };
  epubLocation: string;
  epubUseAppTheme: boolean;
  epubUseCustomCSS: boolean;
  epubUseCustomJS: boolean;
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
  ttsContinueToNextChapter: 'none',
  ttsAutoDownload: 'disabled',
  ttsAutoDownloadAmount: '10',
  ttsForwardChapterReset: 'none',
  autoMarkShortChapters: true,
  continuousScrolling: 'disabled',
  continuousScrollBoundary: 'bordered',
  continuousScrollTransitionThreshold: 15,
  continuousScrollStitchThreshold: 90,
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
};

export const useAppSettings = () => {
  const [appSettings = initialAppSettings, setSettings] =
    useMMKVObject<AppSettings>(APP_SETTINGS);

  const setAppSettings = (values: Partial<AppSettings>) =>
    setSettings({ ...appSettings, ...values });

  return {
    ...appSettings,
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
