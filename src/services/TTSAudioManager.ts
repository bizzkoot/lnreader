import {
  NativeModules,
  NativeEventEmitter,
  EmitterSubscription,
  Platform,
  ToastAndroid,
} from 'react-native';

const { TTSHighlight } = NativeModules;

const ttsEmitter = new NativeEventEmitter(TTSHighlight);

export type TTSAudioParams = {
  rate?: number;
  pitch?: number;
  voice?: unknown;
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
// Additional safety margins:
// - PREFETCH_THRESHOLD: start refilling earlier to avoid queue drain and reduce pressure
//   that can trigger fallback paths.
// - EMERGENCY_THRESHOLD: if we get very low, attempt immediate refill.
const PREFETCH_THRESHOLD = Math.max(REFILL_THRESHOLD, 12);
const EMERGENCY_THRESHOLD = 4;

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
  // PERFORMANCE: Cache last known queue size to avoid excessive refill attempts
  // Updated after speak/refill operations and checked before triggering refill
  private lastKnownQueueSize = 0;
  // BUG FIX: Track if a refill operation is in progress to prevent
  // premature onQueueEmpty from triggering chapter navigation
  private refillInProgress = false;
  // Optional callback to surface user notifications (tests can register a spy)
  private notifyUserCallback?: (msg: string) => void;
  // BUG FIX: Track last successfully spoken paragraph index for monotonic enforcement
  private lastSpokenIndex = -1;

  // Lock chosen voice for the duration of a batch session to avoid mid-run voice drift.
  // If a fallback path is needed, we prefer this locked voice before using system default.
  private lockedVoice?: string;

  // Dev-only counters (non-spammy diagnostics)
  private devCounters = {
    refillAttempts: 0,
    addToBatchFailures: 0,
    fallbackSpeakBatchUsed: 0,
    fallbackSystemVoiceUsed: 0,
  };
  private hasLoggedSessionFallback = false;

  // Tracks whether we've successfully queued any audio to native in the current session.
  private hasQueuedNativeThisSession = false;

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

  setNotifyUserCallback(cb?: (msg: string) => void) {
    this.notifyUserCallback = cb;
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

  private lockVoiceIfProvided(voice?: string) {
    if (voice) {
      this.lockedVoice = voice;
    }
  }

  private sanitizeVoice(input: unknown): string | undefined {
    if (!input) {
      return undefined;
    }
    if (typeof input === 'string') {
      return input;
    }
    if (typeof input === 'object') {
      const candidate = (input as any)?.identifier;
      if (typeof candidate === 'string') {
        return candidate;
      }
    }
    return undefined;
  }

  private getPreferredVoiceForFallback(
    explicitVoice?: string,
  ): string | undefined {
    return explicitVoice || this.lockedVoice;
  }

  private logFallbackOncePerSession(message: string) {
    if (this.hasLoggedSessionFallback) {
      return;
    }
    this.hasLoggedSessionFallback = true;
    logError(message);
  }

  async speak(text: string, params: TTSAudioParams = {}): Promise<string> {
    try {
      const rate = params.rate || 1;
      const pitch = params.pitch || 1;
      const voice = this.sanitizeVoice(params.voice);
      const utteranceId = params.utteranceId || Date.now().toString();

      this.lockVoiceIfProvided(voice);

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
    const voice = this.sanitizeVoice(params.voice);

    // Lock voice at session start so refills/fallbacks keep consistent voice.
    this.lockVoiceIfProvided(voice);
    // New session -> allow one fallback log again.
    this.hasLoggedSessionFallback = false;
    this.hasQueuedNativeThisSession = false;
    while (attempts < maxAttempts) {
      try {
        // Clear any existing queue state before starting new batch
        this.currentQueue = [];
        this.currentUtteranceIds = [];
        this.currentIndex = 0;
        this.lastKnownQueueSize = 0;
        // BUG FIX: Reset last spoken index for new session
        this.resetLastSpokenIndex();
        const batchTexts = texts.slice(0, BATCH_SIZE);
        const batchIds = utteranceIds.slice(0, BATCH_SIZE);

        // Guard against empty batch (shouldn't happen, but be defensive)
        if (batchTexts.length === 0) {
          logDebug(
            'TTSAudioManager: No items in initial batch, aborting speakBatch',
          );
          throw new Error('No items to speak in initial batch');
        }

        await TTSHighlight.speakBatch(batchTexts, batchIds, {
          rate,
          pitch,
          voice,
        });

        // DEV: Log voice used for initial batch (helps verify no voice drift)
        if (__DEV__ && voice) {
          // eslint-disable-next-line no-console
          console.log(
            `TTSAudioManager: Started batch with voice: ${voice.substring(0, 40)}`,
          );
        }

        this.hasQueuedNativeThisSession = true;
        this.currentQueue = texts;
        this.currentUtteranceIds = utteranceIds;
        // Set currentIndex to number of items already pushed to native queue
        this.currentIndex = batchTexts.length;
        this.isPlaying = true;
        this.hasLoggedNoMoreItems = false;
        // Update queue size cache with initial batch size
        this.lastKnownQueueSize = batchTexts.length;
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
              // Decrement cache as native consumes items
              if (this.lastKnownQueueSize > 0) {
                this.lastKnownQueueSize--;
              }
              // Only refill when approaching threshold
              if (this.lastKnownQueueSize <= PREFETCH_THRESHOLD + 3) {
                await this.refillQueue();
              }
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
    // Fallback: try again, but prefer locked voice first.
    try {
      const batchTexts = texts.slice(0, BATCH_SIZE);
      const batchIds = utteranceIds.slice(0, BATCH_SIZE);
      const fallbackVoice = this.getPreferredVoiceForFallback(voice);
      await TTSHighlight.speakBatch(batchTexts, batchIds, {
        rate,
        pitch,
        voice: this.sanitizeVoice(fallbackVoice),
      });
      this.hasQueuedNativeThisSession = true;
      this.devCounters.fallbackSpeakBatchUsed += 1;
      if (!fallbackVoice) {
        this.devCounters.fallbackSystemVoiceUsed += 1;
        this.logFallbackOncePerSession(
          'Preferred TTS voice unavailable for batch, using system default.',
        );
      } else {
        this.logFallbackOncePerSession(
          'Preferred TTS voice failed for batch, retrying with locked voice.',
        );
      }
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
    this.devCounters.refillAttempts += 1;
    logDebug('TTSAudioManager: Starting refill operation');

    try {
      const queueSize = await TTSHighlight.getQueueSize();

      // Extra safety: if queue is low or near-empty, refill more aggressively.
      // Prefetch threshold helps avoid queue drain and the fallback paths.
      const thresholdToUse =
        queueSize <= EMERGENCY_THRESHOLD
          ? EMERGENCY_THRESHOLD
          : PREFETCH_THRESHOLD;

      if (queueSize > thresholdToUse) {
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

          // DEV: Log successful refill (voice is implicit from initial batch or fallback)
          if (__DEV__ && attempt === 1) {
            // eslint-disable-next-line no-console
            console.log(
              `TTSAudioManager: Refilled +${nextBatchSize} items (voice: locked=${this.lockedVoice?.substring(0, 30) || 'none'})`,
            );
          }

          addSucceeded = true;
          break;
        } catch (err) {
          addError = err;
          this.devCounters.addToBatchFailures += 1;
          logError(
            `TTSAudioManager: addToBatch failed (attempt ${attempt}):`,
            err,
          );
          // Exponential backoff: base 150ms * 2^(attempt-1)
          const delayMs = 150 * Math.pow(2, attempt - 1);
          await new Promise(res => setTimeout(res, delayMs));
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
            // Guard: do not call speakBatch with zero items
            if (nextTexts.length === 0) {
              logError('TTSAudioManager: No next texts to speak in fallback');
              this.refillInProgress = false;
              // Notify user after repeated failures
              const msg = 'TTS failed to queue audio. Playback may stop.';
              if (this.notifyUserCallback) {
                this.notifyUserCallback(msg);
              } else if (Platform.OS === 'android') {
                ToastAndroid.show(msg, ToastAndroid.SHORT);
              } else {
                logError(msg);
              }
              return false;
            }

            try {
              const fallbackVoice = this.sanitizeVoice(
                this.getPreferredVoiceForFallback(undefined),
              );

              await TTSHighlight.speakBatch(nextTexts, nextIds, {
                rate: 1,
                pitch: 1,
                voice: fallbackVoice,
              });

              // DEV: Log fallback voice to track voice stability
              if (__DEV__ && fallbackVoice) {
                // eslint-disable-next-line no-console
                console.log(
                  `TTSAudioManager: Fallback batch with voice: ${fallbackVoice.substring(0, 40)}`,
                );
              }

              this.hasQueuedNativeThisSession = true;
              this.devCounters.fallbackSpeakBatchUsed += 1;
              if (!this.getPreferredVoiceForFallback(undefined)) {
                this.devCounters.fallbackSystemVoiceUsed += 1;
              }
              // Update currentIndex by the number of items we just queued
              this.currentIndex += nextTexts.length;
            } catch (fallbackErr) {
              logError(
                'TTSAudioManager: Fallback speakBatch also failed:',
                fallbackErr,
              );
              // After fallback failure, surface user notification
              const msg = 'TTS failed to queue audio. Playback may stop.';
              if (this.notifyUserCallback) {
                this.notifyUserCallback(msg);
              } else if (Platform.OS === 'android') {
                ToastAndroid.show(msg, ToastAndroid.SHORT);
              } else {
                logError(msg);
              }
              this.refillInProgress = false;
              return false;
            }
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

      // Update queue size cache after successful refill
      this.lastKnownQueueSize += nextBatchSize;

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
      this.lastKnownQueueSize = 0;
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

      // PERFORMANCE: Decrement cached queue size (approximate tracking)
      // Each spoken item reduces the native queue by 1
      if (this.lastKnownQueueSize > 0) {
        this.lastKnownQueueSize--;
      }

      // Auto-refill queue - but only if we're approaching the threshold
      // This avoids 60+ unnecessary native bridge calls per chapter
      // Use PREFETCH_THRESHOLD + small buffer to account for cache drift
      if (this.lastKnownQueueSize <= PREFETCH_THRESHOLD + 3) {
        this.refillQueue();
      }
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

  hasQueuedNativeInCurrentSession(): boolean {
    return this.hasQueuedNativeThisSession;
  }
}

export default new TTSAudioManager();
