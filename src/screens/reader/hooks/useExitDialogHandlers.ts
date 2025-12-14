/**
 * useExitDialogHandlers Hook
 *
 * Handlers for exit dialog (save TTS vs reader position).
 * Extracted from useTTSController.ts (Phase 1, Step 4)
 *
 * @module reader/hooks/useExitDialogHandlers
 */

import { useCallback } from 'react';
import { ExitDialogData } from '../types/tts';

/**
 * Exit dialog handlers parameters
 */
export interface ExitDialogHandlersParams {
  exitDialogData: ExitDialogData;
  saveProgress: (progress: number) => void;
  navigation: any; // NavigationProp type
  callbacks: {
    handleStopTTS: () => void;
    setShowExitDialog: (show: boolean) => void;
  };
}

/**
 * Exit dialog handlers interface
 */
export interface ExitDialogHandlers {
  handleExitTTS: () => void;
  handleExitReader: () => void;
}

/**
 * Custom hook that provides exit dialog handlers
 *
 * @param params - Exit dialog handlers parameters
 * @returns Exit dialog handlers
 */
export function useExitDialogHandlers(
  params: ExitDialogHandlersParams,
): ExitDialogHandlers {
  const {
    exitDialogData,
    saveProgress,
    navigation,
    callbacks: { handleStopTTS, setShowExitDialog },
  } = params;

  /**
   * Handle exit TTS - save TTS position and navigate back
   */
  const handleExitTTS = useCallback(() => {
    setShowExitDialog(false);
    handleStopTTS();
    saveProgress(exitDialogData.ttsParagraph);
    navigation.goBack();
  }, [
    handleStopTTS,
    saveProgress,
    exitDialogData.ttsParagraph,
    navigation,
    setShowExitDialog,
  ]);

  /**
   * Handle exit reader - save reader position and navigate back
   */
  const handleExitReader = useCallback(() => {
    setShowExitDialog(false);
    handleStopTTS();
    saveProgress(exitDialogData.readerParagraph);
    navigation.goBack();
  }, [
    handleStopTTS,
    saveProgress,
    exitDialogData.readerParagraph,
    navigation,
    setShowExitDialog,
  ]);

  return {
    handleExitTTS,
    handleExitReader,
  };
}

export default useExitDialogHandlers;
