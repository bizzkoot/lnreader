/**
 * TTS Audio Manager State Machine
 *
 * Explicit state enum to replace implicit boolean-based state management.
 * Enforces valid transitions and provides clear lifecycle semantics.
 */

export enum TTSState {
  /** No TTS activity - idle state */
  IDLE = 'IDLE',
  /** Initializing TTS session - loading voice, preparing queue */
  STARTING = 'STARTING',
  /** Actively playing TTS audio */
  PLAYING = 'PLAYING',
  /** Refilling native queue during playback */
  REFILLING = 'REFILLING',
  /** Stopping TTS - cleanup in progress */
  STOPPING = 'STOPPING',
}

type StateTransition = {
  from: TTSState;
  to: TTSState;
};

/**
 * Valid state transitions for TTS lifecycle
 *
 * Normal flow: IDLE → STARTING → PLAYING → REFILLING → PLAYING → STOPPING → IDLE
 * Stop from any state: * → STOPPING → IDLE
 */
const VALID_TRANSITIONS: StateTransition[] = [
  // Normal startup
  { from: TTSState.IDLE, to: TTSState.STARTING },
  { from: TTSState.STARTING, to: TTSState.PLAYING },

  // Refill cycle during playback
  { from: TTSState.PLAYING, to: TTSState.REFILLING },
  { from: TTSState.REFILLING, to: TTSState.PLAYING },

  // Normal shutdown
  { from: TTSState.PLAYING, to: TTSState.STOPPING },
  { from: TTSState.STOPPING, to: TTSState.IDLE },

  // Emergency stop from any state
  { from: TTSState.STARTING, to: TTSState.STOPPING },
  { from: TTSState.REFILLING, to: TTSState.STOPPING },

  // Restart while stopping (edge case)
  { from: TTSState.STOPPING, to: TTSState.STARTING },
];

/**
 * Check if a state transition is valid
 */
export function isValidTransition(from: TTSState, to: TTSState): boolean {
  // Allow staying in same state (idempotent operations)
  if (from === to) {
    return true;
  }
  return VALID_TRANSITIONS.some(t => t.from === from && t.to === to);
}

/**
 * Assert a state transition is valid (dev-mode only)
 *
 * Logs error in development, but allows transition in production
 * to avoid crashes from unexpected states.
 */
export function assertValidTransition(from: TTSState, to: TTSState): void {
  if (!isValidTransition(from, to)) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error(
        `[TTSAudioManager] Invalid state transition: ${from} → ${to}`,
      );
    }
    // In production, log but allow (graceful degradation)
  }
}
