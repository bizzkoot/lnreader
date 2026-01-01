/* eslint-disable no-console */
/**
 * SCREEN STATE LISTENER USAGE EXAMPLES
 *
 * This demonstrates how to use the ScreenStateListener native module
 * to detect when the Android screen turns ON or OFF.
 */

import { useEffect } from 'react';
import ScreenStateListener from '@utils/ScreenStateListener';

// ============================================
// Example 1: Basic Usage in a Component
// ============================================
export function BasicScreenDetection() {
  useEffect(() => {
    const subscription = ScreenStateListener.addListener(isScreenOn => {
      if (isScreenOn) {
        console.log('✅ Screen turned ON');
        // Handle screen ON event
      } else {
        console.log('🔒 Screen turned OFF (power button or timeout)');
        // Handle screen OFF event
      }
    });

    // Clean up on unmount
    return () => {
      subscription.remove();
    };
  }, []);

  return null;
}

// ============================================
// Example 2: TTS Auto-Stop on Screen Off
// ============================================
export function TTSWithScreenDetection() {
  useEffect(() => {
    let screenOffTimer: NodeJS.Timeout | null = null;

    const subscription = ScreenStateListener.addListener(isScreenOn => {
      if (!isScreenOn) {
        // Screen turned OFF - start 30 minute timer
        console.log('Starting TTS auto-stop timer (30 min)');
        screenOffTimer = setTimeout(
          () => {
            console.log('Stopping TTS after 30 minutes of screen off');
            // Stop TTS here
          },
          30 * 60 * 1000,
        );
      } else {
        // Screen turned ON - cancel timer
        if (screenOffTimer) {
          console.log('Screen turned on - canceling auto-stop timer');
          clearTimeout(screenOffTimer);
          screenOffTimer = null;
        }
      }
    });

    return () => {
      if (screenOffTimer) {
        clearTimeout(screenOffTimer);
      }
      subscription.remove();
    };
  }, []);

  return null;
}

// ============================================
// Example 3: Track Screen Off Duration
// ============================================
export function ScreenOffDurationTracker() {
  useEffect(() => {
    let screenOffStartTime: number | null = null;

    const subscription = ScreenStateListener.addListener(isScreenOn => {
      if (!isScreenOn) {
        screenOffStartTime = Date.now();
        console.log('Screen went OFF at', new Date().toISOString());
      } else if (screenOffStartTime) {
        const duration = Date.now() - screenOffStartTime;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        console.log(`Screen was OFF for ${minutes}m ${seconds}s`);
        screenOffStartTime = null;
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return null;
}

// ============================================
// Example 4: Multiple Listeners
// ============================================
export function MultipleListenersExample() {
  useEffect(() => {
    // Listener 1: Analytics
    const analyticsSubscription = ScreenStateListener.addListener(
      isScreenOn => {
        // Track screen state in analytics
        console.log('[Analytics] Screen state:', isScreenOn ? 'ON' : 'OFF');
      },
    );

    // Listener 2: Battery optimization
    const batterySubscription = ScreenStateListener.addListener(isScreenOn => {
      if (!isScreenOn) {
        console.log('[Battery] Reducing background activity');
        // Reduce polling, animations, etc.
      } else {
        console.log('[Battery] Resuming normal activity');
      }
    });

    return () => {
      analyticsSubscription.remove();
      batterySubscription.remove();
    };
  }, []);

  return null;
}

// ============================================
// Example 5: Manual Control (demonstration only)
// ============================================
export function ManualControlExample() {
  // These functions demonstrate the API, but aren't called in this example
  // In real usage, you'd call them from buttons or lifecycle events

  // @ts-expect-error - Demonstration function, not called
  const _startMonitoring = () => {
    const subscription = ScreenStateListener.addListener(isScreenOn => {
      console.log('Screen state:', isScreenOn ? 'ON' : 'OFF');
    });

    // Store subscription somewhere to remove later
    return subscription;
  };

  // @ts-expect-error - Demonstration function, not called
  const _stopMonitoring = (
    subscription: ReturnType<typeof ScreenStateListener.addListener>,
  ) => {
    subscription.remove();
    // Optionally stop all listening
    // ScreenStateListener.stopListening();
  };

  // @ts-expect-error - Demonstration function, not called
  const _checkIfActive = () => {
    const isActive = ScreenStateListener.isActive();
    console.log('Is monitoring?', isActive);
  };

  return null;
}
