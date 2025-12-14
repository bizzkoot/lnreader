/**
 * useDialogState Hook
 *
 * Manages all TTS-related dialog visibility state.
 * Extracted from useTTSController.ts (Phase 1, Step 1)
 *
 * @module reader/hooks/useDialogState
 */

import { useState } from 'react';
import { useBoolean } from '@hooks';
import {
  ExitDialogData,
  ConflictingChapter,
  SyncDialogStatus,
  SyncDialogInfo,
} from '../types/tts';

/**
 * Dialog state interface
 */
export interface DialogState {
  // Resume Dialog
  resumeDialogVisible: boolean;
  showResumeDialog: () => void;
  hideResumeDialog: () => void;

  // Scroll Sync Dialog
  scrollSyncDialogVisible: boolean;
  showScrollSyncDialog: () => void;
  hideScrollSyncDialog: () => void;

  // Manual Mode Dialog
  manualModeDialogVisible: boolean;
  showManualModeDialog: () => void;
  hideManualModeDialog: () => void;

  // Exit Dialog
  showExitDialog: boolean;
  setShowExitDialog: (show: boolean) => void;
  exitDialogData: ExitDialogData;
  setExitDialogData: (data: ExitDialogData) => void;

  // Chapter Selection Dialog
  showChapterSelectionDialog: boolean;
  setShowChapterSelectionDialog: (show: boolean) => void;
  conflictingChapters: ConflictingChapter[];
  setConflictingChapters: (chapters: ConflictingChapter[]) => void;

  // Sync Dialog
  syncDialogVisible: boolean;
  setSyncDialogVisible: (visible: boolean) => void;
  syncDialogStatus: SyncDialogStatus;
  setSyncDialogStatus: (status: SyncDialogStatus) => void;
  syncDialogInfo?: SyncDialogInfo;
  setSyncDialogInfo: (info: SyncDialogInfo | undefined) => void;
}

/**
 * Custom hook that manages all TTS dialog state
 *
 * @returns Dialog state and handlers
 */
export function useDialogState(): DialogState {
  // Resume dialog
  const {
    value: resumeDialogVisible,
    setTrue: showResumeDialog,
    setFalse: hideResumeDialog,
  } = useBoolean();

  // Scroll sync dialog
  const {
    value: scrollSyncDialogVisible,
    setTrue: showScrollSyncDialog,
    setFalse: hideScrollSyncDialog,
  } = useBoolean();

  // Manual mode dialog
  const {
    value: manualModeDialogVisible,
    setTrue: showManualModeDialog,
    setFalse: hideManualModeDialog,
  } = useBoolean();

  // Exit dialog
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [exitDialogData, setExitDialogData] = useState<ExitDialogData>({
    ttsParagraph: 0,
    readerParagraph: 0,
  });

  // Chapter selection dialog
  const [showChapterSelectionDialog, setShowChapterSelectionDialog] =
    useState(false);
  const [conflictingChapters, setConflictingChapters] = useState<
    ConflictingChapter[]
  >([]);

  // Sync dialog
  const [syncDialogVisible, setSyncDialogVisible] = useState(false);
  const [syncDialogStatus, setSyncDialogStatus] =
    useState<SyncDialogStatus>('syncing');
  const [syncDialogInfo, setSyncDialogInfo] = useState<
    SyncDialogInfo | undefined
  >(undefined);

  return {
    // Resume Dialog
    resumeDialogVisible,
    showResumeDialog,
    hideResumeDialog,

    // Scroll Sync Dialog
    scrollSyncDialogVisible,
    showScrollSyncDialog,
    hideScrollSyncDialog,

    // Manual Mode Dialog
    manualModeDialogVisible,
    showManualModeDialog,
    hideManualModeDialog,

    // Exit Dialog
    showExitDialog,
    setShowExitDialog,
    exitDialogData,
    setExitDialogData,

    // Chapter Selection Dialog
    showChapterSelectionDialog,
    setShowChapterSelectionDialog,
    conflictingChapters,
    setConflictingChapters,

    // Sync Dialog
    syncDialogVisible,
    setSyncDialogVisible,
    syncDialogStatus,
    setSyncDialogStatus,
    syncDialogInfo,
    setSyncDialogInfo,
  };
}

export default useDialogState;
