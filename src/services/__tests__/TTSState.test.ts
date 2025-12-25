/**
 * Tests for TTSState module - state machine validation and transitions
 *
 * Focus: Test state transition validation logic
 * Coverage targets:
 * - Valid transitions between states
 * - Invalid transitions that should be rejected
 * - Edge case transitions
 * - Same-state transitions (idempotent operations)
 */

import { TTSState, isValidTransition } from '../TTSState';

describe('TTSState - State Machine Transitions', () => {
  describe('isValidTransition()', () => {
    describe('Valid transitions', () => {
      it('allows IDLE → STARTING (normal startup)', () => {
        expect(isValidTransition(TTSState.IDLE, TTSState.STARTING)).toBe(true);
      });

      it('allows STARTING → PLAYING (after voice loaded)', () => {
        expect(isValidTransition(TTSState.STARTING, TTSState.PLAYING)).toBe(
          true,
        );
      });

      it('allows PLAYING → REFILLING (queue running low)', () => {
        expect(isValidTransition(TTSState.PLAYING, TTSState.REFILLING)).toBe(
          true,
        );
      });

      it('allows REFILLING → PLAYING (refill complete)', () => {
        expect(isValidTransition(TTSState.REFILLING, TTSState.PLAYING)).toBe(
          true,
        );
      });

      it('allows PLAYING → STOPPING (user stops)', () => {
        expect(isValidTransition(TTSState.PLAYING, TTSState.STOPPING)).toBe(
          true,
        );
      });

      it('allows STOPPING → IDLE (cleanup complete)', () => {
        expect(isValidTransition(TTSState.STOPPING, TTSState.IDLE)).toBe(true);
      });

      it('allows STARTING → STOPPING (emergency stop during startup)', () => {
        expect(isValidTransition(TTSState.STARTING, TTSState.STOPPING)).toBe(
          true,
        );
      });

      it('allows REFILLING → STOPPING (emergency stop during refill)', () => {
        expect(isValidTransition(TTSState.REFILLING, TTSState.STOPPING)).toBe(
          true,
        );
      });

      it('allows STOPPING → STARTING (restart while stopping)', () => {
        expect(isValidTransition(TTSState.STOPPING, TTSState.STARTING)).toBe(
          true,
        );
      });

      it('allows same-state transitions (idempotent operations)', () => {
        expect(isValidTransition(TTSState.IDLE, TTSState.IDLE)).toBe(true);
        expect(isValidTransition(TTSState.STARTING, TTSState.STARTING)).toBe(
          true,
        );
        expect(isValidTransition(TTSState.PLAYING, TTSState.PLAYING)).toBe(
          true,
        );
        expect(isValidTransition(TTSState.REFILLING, TTSState.REFILLING)).toBe(
          true,
        );
        expect(isValidTransition(TTSState.STOPPING, TTSState.STOPPING)).toBe(
          true,
        );
      });
    });

    describe('Invalid transitions', () => {
      it('rejects IDLE → PLAYING (skips voice loading)', () => {
        expect(isValidTransition(TTSState.IDLE, TTSState.PLAYING)).toBe(false);
      });

      it('rejects IDLE → REFILLING (no active playback)', () => {
        expect(isValidTransition(TTSState.IDLE, TTSState.REFILLING)).toBe(
          false,
        );
      });

      it('rejects IDLE → STOPPING (nothing to stop)', () => {
        expect(isValidTransition(TTSState.IDLE, TTSState.STOPPING)).toBe(false);
      });

      it('rejects STARTING → REFILLING (not playing yet)', () => {
        expect(isValidTransition(TTSState.STARTING, TTSState.REFILLING)).toBe(
          false,
        );
      });

      it('rejects STARTING → IDLE (must go through STOPPING)', () => {
        expect(isValidTransition(TTSState.STARTING, TTSState.IDLE)).toBe(false);
      });

      it('rejects PLAYING → STARTING (already playing)', () => {
        expect(isValidTransition(TTSState.PLAYING, TTSState.STARTING)).toBe(
          false,
        );
      });

      it('rejects PLAYING → IDLE (must go through STOPPING)', () => {
        expect(isValidTransition(TTSState.PLAYING, TTSState.IDLE)).toBe(false);
      });

      it('rejects REFILLING → STARTING (already in active session)', () => {
        expect(isValidTransition(TTSState.REFILLING, TTSState.STARTING)).toBe(
          false,
        );
      });

      it('rejects REFILLING → IDLE (must go through STOPPING)', () => {
        expect(isValidTransition(TTSState.REFILLING, TTSState.IDLE)).toBe(
          false,
        );
      });

      it('rejects STOPPING → PLAYING (must complete stop first)', () => {
        expect(isValidTransition(TTSState.STOPPING, TTSState.PLAYING)).toBe(
          false,
        );
      });

      it('rejects STOPPING → REFILLING (invalid during cleanup)', () => {
        expect(isValidTransition(TTSState.STOPPING, TTSState.REFILLING)).toBe(
          false,
        );
      });
    });
  });

  describe('State machine lifecycle scenarios', () => {
    it('validates normal TTS flow: IDLE → STARTING → PLAYING → STOPPING → IDLE', () => {
      expect(isValidTransition(TTSState.IDLE, TTSState.STARTING)).toBe(true);
      expect(isValidTransition(TTSState.STARTING, TTSState.PLAYING)).toBe(true);
      expect(isValidTransition(TTSState.PLAYING, TTSState.STOPPING)).toBe(true);
      expect(isValidTransition(TTSState.STOPPING, TTSState.IDLE)).toBe(true);
    });

    it('validates refill cycle: PLAYING → REFILLING → PLAYING', () => {
      expect(isValidTransition(TTSState.PLAYING, TTSState.REFILLING)).toBe(
        true,
      );
      expect(isValidTransition(TTSState.REFILLING, TTSState.PLAYING)).toBe(
        true,
      );
    });

    it('validates emergency stop from any active state', () => {
      expect(isValidTransition(TTSState.STARTING, TTSState.STOPPING)).toBe(
        true,
      );
      expect(isValidTransition(TTSState.PLAYING, TTSState.STOPPING)).toBe(true);
      expect(isValidTransition(TTSState.REFILLING, TTSState.STOPPING)).toBe(
        true,
      );
    });

    it('validates restart during stop: STOPPING → STARTING → PLAYING', () => {
      expect(isValidTransition(TTSState.STOPPING, TTSState.STARTING)).toBe(
        true,
      );
      expect(isValidTransition(TTSState.STARTING, TTSState.PLAYING)).toBe(true);
    });
  });
});
