import {
  NativeModules,
  NativeEventEmitter,
  Platform,
  EmitterSubscription,
} from 'react-native';
import { createRateLimitedLogger } from '@utils/rateLimitedLogger';

const screenStateLog = createRateLimitedLogger('ScreenStateListener', {
  windowMs: 500,
});

interface ScreenStateListenerModule {
  startListening: () => void;
  stopListening: () => void;
  isActive: () => boolean;
}

const LINKING_ERROR =
  `The package 'ScreenStateListener' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- Run 'pod install'\n", default: '' }) +
  '- Rebuild the app\n';

// Check if native module exists
const hasNativeModule = NativeModules.ScreenStateListener != null;

const ScreenStateListenerNative = hasNativeModule
  ? (NativeModules.ScreenStateListener as ScreenStateListenerModule)
  : (new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      },
    ) as ScreenStateListenerModule);

// Only create event emitter if native module exists
const eventEmitter = hasNativeModule
  ? new NativeEventEmitter(NativeModules.ScreenStateListener)
  : null;

export interface ScreenStateChangeEvent {
  isScreenOn: boolean;
}

export type ScreenStateChangeListener = (isScreenOn: boolean) => void;

// No-op subscription that satisfies EmitterSubscription interface
// Using 'as EmitterSubscription' cast because we only need the remove() method
// and the other properties are internal to React Native's event system
const createNoOpSubscription = (): EmitterSubscription =>
  ({
    remove: () => {
      /* no-op */
    },
    eventType: 'screenStateChanged',
    key: -1,
    subscriber: null as any,
    emitter: null as any,
    listener: () => {},
    context: null,
  }) as EmitterSubscription;

/**
 * Native module to detect Android screen ON/OFF events.
 *
 * **Important:** This only works on Android. iOS doesn't provide access to screen power events.
 *
 * @example
 * ```ts
 * import ScreenStateListener from '@utils/ScreenStateListener';
 *
 * // Start listening
 * const subscription = ScreenStateListener.addListener((isScreenOn) => {
 *   if (isScreenOn) {
 *     console.log('Screen turned ON');
 *   } else {
 *     console.log('Screen turned OFF');
 *   }
 * });
 *
 * // Clean up
 * subscription.remove();
 * ```
 */
export const ScreenStateListener = {
  /**
   * Add listener for screen state changes.
   * Automatically starts listening when first listener is added.
   *
   * @param listener - Callback function that receives boolean (true = screen ON, false = screen OFF)
   * @returns Subscription object with remove() method
   */
  addListener(listener: ScreenStateChangeListener): EmitterSubscription {
    // Check if native module is available
    if (!hasNativeModule || !eventEmitter) {
      screenStateLog.warn(
        'native-unavailable',
        'ScreenStateListener native module not available, returning no-op subscription',
      );
      // Return a no-op subscription that does nothing
      return createNoOpSubscription();
    }

    try {
      // Start listening if not already active
      const isCurrentlyActive = ScreenStateListenerNative.isActive();
      screenStateLog.debug(
        'addListener',
        `isCurrentlyActive=${isCurrentlyActive}`,
      );

      if (!isCurrentlyActive) {
        screenStateLog.info('addListener', 'Starting native listener');
        ScreenStateListenerNative.startListening();
      }

      // Wrap the listener to add logging
      const wrappedListener = (isScreenOn: boolean) => {
        screenStateLog.info('event-received', `isScreenOn=${isScreenOn}`);
        listener(isScreenOn);
      };

      const subscription = eventEmitter.addListener(
        'screenStateChanged',
        wrappedListener,
      );
      screenStateLog.debug('addListener', 'Subscription created successfully');

      return subscription;
    } catch (error) {
      screenStateLog.error('addListener', 'Failed to add listener', error);
      // Return a no-op subscription
      return createNoOpSubscription();
    }
  },

  /**
   * Manually stop listening to screen events.
   * Usually not needed - will auto-stop when all listeners are removed.
   */
  stopListening() {
    if (!hasNativeModule) {
      screenStateLog.warn('stopListening', 'Native module not available');
      return;
    }

    try {
      screenStateLog.debug('stopListening', 'Stopping native listener');
      ScreenStateListenerNative.stopListening();
    } catch (error) {
      screenStateLog.error('stopListening', 'Failed to stop listening', error);
    }
  },

  /**
   * Check if currently listening for screen events.
   */
  isActive(): boolean {
    if (!hasNativeModule) {
      return false;
    }

    try {
      return ScreenStateListenerNative.isActive();
    } catch {
      return false;
    }
  },

  /**
   * Check if native module is available.
   */
  isAvailable(): boolean {
    return hasNativeModule;
  },
};

export default ScreenStateListener;
