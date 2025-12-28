import {
  AppState,
  type AppStateStatus,
  type EmitterSubscription,
} from 'react-native';
import ScreenStateListener from '@utils/ScreenStateListener';
import { createRateLimitedLogger } from '@utils/rateLimitedLogger';

// Rate-limited logger for debugging - prevents log spam
const autoStopLog = createRateLimitedLogger('AutoStopService', {
  windowMs: 500,
});

export type AutoStopMode = 'off' | 'minutes' | 'chapters' | 'paragraphs';

export type AutoStopReason = Exclude<AutoStopMode, 'off'>;

export interface AutoStopConfig {
  mode: AutoStopMode;
  amount: number;
}

export class AutoStopService {
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private config: AutoStopConfig = { mode: 'off', amount: 0 };
  private onAutoStop: ((reason: AutoStopReason) => void) | null = null;
  private appStateSubscription: ReturnType<
    typeof AppState.addEventListener
  > | null = null;
  private screenStateSubscription: EmitterSubscription | null = null;

  private paragraphsSpoken = 0;
  private chaptersFinished = 0;

  // Separate tracking for native vs AppState to prevent race conditions
  private nativeScreenOff = false; // From ScreenStateListener (authoritative on Android)
  private appStateBackground = false; // From AppState (fallback/iOS)
  private hasNativeSupport = false; // True if native module fires at least once

  /**
   * Unified getter: Screen is considered "off" if EITHER:
   * 1. Native module reports screen off (authoritative on Android)
   * 2. AppState is background AND native module hasn't fired (fallback/iOS)
   */
  private get isScreenOff(): boolean {
    if (this.hasNativeSupport) {
      // Native module is active - use its state (authoritative)
      return this.nativeScreenOff;
    }
    // Fallback: use AppState (for iOS or if native fails)
    return this.appStateBackground;
  }

  start(
    config: AutoStopConfig,
    onAutoStop: (reason: AutoStopReason) => void,
  ): void {
    autoStopLog.debug('start', `mode=${config.mode}, amount=${config.amount}`);
    this.stop();

    this.config = config;
    this.onAutoStop = onAutoStop;

    if (config.mode === 'off') {
      autoStopLog.debug('start', 'mode is off, service inactive');
      return;
    }
    if (!Number.isFinite(config.amount) || config.amount <= 0) {
      autoStopLog.debug(
        'start',
        `invalid amount (${config.amount}), service inactive`,
      );
      return;
    }

    // Set up native screen state listener (Android only - detects actual screen power events)
    if (ScreenStateListener.isAvailable()) {
      autoStopLog.info(
        'start',
        'Native ScreenStateListener available, subscribing',
      );
      this.screenStateSubscription = ScreenStateListener.addListener(
        this.handleScreenStateChange,
      );

      // CRITICAL: Mark native support as available immediately to prevent AppState fallback
      // from triggering when app goes to background (which is NOT the same as screen off)
      this.hasNativeSupport = true;

      // IMPORTANT: We use conservative default (screen assumed ON) until we receive
      // explicit SCREEN_OFF event. This prevents false positives where we count
      // paragraphs/time when screen is actually ON.
      //
      // Note: ScreenStateListener.isActive() checks if LISTENER is active, NOT if screen is on.
      // We can't reliably know initial screen state without PowerManager native API.
      // Conservative approach: wait for explicit OFF event before starting counters.
      this.nativeScreenOff = false; // Assume screen ON until we get SCREEN_OFF broadcast

      autoStopLog.info(
        'start',
        'Native support enabled. Using conservative default: assuming screen ON until OFF event received',
      );
    } else {
      autoStopLog.warn(
        'start',
        'Native ScreenStateListener NOT available, using AppState fallback only',
      );
    }

    // Fallback: Also listen to AppState for iOS or if native module fails
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange,
    );
    autoStopLog.debug('start', 'AppState subscription created');

    // Initialize AppState background tracking
    const currentState = AppState.currentState;
    this.appStateBackground =
      currentState === 'background' || currentState === 'inactive';
    autoStopLog.debug(
      'start',
      `initial AppState=${currentState}, appStateBackground=${this.appStateBackground}`,
    );

    // Note: We don't start timer here even if appStateBackground=true
    // because the screen might actually be ON (e.g., app was killed and reopened)
    // Timer only starts when we DETECT a screen OFF transition (or if native reports screen already off)
  }

  private handleScreenStateChange = (isScreenOn: boolean): void => {
    const wasNativeSupported = this.hasNativeSupport;

    // Mark that native module works - use it as authoritative source
    this.hasNativeSupport = true;

    // SYNC: First time native fires, reset any AppState-based counting
    // This prevents premature auto-stop from AppState "background" triggering before screen actually off
    if (!wasNativeSupported && this.appStateBackground) {
      autoStopLog.info(
        'native-event',
        'Native support confirmed - resetting AppState-based counters/timer',
      );
      this.paragraphsSpoken = 0;
      this.chaptersFinished = 0;
      // Clear any timer started by AppState fallback
      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }
    }

    const wasScreenOff = this.nativeScreenOff;
    const isScreenOffNow = !isScreenOn;

    autoStopLog.info(
      'native-event',
      `isScreenOn=${isScreenOn}, wasOff=${wasScreenOff}, nowOff=${isScreenOffNow}`,
    );

    if (wasScreenOff && !isScreenOffNow) {
      // Screen turned ON - RESET all counters and timer
      autoStopLog.info('native-event', 'screen ON → resetting counters/timer');
      this.clearTimerAndCounters();
      this.nativeScreenOff = false;
    } else if (!wasScreenOff && isScreenOffNow) {
      // Screen turned OFF - START counting/timing
      autoStopLog.info('native-event', 'screen OFF → starting counters/timer');
      this.nativeScreenOff = true;

      // Start timer for minutes mode
      if (this.config.mode === 'minutes') {
        this.startTimer();
      }
    }
  };

  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    const wasBackground = this.appStateBackground;
    const isBackgroundNow =
      nextAppState === 'background' || nextAppState === 'inactive';

    autoStopLog.debug(
      'appstate-event',
      `state=${nextAppState}, hasNative=${this.hasNativeSupport}, wasBackground=${wasBackground}, nowBackground=${isBackgroundNow}`,
    );

    // If native module is working, ignore AppState for screen detection
    // (but still track it for iOS compatibility)
    this.appStateBackground = isBackgroundNow;

    if (this.hasNativeSupport) {
      autoStopLog.debug(
        'appstate-event',
        'native module active, ignoring AppState for screen state',
      );
      return;
    }

    // Fallback behavior (iOS or native module not working)
    if (wasBackground && !isBackgroundNow) {
      // App came to foreground - RESET
      autoStopLog.info('appstate-event', 'foreground (fallback) → resetting');
      this.clearTimerAndCounters();
    } else if (!wasBackground && isBackgroundNow) {
      // App went to background - START
      autoStopLog.info('appstate-event', 'background (fallback) → starting');
      if (this.config.mode === 'minutes') {
        this.startTimer();
      }
    }
  };

  /**
   * Clear timer and reset counters (called when screen turns ON)
   */
  private clearTimerAndCounters(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
      autoStopLog.debug('clear', 'timer cleared');
    }
    this.paragraphsSpoken = 0;
    this.chaptersFinished = 0;
  }

  private startTimer(): void {
    if (this.config.mode !== 'minutes') {
      autoStopLog.debug(
        'startTimer',
        `mode is ${this.config.mode}, not starting`,
      );
      return;
    }
    if (!Number.isFinite(this.config.amount) || this.config.amount <= 0) {
      autoStopLog.debug('startTimer', `invalid amount (${this.config.amount})`);
      return;
    }

    // Clear any existing timer first
    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    const ms = Math.round(this.config.amount * 60_000);
    autoStopLog.info(
      'startTimer',
      `setting ${this.config.amount} min timer (${ms}ms)`,
    );
    this.timeout = setTimeout(() => {
      autoStopLog.info('timer-expired', 'triggering auto-stop');
      this.trigger('minutes');
    }, ms);
  }

  // Exposed for testing purposes only
  /** @internal */
  __testStartTimer(): void {
    this.nativeScreenOff = true; // Set screen off for testing
    this.hasNativeSupport = true;
    this.startTimer();
  }

  // Exposed for testing purposes only
  /** @internal */
  __testSetScreenOff(off: boolean): void {
    this.nativeScreenOff = off;
    this.hasNativeSupport = true;
  }

  stop(): void {
    autoStopLog.debug('stop', 'stopping service');
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (this.screenStateSubscription) {
      this.screenStateSubscription.remove();
      this.screenStateSubscription = null;
    }

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    this.onAutoStop = null;
    this.config = { mode: 'off', amount: 0 };
    this.paragraphsSpoken = 0;
    this.chaptersFinished = 0;
    this.nativeScreenOff = false;
    this.appStateBackground = false;
    this.hasNativeSupport = false;
  }

  resetCounters(): void {
    autoStopLog.debug('resetCounters', 'resetting paragraph/chapter counts');
    this.paragraphsSpoken = 0;
    this.chaptersFinished = 0;

    // For minutes mode, reset means starting a fresh timer IF screen is off
    if (this.config.mode === 'minutes' && this.onAutoStop) {
      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }

      if (this.isScreenOff) {
        autoStopLog.debug('resetCounters', 'restarting timer (screen off)');
        this.startTimer();
      }
    }
  }

  onParagraphSpoken(): void {
    if (this.config.mode !== 'paragraphs') return;
    if (!this.onAutoStop) return;
    if (!Number.isFinite(this.config.amount) || this.config.amount <= 0) return;

    // Only count when screen is OFF
    if (!this.isScreenOff) {
      autoStopLog.debug('onParagraphSpoken', 'ignored (screen ON)');
      return;
    }

    this.paragraphsSpoken += 1;
    autoStopLog.info(
      'onParagraphSpoken',
      `${this.paragraphsSpoken}/${this.config.amount}`,
    );

    if (this.paragraphsSpoken >= this.config.amount) {
      autoStopLog.info('onParagraphSpoken', 'limit reached → triggering');
      this.trigger('paragraphs');
    }
  }

  onChapterFinished(): void {
    if (this.config.mode !== 'chapters') return;
    if (!this.onAutoStop) return;
    if (!Number.isFinite(this.config.amount) || this.config.amount <= 0) return;

    // Only count when screen is OFF
    if (!this.isScreenOff) {
      autoStopLog.debug('onChapterFinished', 'ignored (screen ON)');
      return;
    }

    this.chaptersFinished += 1;
    autoStopLog.info(
      'onChapterFinished',
      `${this.chaptersFinished}/${this.config.amount}`,
    );

    if (this.chaptersFinished >= this.config.amount) {
      autoStopLog.info('onChapterFinished', 'limit reached → triggering');
      this.trigger('chapters');
    }
  }

  private trigger(reason: AutoStopReason): void {
    autoStopLog.info('trigger', `reason=${reason}`);
    const cb = this.onAutoStop;
    this.stop();
    if (cb) {
      cb(reason);
    }
  }
}

export const autoStopService = new AutoStopService();
