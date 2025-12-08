import {
  NativeModules,
  NativeEventEmitter,
  EmitterSubscription,
} from 'react-native';

const { TTSHighlight } = NativeModules;

const ttsEmitter = new NativeEventEmitter(TTSHighlight);

export type TTSAudioParams = {
  rate?: number;
  pitch?: number;
  voice?: string;
  utteranceId?: string;
};

// BUG FIX: Increased batch size and refill threshold to prevent queue exhaustion
// during fast speech or short paragraphs. The race condition occurs when:
// 1. refillQueue() starts async call to get queue size
// 2. Native TTS continues speaking and exhausts remaining utterances
// 3. onQueueEmpty fires before refill completes
// Larger margins give more buffer time.
const BATCH_SIZE = 25; // Number of paragraphs to queue at once (was 15)
const REFILL_THRESHOLD = 10; // Refill queue when this many items left (was 5)

// eslint-disable-next-line no-console
const logDebug = __DEV__ ? console.log : () => {};
// eslint-disable-next-line no-console
const logError = __DEV__ ? console.error : () => {};

class TTSAudioManager {
  private isPlaying = false;
  private currentQueue: string[] = [];
  private currentUtteranceIds: string[] = [];
  private currentIndex = 0;
  private eventListeners: EmitterSubscription[] = [];
  private onDoneCallback?: (utteranceId: string) => void;
  private onQueueEmptyCallback?: () => void;
  // @ts-expect-error Reserved for future use
  private _onQueueLowCallback?: () => void;
  // Track if we've already logged "no more items" to reduce spam
  private hasLoggedNoMoreItems = false;
  // BUG FIX: Track if a restart operation is in progress to prevent
  // onQueueEmpty from firing during intentional stop/restart cycles
  private restartInProgress = false;
  // BUG FIX: Track if a refill operation is in progress to prevent
  // premature onQueueEmpty from triggering chapter navigation
  private refillInProgress = false;
  // BUG FIX: Track last successfully spoken paragraph index for monotonic enforcement
  private lastSpokenIndex = -1;

  /**
   * Mark that a restart operation is beginning.
   * This prevents onQueueEmpty from firing during intentional stop/restart cycles.
   */
  setRestartInProgress(value: boolean) {
    this.restartInProgress = value;
    logDebug(`TTSAudioManager: restartInProgress set to ${value}`);
  }

  /**
   * Check if a restart operation is in progress.
   */
  isRestartInProgress(): boolean {
    return this.restartInProgress;
  }

  /**
   * Mark that a refill operation is beginning.
   * This prevents onQueueEmpty from firing during async refill operations.
   */
  setRefillInProgress(value: boolean) {
    this.refillInProgress = value;
    logDebug(`TTSAudioManager: refillInProgress set to ${value}`);
  }

  /**
   * Check if a refill operation is in progress.
   */
  isRefillInProgress(): boolean {
    return this.refillInProgress;
  }

  /**
   * Check if there are remaining items in the JS queue that haven't been
   * sent to the native queue yet. This is used to prevent premature
   * onQueueEmpty events from triggering chapter navigation.
   */
  hasRemainingItems(): boolean {
    return this.currentIndex < this.currentQueue.length;
  }

  /**
   * Get the last spoken paragraph index.
   */
  getLastSpokenIndex(): number {
    return this.lastSpokenIndex;
  }

  /**
   * Set the last spoken paragraph index with monotonic enforcement.
   * Only accepts forward progression; backward moves are logged as errors.
   */
  setLastSpokenIndex(index: number) {
    if (index > this.lastSpokenIndex) {
      this.lastSpokenIndex = index;
      logDebug(`TTSAudioManager: lastSpokenIndex updated to ${index}`);
    } else if (index === this.lastSpokenIndex) {
      logDebug(`TTSAudioManager: Same index spoken again: ${index}`);
    } else {
      logError(
        `TTSAudioManager: BACKWARD index detected! ${index} < ${this.lastSpokenIndex}`,
      );
    }
  }

  /**
   * Reset last spoken index (called on new batch or chapter change).
   */
  resetLastSpokenIndex() {
    this.lastSpokenIndex = -1;
    logDebug('TTSAudioManager: lastSpokenIndex reset to -1');
  }

  async speak(text: string, params: TTSAudioParams = {}): Promise<string> {
    try {
      const rate = params.rate || 1;
      const pitch = params.pitch || 1;
      const voice = params.voice;
      const utteranceId = params.utteranceId || Date.now().toString();

      await TTSHighlight.speak(text, {
        utteranceId,
        rate,
        pitch,
        voice,
      });

      this.isPlaying = true;
      return utteranceId;
    } catch (error) {
      logError('TTSAudioManager: Failed to speak text:', error);
      throw error;
    }
  }

  async speakBatch(
    texts: string[],
    utteranceIds: string[],
    params: TTSAudioParams = {},
  ): Promise<number> {
    if (texts.length === 0) {
      return 0;
    }
    let attempts = 0;
    let lastError: any = null;
    const maxAttempts = 2;
    const rate = params.rate || 1;
    const pitch = params.pitch || 1;
    const voice = params.voice;
    while (attempts < maxAttempts) {
      try {
        // Clear any existing queue state before starting new batch
        this.currentQueue = [];
        this.currentUtteranceIds = [];
        this.currentIndex = 0;
        // BUG FIX: Reset last spoken index for new session
        this.resetLastSpokenIndex();
        const batchTexts = texts.slice(0, BATCH_SIZE);

        const batchIds = utteranceIds.slice(0, BATCH_SIZE);
        await TTSHighlight.speakBatch(batchTexts, batchIds, {
          rate,
          pitch,
          voice,
        });
        this.currentQueue = texts;
        this.currentUtteranceIds = utteranceIds;
        this.currentIndex = BATCH_SIZE;
        this.isPlaying = true;
        this.hasLoggedNoMoreItems = false;
        // BUG FIX: Clear restart flag now that new queue is populated
        this.restartInProgress = false;
        logDebug(
          `TTSAudioManager: Started batch playback with ${
            batchTexts.length
          } items, ${texts.length - BATCH_SIZE} remaining`,
        );
        if (this.eventListeners.length === 0) {
          logDebug('TTSAudioManager: Setting up auto-refill subscription');
          const subscription = ttsEmitter.addListener(
            'onSpeechDone',
            async _event => {
              await this.refillQueue();
            },
          );
          this.eventListeners.push(subscription);
        }
        return batchTexts.length;
      } catch (error) {
        lastError = error;
        attempts++;
      }
    }
    // Fallback: try batch with system default voice
    try {
      const batchTexts = texts.slice(0, BATCH_SIZE);
      const batchIds = utteranceIds.slice(0, BATCH_SIZE);
      await TTSHighlight.speakBatch(batchTexts, batchIds, {
        rate,
        pitch,
        voice: undefined,
      });
      // Fallback notification: log warning
      logError(
        'Preferred TTS voice unavailable for batch, using system default.',
      );
      this.currentQueue = texts;
      this.currentUtteranceIds = utteranceIds;
      this.currentIndex = BATCH_SIZE;
      this.isPlaying = true;
      this.hasLoggedNoMoreItems = false;
      logDebug(
        `TTSAudioManager: Started batch playback with fallback voice, ${
          batchTexts.length
        } items, ${texts.length - BATCH_SIZE} remaining`,
      );
      if (this.eventListeners.length === 0) {
        logDebug('TTSAudioManager: Setting up auto-refill subscription');
        const subscription = ttsEmitter.addListener(
          'onSpeechDone',
          async _event => {
            await this.refillQueue();
          },
        );
        this.eventListeners.push(subscription);
      }
      return batchTexts.length;
    } catch (error) {
      logError('TTSAudioManager: Failed to speak batch after fallback:', error);
      throw lastError || error;
    }
  }

  async refillQueue(): Promise<boolean> {
    if (this.currentIndex >= this.currentQueue.length) {
      // Only log once to reduce spam
      if (!this.hasLoggedNoMoreItems) {
        logDebug('TTSAudioManager: No more items to refill');
        this.hasLoggedNoMoreItems = true;
      }
      return false;
    }

    // Reset the "no more items" flag since we have items to refill
    this.hasLoggedNoMoreItems = false;

    // BUG FIX: Set refill in progress flag to prevent premature onQueueEmpty
    this.refillInProgress = true;
    logDebug('TTSAudioManager: Starting refill operation');

    try {
      const queueSize = await TTSHighlight.getQueueSize();

      if (queueSize > REFILL_THRESHOLD) {
        // Still enough items in queue
        this.refillInProgress = false;
        return false;
      }

      // Add next batch
      const remainingCount = this.currentQueue.length - this.currentIndex;
      const nextBatchSize = Math.min(BATCH_SIZE, remainingCount);

      const nextTexts = this.currentQueue.slice(
        this.currentIndex,
        this.currentIndex + nextBatchSize,
      );
      const nextIds = this.currentUtteranceIds.slice(
        this.currentIndex,
        this.currentIndex + nextBatchSize,
      );

      // Try addToBatch with retries — native service can intermittently reject
      const maxAddAttempts = 3;
      let addSucceeded = false;
      let addError: any = null;
      for (let attempt = 1; attempt <= maxAddAttempts; attempt++) {
        try {
          logDebug(
            `TTSAudioManager: addToBatch attempt ${attempt} (${nextBatchSize} items)`,
          );
          await TTSHighlight.addToBatch(nextTexts, nextIds);
          addSucceeded = true;
          break;
        } catch (err) {
          addError = err;
          logError(
            `TTSAudioManager: addToBatch failed (attempt ${attempt}):`,
            err,
          );
          // small backoff
          await new Promise(res => setTimeout(res, 150 * attempt));
        }
      }

      if (!addSucceeded) {
        // If addToBatch failed repeatedly, check queue size — if it's empty we can try speakBatch
        try {
          const queueSizeAfter = await TTSHighlight.getQueueSize();
          logDebug(
            'TTSAudioManager: Queue size after failed addToBatch:',
            queueSizeAfter,
          );
          if (queueSizeAfter === 0) {
            logError(
              'TTSAudioManager: Queue empty after failed addToBatch — attempting speakBatch as fallback',
            );
            await TTSHighlight.speakBatch(nextTexts, nextIds);
            this.currentIndex += nextBatchSize;
            logDebug(
              `TTSAudioManager: speakBatch fallback started ${nextBatchSize} items`,
            );
            this.refillInProgress = false;
            return true;
          }
        } catch (err2) {
          logError('TTSAudioManager: Fallback speakBatch also failed:', err2);
        }

        // Ultimately fail the refill
        logError(
          'TTSAudioManager: Failed to add next batch to native queue after retries.',
          addError,
        );
        this.refillInProgress = false;
        return false;
      }

      this.currentIndex += nextBatchSize;

      logDebug(
        `TTSAudioManager: Refilled queue with ${nextBatchSize} items, ${
          this.currentQueue.length - this.currentIndex
        } remaining`,
      );

      this.refillInProgress = false;
      return true;
    } catch (error) {
      logError('TTSAudioManager: Failed to refill queue:', error);
      this.refillInProgress = false;
      return false;
    }
  }

  async stop(): Promise<boolean> {
    try {
      await TTSHighlight.stop();

      this.isPlaying = false;
      this.currentQueue = [];
      this.currentUtteranceIds = [];
      this.currentIndex = 0;
      // NOTE: Do NOT clear restartInProgress here - it's managed by the caller
      // to prevent onQueueEmpty from firing during intentional restart cycles

      logDebug('TTSAudioManager: Playback stopped');
      return true;
    } catch (error) {
      logError('TTSAudioManager: Failed to stop playback:', error);
      return false;
    }
  }

  /**
   * Stop playback AND clear the restart flag.
   * Use this for user-initiated stops (not for restart operations).
   */
  async fullStop(): Promise<boolean> {
    this.restartInProgress = false;
    return this.stop();
  }

  async getQueueSize(): Promise<number> {
    try {
      return await TTSHighlight.getQueueSize();
    } catch (error) {
      logError('TTSAudioManager: Failed to get queue size:', error);
      return 0;
    }
  }

  getProgress(): { current: number; total: number; percentage: number } {
    const total = this.currentQueue.length;
    const current = this.currentIndex;
    const percentage = total > 0 ? (current / total) * 100 : 0;

    return { current, total, percentage };
  }

  // Event handling
  onSpeechDone(callback: (utteranceId: string) => void) {
    this.onDoneCallback = callback;

    const subscription = ttsEmitter.addListener('onSpeechDone', event => {
      if (this.onDoneCallback) {
        this.onDoneCallback(event.utteranceId);
      }

      // Auto-refill queue
      this.refillQueue();
    });

    this.eventListeners.push(subscription);
  }

  /**
   * Called when the native TTS queue is completely empty.
   * This means all queued utterances have been spoken and the chapter has ended.
   * Use this to trigger next chapter loading when screen is off.
   */
  onQueueEmpty(callback: () => void) {
    this.onQueueEmptyCallback = callback;

    const subscription = ttsEmitter.addListener('onQueueEmpty', () => {
      // BUG FIX: Don't fire callback if a restart operation is in progress
      // This prevents false "queue empty" signals during intentional stop/restart cycles
      if (this.restartInProgress) {
        logDebug('TTSAudioManager: onQueueEmpty ignored - restart in progress');
        return;
      }

      // BUG FIX: Don't fire callback if a refill operation is in progress
      // This prevents premature chapter navigation when async refill is still running
      if (this.refillInProgress) {
        logDebug('TTSAudioManager: onQueueEmpty ignored - refill in progress');
        return;
      }

      // BUG FIX: Check if we still have items to refill - if so, this is a false alarm
      // Native queue might be empty but JS still has more paragraphs to queue
      if (this.currentIndex < this.currentQueue.length) {
        logDebug(
          'TTSAudioManager: onQueueEmpty ignored - still have items to refill, triggering immediate refill',
        );
        // Trigger immediate refill
        this.refillQueue().catch(err => {
          logError('TTSAudioManager: Emergency refill failed:', err);
        });
        return;
      }

      logDebug('TTSAudioManager: Queue empty event received');
      if (this.onQueueEmptyCallback) {
        this.onQueueEmptyCallback();
      }
    });

    this.eventListeners.push(subscription);
  }

  onQueueLow(callback: () => void) {
    this._onQueueLowCallback = callback;
  }

  addListener(
    eventType: string,
    listener: (event: any) => void,
  ): EmitterSubscription {
    const subscription = ttsEmitter.addListener(eventType, listener);
    this.eventListeners.push(subscription);
    return subscription;
  }

  removeAllListeners() {
    this.eventListeners.forEach(subscription => subscription.remove());
    this.eventListeners = [];
    this.onDoneCallback = undefined;
    this.onQueueEmptyCallback = undefined;
    this._onQueueLowCallback = undefined;
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }
}

export default new TTSAudioManager();
