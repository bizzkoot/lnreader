import {
  NativeModules,
  NativeEventEmitter,
  EmitterSubscription,
  Platform,
  ToastAndroid,
} from 'react-native';
import { TTSState, assertValidTransition } from './TTSState';
import { createRateLimitedLogger } from '@utils/rateLimitedLogger';
import { TTS_CONSTANTS } from '@screens/reader/types/tts';

const { TTSHighlight } = NativeModules;

const ttsEmitter = new NativeEventEmitter(TTSHighlight);

/**
 * Parameters for TTS audio playback
 * @property {number} [rate] - Speech rate (0.1 to 3.0, default: 1.0)
 * @property {number} [pitch] - Voice pitch (0.1 to 2.0, default: 1.0)
 * @property {unknown} [voice] - Voice identifier (system-specific)
 * @property {string} [utteranceId] - Unique ID for this utterance
 */
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
// Using centralized constants from TTS_CONSTANTS

// Additional safety margins:
// - PREFETCH_THRESHOLD: start refilling earlier to avoid queue drain and reduce pressure
//   that can trigger fallback paths.
// - TTS_CONSTANTS.EMERGENCY_THRESHOLD: if we get very low, attempt immediate refill.
const PREFETCH_THRESHOLD = Math.max(
  TTS_CONSTANTS.REFILL_THRESHOLD,
  TTS_CONSTANTS.PREFETCH_THRESHOLD,
);

const ttsLog = createRateLimitedLogger('TTS', { windowMs: 1000 });
const logDebug = (...args: unknown[]) => ttsLog.debug('debug', ...args);
const logError = (...args: unknown[]) => ttsLog.error('error', ...args);

/**
 * Manages Text-to-Speech (TTS) playback lifecycle and queue management.
 *
 * This class coordinates between the React Native layer and the Native Android TTS engine,
 * providing:
 * - State machine-based playback control (IDLE → STARTING → PLAYING → REFILLING → STOPPING)
 * - Queue management with intelligent refill to prevent audio gaps
 * - Voice locking for consistent batch playback
 * - Monotonic progress tracking to prevent backward jumps
 * - Event emission for speech lifecycle (onSpeechDone, onQueueEmpty)
 *
 * **Key Responsibilities:**
 * - Batch queueing: `speakBatch()` adds paragraphs to native queue for seamless playback
 * - Refill strategy: Proactively refills queue when below threshold to avoid gaps
 * - State validation: `transitionTo()` enforces valid state transitions
 * - Error recovery: Fallback mechanisms when native queue operations fail
 *
 * **Thread Safety:**
 * - Refill operations are serialized using mutex pattern (`refillMutex`)
 * - Prevents race conditions between queue exhaustion and refill completion
 *
 * @class TTSAudioManager
 * @example
 * ```typescript
 * import TTSHighlight from '@services/TTSHighlight';
 *
 * // Start batch playback
 * const paragraphs = ['Para 1', 'Para 2', 'Para 3'];
 * await TTSHighlight.speakBatch(paragraphs, { rate: 1.2, pitch: 1.0 });
 *
 * // Listen for completion
 * TTSHighlight.onSpeechDone((utteranceId) => {
 *   console.log(`Finished: ${utteranceId}`);
 * });
 * ```
 */
class TTSAudioManager {
  private state: TTSState = TTSState.IDLE;
  private currentQueue: string[] = [];
  private currentUtteranceIds: string[] = [];
  private currentIndex = 0;
  private eventListeners: EmitterSubscription[] = [];
  private onDoneCallback?: (utteranceId: string) => void;
  private onQueueEmptyCallback?: () => void;
  // @ts-expect-error Reserved for future use
  private _onQueueLowCallback?: () => void;
  // Track if we've already logged "no more items" to reduce spam (logging-only flag, not state)
  private hasLoggedNoMoreItems = false;
  // CRITICAL-2 FIX: Mutex to prevent concurrent refill operations
  // Using Promise<unknown> to allow chaining with any return type
  private refillMutex: Promise<unknown> = Promise.resolve();
  // PERFORMANCE: Cache last known queue size to avoid excessive refill attempts
  // Updated after speak/refill operations and checked before triggering refill
  private lastKnownQueueSize = 0;
  // Optional callback to surface user notifications (tests can register a spy)
  private notifyUserCallback?: (msg: string) => void;
  // BUG FIX: Track last successfully spoken paragraph index for monotonic enforcement
  private lastSpokenIndex = -1;

  // Lock chosen voice for the duration of a batch session to avoid mid-run voice drift.
  // If a fallback path is needed, we prefer this locked voice before using system default.
  private lockedVoice?: string;

  // Track current rate and pitch for emergency fallback
  public currentRate: number = 1;
  public currentPitch: number = 1;

  // Dev-only counters (non-spammy diagnostics)
  private devCounters = {
    refillAttempts: 0,
    addToBatchFailures: 0,
    fallbackSpeakBatchUsed: 0,
    fallbackSystemVoiceUsed: 0,
    cacheDriftDetections: 0,
    driftEnforcements: 0,
  };

  // Callback to enforce drift correction - restarts TTS from correct position
  private onDriftEnforceCallback?: (correctIndex: number) => void;

  // Flag to cancel ongoing refill operations when stop() is called
  private refillCancelled = false;

  // Tracks whether we've successfully queued any audio to native in the current session (logging-only flag, not state).
  private hasQueuedNativeThisSession = false;
  // Flag to track if we've logged session fallback once (logging-only flag, not state)
  private hasLoggedSessionFallback = false;

  // Counter for periodic cache calibration (every N spoken items)
  private speechDoneCounter = 0;

  // Batch support detection - non-Google engines may not properly support QUEUE_ADD
  private engineSupportsBatch: boolean = true;
  // Aggressive refill mode for engines that don't batch: refill after every utterance
  private aggressiveRefillMode: boolean = false;
  // Whether initial batch capability check has been performed
  private initialBatchCheckDone: boolean = false;

  // Track engine readiness for synchronization during switches
  private engineReadyPromise: Promise<void> | null = null;
  private resolveEngineReady: (() => void) | null = null;

  constructor() {
    this.setupEngineReadyListener();
  }

  private setupEngineReadyListener() {
    ttsEmitter.addListener('onEngineReady', () => {
      logDebug('TTSAudioManager: Engine ready event received');
      if (this.resolveEngineReady) {
        this.resolveEngineReady();
        this.resolveEngineReady = null;
      } else {
        // If no one is waiting, just ensure the promise is resolved for future callers
        this.engineReadyPromise = Promise.resolve();
      }
    });
  }

  private waitForEngineReady(timeoutMs: number = 3000): Promise<void> {
    if (!this.engineReadyPromise) {
      this.engineReadyPromise = new Promise<void>(resolve => {
        this.resolveEngineReady = resolve;
      });
    }

    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(
        () => reject(new Error('Timeout waiting for TTS engine readiness')),
        timeoutMs,
      );
    });

    return Promise.race([this.engineReadyPromise, timeoutPromise]);
  }

  // Track the currently active TTS engine on the native side.
  // Used by restoreSavedEngine to avoid unnecessary shutdown/re-init cycles.
  private currentEngine: string | null = null;

  /**
   * Transition to a new state with validation and debug logging.
   * @private
   */
  private transitionTo(newState: TTSState): void {
    assertValidTransition(this.state, newState);
    // This can fire frequently during playback/refill; keep but rate-limit.
    ttsLog.info('state', `${this.state} → ${newState}`);
    this.state = newState;
  }

  /**
   * Get current state for debugging/testing.
   */
  getState(): TTSState {
    return this.state;
  }

  /**
   * Get the currently active TTS engine name (from the native side).
   * Returns null if no engine has been explicitly set (system default in use).
   */
  getCurrentEngine(): string | null {
    return this.currentEngine;
  }

  setNotifyUserCallback(cb?: (msg: string) => void) {
    this.notifyUserCallback = cb;
  }

  /**
   * Set callback for drift enforcement. Called when cache drift exceeds threshold
   * and TTS needs to restart from the correct position.
   * @param cb Callback that receives the correct paragraph index to restart from
   */
  setOnDriftEnforceCallback(cb?: (correctIndex: number) => void) {
    this.onDriftEnforceCallback = cb;
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

  /**
   * Detect if the current TTS engine supports batch queuing (QUEUE_ADD).
   * Google TTS is known to work. Non-Google engines may only process 1
   * utterance at a time. Sets engineSupportsBatch and aggressiveRefillMode.
   *
   * Uses timeout to avoid blocking - defaults to batch-capable if native call hangs.
   */
  private async detectBatchCapability(): Promise<void> {
    // If a switch was recently triggered, wait for the engine to be ready
    // before checking capability to ensure we don't get stale info.
    if (!this.initialBatchCheckDone) {
      try {
        logDebug(
          'TTSAudioManager: Waiting for engine readiness before capability check',
        );
        await this.waitForEngineReady(3000);
      } catch (err) {
        logError('TTSAudioManager: Failed to wait for engine ready:', err);
        // Continue anyway; detectBatchCapability has its own timeout
      }
    }

    this.initialBatchCheckDone = true;

    // Create a timeout promise that resolves after 2 seconds
    // This prevents blocking if native module call hangs
    const timeoutPromise = new Promise<boolean>(resolve => {
      setTimeout(() => {
        ttsLog.warn(
          'detect-batch-capability-timeout',
          'Native call timed out, defaulting to batch-capable',
        );
        resolve(true); // Default to batch-capable on timeout
      }, 2000);
    });

    try {
      // Race between native call and timeout - whichever completes first wins
      this.engineSupportsBatch = await Promise.race([
        TTSHighlight.isBatchCapable(),
        timeoutPromise,
      ]);
      this.aggressiveRefillMode = !this.engineSupportsBatch;
      ttsLog.info(
        'detect-batch-capability',
        `engineSupportsBatch=${this.engineSupportsBatch}, aggressiveRefillMode=${this.aggressiveRefillMode}`,
      );
    } catch (e) {
      // Default to batch-capable on error (safe fallback - original behavior)
      this.engineSupportsBatch = true;
      this.aggressiveRefillMode = false;
      ttsLog.warn('detect-batch-capability-error', e);
    }
  }

  /**
   * Calibrate the queue size cache to prevent drift.
   * Compares cached size with actual native queue size and corrects if drift > threshold.
   *
   * **ENFORCEMENT MODE (v2):** When drift exceeds threshold, automatically:
   * 1. Stop TTS (completely halts playback and clears queue)
   * 2. Reset queue size cache
   * 3. Call onDriftEnforceCallback to restart from correct position
   *
   * This ensures TTS never plays from a stale position after drift is detected.
   *
   * CRITICAL: Uses the NEXT paragraph to play (currentIndex) as the correct position,
   * NOT lastSpokenIndex which may lag behind actual playback.
   */
  private async calibrateQueueCache() {
    try {
      const actualSize = await TTSHighlight.getQueueSize();
      const drift = Math.abs(actualSize - this.lastKnownQueueSize);
      if (drift > TTS_CONSTANTS.CACHE_DRIFT_THRESHOLD) {
        ttsLog.warn(
          'cache-drift',
          `Cache drift detected (cached=${this.lastKnownQueueSize}, actual=${actualSize}, drift=${drift})`,
        );
        this.devCounters.cacheDriftDetections += 1;

        // ENFORCE: Stop (clears queue) and restart from correct position
        // Use currentIndex (next paragraph to play) as the authoritative position
        // This is more accurate than lastSpokenIndex which updates async via callbacks
        if (this.onDriftEnforceCallback && this.currentIndex > 0) {
          // correctIndex = last successfully queued paragraph
          // Since currentIndex points to NEXT item to queue, we want currentIndex - 1
          // BUT if we're mid-refill, currentIndex may have advanced beyond actual playback
          // So we use the safer approach: restart from the last spoken paragraph
          const correctIndex = Math.max(0, this.lastSpokenIndex);

          ttsLog.info(
            'cache-drift-enforce',
            `Enforcing position sync: stopping TTS, restarting from index ${correctIndex} (lastSpoken=${this.lastSpokenIndex}, currentIndex=${this.currentIndex})`,
          );
          this.devCounters.driftEnforcements += 1;

          // Stop TTS completely (clears queue and stops current utterance)
          await this.stop();

          // Call enforcement callback (this will restart TTS from correct position)
          this.onDriftEnforceCallback(correctIndex);
        } else {
          // No callback registered - just update cache (legacy behavior)
          this.lastKnownQueueSize = actualSize;
        }
      }
    } catch (err) {
      logError('TTSAudioManager: calibrateQueueCache failed:', err);
    }
  }

  /**
   * Speak a single text utterance immediately (foreground mode).
   *
   * This method is used when `ttsBackgroundPlayback` is OFF. The WebView drives
   * the playback loop by sending one utterance at a time.
   *
   * **Behavior:**
   * - Transitions state: IDLE → PLAYING
   * - Locks voice for session consistency
   * - Generates utteranceId if not provided
   *
   * @param {string} text - Text to speak
   * @param {TTSAudioParams} [params] - Optional audio parameters
   * @param {number} [params.rate] - Speech rate (default: 1.0)
   * @param {number} [params.pitch] - Voice pitch (default: 1.0)
   * @param {unknown} [params.voice] - Voice identifier
   * @param {string} [params.utteranceId] - Custom utterance ID
   * @returns {Promise<string>} Utterance ID of the spoken text
   * @throws {Error} If native TTS fails
   * @example
   * ```typescript
   * const id = await TTSHighlight.speak('Hello world', { rate: 1.2 });
   * ```
   */
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

      this.transitionTo(TTSState.PLAYING);
      return utteranceId;
    } catch (error) {
      logError('TTSAudioManager: Failed to speak text:', error);
      throw error;
    }
  }

  /**
   * Queue multiple text paragraphs for seamless playback (background mode).
   *
   * This is the primary method for robust TTS playback with background support.
   * It queues paragraphs to the native TTS engine, which handles transitions
   * automatically without WebView coordination.
   *
   * **Key Features:**
   * - Seamless paragraph transitions (no audio gaps)
   * - Continues playback when screen is off
   * - Intelligent queue management with refill strategy
   * - Voice locking for consistent batch playback
   *
   * **State Transitions:**
   * - IDLE/PLAYING → STARTING → PLAYING
   *
   * **Queue Management:**
   * - Stores texts and IDs for refill operations
   * - Updates cache with new queue size
   * - Marks session as having queued audio
   *
   * @param {string[]} texts - Array of paragraph texts to queue
   * @param {string[]} utteranceIds - Matching array of utterance IDs
   * @param {TTSAudioParams} [params] - Audio parameters
   * @returns {Promise<number>} Number of items successfully queued
   * @throws {Error} If native queue operation fails
   * @example
   * ```typescript
   * const paragraphs = ['Para 1', 'Para 2', 'Para 3'];
   * const ids = paragraphs.map((_, i) => `utterance_${i}`);
   * const queued = await TTSHighlight.speakBatch(paragraphs, ids, { rate: 1.0 });
   * console.log(`Queued ${queued} paragraphs`);
   * ```
   */
  async speakBatch(
    texts: string[],
    utteranceIds: string[],
    params: TTSAudioParams = {},
  ): Promise<number> {
    if (texts.length === 0) {
      return 0;
    }

    // Detect batch capability on first speakBatch if not already determined.
    // Must be awaited so that aggressiveRefillMode is correct before we compute
    // the initial batch size — otherwise JS sends 25 items while native only
    // queues 1, causing a massive index mismatch.
    if (!this.initialBatchCheckDone) {
      await this.detectBatchCapability();
    }

    let attempts = 0;
    let lastError: any = null;
    const maxAttempts = 2;
    const rate = params.rate || 1;
    const pitch = params.pitch || 1;
    const voice = this.sanitizeVoice(params.voice);

    // Store current rate and pitch for emergency fallback
    this.currentRate = rate;
    this.currentPitch = pitch;

    // Lock voice at session start so refills/fallbacks keep consistent voice.
    this.lockVoiceIfProvided(voice);
    // New session -> allow one fallback log again.
    this.hasLoggedSessionFallback = false;
    this.hasQueuedNativeThisSession = false;
    // Reset refill cancellation flag for new session
    this.refillCancelled = false;
    // Transition to STARTING state
    this.transitionTo(TTSState.STARTING);
    while (attempts < maxAttempts) {
      try {
        // Clear any existing queue state before starting new batch
        this.currentQueue = [];
        this.currentUtteranceIds = [];
        this.currentIndex = 0;
        this.lastKnownQueueSize = 0;
        // BUG FIX: Reset last spoken index for new session
        this.resetLastSpokenIndex();
        const initialBatchSize = this.aggressiveRefillMode
          ? 1
          : TTS_CONSTANTS.BATCH_SIZE;
        const batchTexts = texts.slice(0, initialBatchSize);
        const batchIds = utteranceIds.slice(0, initialBatchSize);

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
          ttsLog.debug(
            'batch-voice',
            `Started batch with voice: ${voice.substring(0, 40)}`,
          );
        }

        this.hasQueuedNativeThisSession = true;
        this.currentQueue = texts;
        this.currentUtteranceIds = utteranceIds;
        // For non-batch engines, only 1 item was actually queued by native
        this.currentIndex = initialBatchSize;
        this.transitionTo(TTSState.PLAYING);
        this.hasLoggedNoMoreItems = false;
        // Update queue size cache with actual queued count
        this.lastKnownQueueSize = initialBatchSize;
        // Calibrate cache after successful batch start
        await this.calibrateQueueCache();
        logDebug(
          `TTSAudioManager: Started batch playback with ${
            initialBatchSize
          } items, ${texts.length - initialBatchSize} remaining`,
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
              // For non-batch engines, ALWAYS refill after each utterance
              // For batch-capable engines, only refill when approaching threshold
              if (this.aggressiveRefillMode) {
                await this.refillQueue();
              } else if (this.lastKnownQueueSize <= PREFETCH_THRESHOLD + 3) {
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
      const initialBatchSize = this.aggressiveRefillMode
        ? 1
        : TTS_CONSTANTS.BATCH_SIZE;
      const batchTexts = texts.slice(0, initialBatchSize);
      const batchIds = utteranceIds.slice(0, initialBatchSize);
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
      this.currentIndex = initialBatchSize;
      this.transitionTo(TTSState.PLAYING);
      this.hasLoggedNoMoreItems = false;
      // Update cache and calibrate after fallback batch start
      this.lastKnownQueueSize = initialBatchSize;
      await this.calibrateQueueCache();
      logDebug(
        `TTSAudioManager: Started batch playback with fallback voice, ${
          initialBatchSize
        } items, ${texts.length - initialBatchSize} remaining`,
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
            // For non-batch engines, ALWAYS refill after each utterance
            // For batch-capable engines, always refill (fallback path)
            if (this.aggressiveRefillMode) {
              await this.refillQueue();
            } else {
              await this.refillQueue();
            }
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
    // CRITICAL-2 FIX: Use mutex pattern to prevent concurrent refill operations
    // This chains refill requests sequentially, avoiding race conditions where
    // multiple refills could pass the state check simultaneously
    const doRefill = async (): Promise<boolean> => {
      // Check if refill was cancelled (e.g., stop() was called)
      if (this.refillCancelled) {
        logDebug('TTSAudioManager: Refill cancelled, skipping');
        return false;
      }

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

      // BUG FIX: Prevent concurrent refills (redundant check within mutex)
      if (this.state === TTSState.REFILLING) {
        logDebug('TTSAudioManager: Refill already in progress, skipping');
        return false;
      }

      // Transition to REFILLING state
      this.transitionTo(TTSState.REFILLING);
      this.devCounters.refillAttempts += 1;
      logDebug('TTSAudioManager: Starting refill operation');

      try {
        // Check cancellation again after state transition
        if (this.refillCancelled) {
          logDebug('TTSAudioManager: Refill cancelled during operation');
          // Don't transition if already stopped - just return
          return false;
        }

        const queueSize = await TTSHighlight.getQueueSize();

        // For non-batch engines, use very low threshold (refill when 1-2 items left).
        // For batch-capable engines, use normal prefetch threshold with emergency fallback.
        const thresholdToUse = this.aggressiveRefillMode
          ? 1
          : queueSize <= TTS_CONSTANTS.EMERGENCY_THRESHOLD
            ? TTS_CONSTANTS.EMERGENCY_THRESHOLD
            : PREFETCH_THRESHOLD;

        if (queueSize > thresholdToUse) {
          // Still enough items in queue
          this.transitionTo(TTSState.PLAYING);
          return false;
        }

        // Add next batch
        const remainingCount = this.currentQueue.length - this.currentIndex;
        const refillBatchSize = this.aggressiveRefillMode
          ? 1
          : TTS_CONSTANTS.BATCH_SIZE;
        const nextBatchSize = Math.min(refillBatchSize, remainingCount);

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
              ttsLog.debug(
                'refill-success',
                `Refilled +${nextBatchSize} items (voice: locked=${this.lockedVoice?.substring(0, 30) || 'none'})`,
              );
            }

            addSucceeded = true;

            // Check if refill was cancelled after addToBatch completed
            if (this.refillCancelled) {
              logDebug(
                'TTSAudioManager: Refill cancelled after addToBatch completed',
              );
              // Don't transition back to PLAYING - let stop() handle final state
              return false;
            }

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
                this.transitionTo(TTSState.PLAYING);
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
                  rate: this.currentRate,
                  pitch: this.currentPitch,
                  voice: fallbackVoice,
                });

                // DEV: Log fallback voice to track voice stability
                if (__DEV__ && fallbackVoice) {
                  ttsLog.debug(
                    'fallback-voice',
                    `Fallback batch with voice: ${fallbackVoice.substring(0, 40)}`,
                  );
                }

                this.hasQueuedNativeThisSession = true;
                this.devCounters.fallbackSpeakBatchUsed += 1;
                if (!this.getPreferredVoiceForFallback(undefined)) {
                  this.devCounters.fallbackSystemVoiceUsed += 1;
                }
                // Update currentIndex by the number of items we just queued
                this.currentIndex += nextTexts.length;
                // Update cache and calibrate after fallback (critical drift scenario)
                this.lastKnownQueueSize = nextTexts.length;
                await this.calibrateQueueCache();
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
                this.transitionTo(TTSState.PLAYING);
                return false;
              }
              logDebug(
                `TTSAudioManager: speakBatch fallback started ${nextBatchSize} items`,
              );
              this.transitionTo(TTSState.PLAYING);
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
          this.transitionTo(TTSState.PLAYING);
          return false;
        }

        this.currentIndex += nextBatchSize;

        // Update queue size cache after successful refill
        this.lastKnownQueueSize += nextBatchSize;

        // Calibrate cache after successful refill
        await this.calibrateQueueCache();

        logDebug(
          `TTSAudioManager: Refilled queue with ${nextBatchSize} items, ${
            this.currentQueue.length - this.currentIndex
          } remaining`,
        );

        this.transitionTo(TTSState.PLAYING);
        return true;
      } catch (error) {
        logError('TTSAudioManager: Failed to refill queue:', error);
        this.transitionTo(TTSState.PLAYING);
        return false;
      }
    };

    // Chain onto the mutex to ensure only one refill runs at a time
    this.refillMutex = this.refillMutex.then(
      () => doRefill(),
      () => doRefill(),
    );
    return this.refillMutex as Promise<boolean>;
  }

  /**
   * Stop TTS playback and clear the queue.
   *
   * Resets all internal state including queue, utterance IDs, and indices.
   * Transitions to IDLE state. This is a complete teardown.
   *
   * @returns {Promise<boolean>} True if successfully stopped
   * @example
   * ```typescript
   * await TTSHighlight.stop();
   * ```
   */
  async stop(): Promise<boolean> {
    try {
      // Set cancellation flag to stop ongoing refills
      this.refillCancelled = true;

      const wasPlaying =
        this.state === TTSState.PLAYING || this.state === TTSState.REFILLING;

      this.transitionTo(TTSState.STOPPING);

      // CRITICAL: Remove internal event listeners BEFORE stopping native TTS
      // This prevents refill subscriptions from firing after we've stopped
      this.removeAllListeners();

      await TTSHighlight.stop();

      this.currentQueue = [];
      this.currentUtteranceIds = [];
      this.currentIndex = 0;
      this.lastKnownQueueSize = 0;
      this.lockedVoice = undefined;
      this.transitionTo(TTSState.IDLE);

      // If we were playing, notify listeners that playback has been aborted
      // This helps useTTSController reset its state if the stop was internal
      if (wasPlaying) {
        ttsEmitter.emit('onMediaAction', { action: 'stop' });
      }

      logDebug('TTSAudioManager: Playback stopped');
      return true;
    } catch (error) {
      logError('TTSAudioManager: Failed to stop playback:', error);
      return false;
    }
  }

  /**
   * Stop playback completely (transitions to IDLE).
   * Use this for user-initiated stops.
   */
  async fullStop(): Promise<boolean> {
    return this.stop();
  }

  /**
   * Stop TTS playback, switch TTS engine, and clear locked state.
   * Call this when the user selects a different TTS engine.
   * @param engineName Engine package name or empty string for system default
   */
  async switchEngine(engineName: string): Promise<boolean> {
    if (this.state !== TTSState.IDLE) {
      await this.stop();
    }

    try {
      // RESET readiness state for the new engine
      this.initialBatchCheckDone = false;
      this.engineReadyPromise = new Promise<void>(resolve => {
        this.resolveEngineReady = resolve;
      });
      this.currentEngine = engineName || null;

      const result = await TTSHighlight.setEngine(engineName);
      if (!result) {
        logError('TTSAudioManager: Failed to switch engine');
        return false;
      }
      this.lockedVoice = undefined;

      // Reset batch capability flags — the native engine initialises async
      // (onInit fires later). detectBatchCapability() will run on the next
      // speakBatch() call once the engine is ready, ensuring JS and native
      // agree on batch size.
      this.engineSupportsBatch = true;
      this.aggressiveRefillMode = false;

      return true;
    } catch (error) {
      logError('TTSAudioManager: Engine switch error:', error);
      return false;
    }
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
  /**
   * Register callback for speech completion events.
   *
   * Called when the native TTS engine finishes speaking an utterance.
   * Used to:
   * - Update progress in DB/MMKV
   * - Trigger queue refill when below threshold
   * - Advance to next paragraph in foreground mode
   *
   * **Note:** Callback is set directly, not added to array.
   *
   * @param {function(string): void} callback - Handler receiving utterance ID
   * @example
   * ```typescript
   * TTSHighlight.onSpeechDone((utteranceId) => {
   *   saveProgress(utteranceId);
   *   if (queueLow) refillQueue();
   * });
   * ```
   */
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

      // Periodic cache calibration to detect drift
      this.speechDoneCounter++;
      if (this.speechDoneCounter >= TTS_CONSTANTS.CALIBRATION_INTERVAL) {
        this.speechDoneCounter = 0;
        this.calibrateQueueCache().catch(err => {
          logError('TTSAudioManager: Periodic calibration failed:', err);
        });
      }

      // Auto-refill queue
      // For non-batch engines, ALWAYS refill after each utterance (aggressive mode)
      // For batch-capable engines, only refill when approaching the threshold
      // This avoids 60+ unnecessary native bridge calls per chapter
      // Use PREFETCH_THRESHOLD + small buffer to account for cache drift
      if (this.aggressiveRefillMode) {
        this.refillQueue();
      } else if (this.lastKnownQueueSize <= PREFETCH_THRESHOLD + 3) {
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
  /**
   * Register callback for queue empty events.
   *
   * Called when the native TTS queue is completely drained.
   * **Primary use case:** Trigger navigation to next chapter during
   * background playback (screen off).
   *
   * **Important:** This can fire spuriously if queue exhausts before
   * refill completes. Always check `hasRemainingItems()` before acting.
   *
   * @param {function(): void} callback - Handler for queue empty event
   * @example
   * ```typescript
   * TTSHighlight.onQueueEmpty(() => {
   *   if (!TTSHighlight.hasRemainingItems()) {
   *     navigateToNextChapter();
   *   }
   * });
   * ```
   */
  onQueueEmpty(callback: () => void) {
    this.onQueueEmptyCallback = callback;

    const subscription = ttsEmitter.addListener('onQueueEmpty', () => {
      // BUG FIX: Don't fire callback if a restart/stop operation is in progress
      // This prevents false "queue empty" signals during intentional stop/restart cycles
      if (
        this.state === TTSState.STARTING ||
        this.state === TTSState.STOPPING
      ) {
        logDebug(
          `TTSAudioManager: onQueueEmpty ignored - state is ${this.state}`,
        );
        return;
      }

      // BUG FIX: Don't fire callback if a refill operation is in progress
      // This prevents premature chapter navigation when async refill is still running
      if (this.state === TTSState.REFILLING) {
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
    return this.state === TTSState.PLAYING || this.state === TTSState.REFILLING;
  }

  hasQueuedNativeInCurrentSession(): boolean {
    return this.hasQueuedNativeThisSession;
  }
}

export default new TTSAudioManager();
