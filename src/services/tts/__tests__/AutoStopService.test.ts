import { AutoStopService } from '../AutoStopService';

describe('AutoStopService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Mode: minutes', () => {
    it.each([15, 30, 45, 60])(
      'stops after %d minutes when screen OFF',
      minutes => {
        const service = new AutoStopService();
        const onAutoStop = jest.fn();

        service.start({ mode: 'minutes', amount: minutes }, onAutoStop);
        // @ts-ignore - accessing test-only method
        service.__testStartTimer();

        // Advance to just before timeout
        jest.advanceTimersByTime(minutes * 60_000 - 1);
        expect(onAutoStop).not.toHaveBeenCalled();

        // Advance past timeout
        jest.advanceTimersByTime(1);
        expect(onAutoStop).toHaveBeenCalledTimes(1);
        expect(onAutoStop).toHaveBeenCalledWith('minutes');
      },
    );

    it('does not start timer when screen is ON', () => {
      const service = new AutoStopService();
      const onAutoStop = jest.fn();

      service.start({ mode: 'minutes', amount: 15 }, onAutoStop);
      // Note: NOT calling __testStartTimer() - simulating screen ON

      // Advance full duration
      jest.advanceTimersByTime(15 * 60_000);
      expect(onAutoStop).not.toHaveBeenCalled();
    });

    it('restarts timer when screen goes ON then OFF again', () => {
      const service = new AutoStopService();
      const onAutoStop = jest.fn();

      service.start({ mode: 'minutes', amount: 1 }, onAutoStop);
      // @ts-ignore
      service.__testStartTimer();

      // 30 seconds pass
      jest.advanceTimersByTime(30_000);

      // Screen turns ON (should NOT trigger in remaining time since counters reset)
      // Call resetCounters to simulate screen ON clearing state
      service.resetCounters();
      // @ts-ignore
      service.__testSetScreenOff(false);

      // Advance remaining time - should NOT trigger
      jest.advanceTimersByTime(30_000);
      expect(onAutoStop).not.toHaveBeenCalled();

      // Screen turns OFF again - restarts timer
      // @ts-ignore
      service.__testSetScreenOff(true);
      // @ts-ignore
      service.__testStartTimer();

      // Now the full minute must pass again
      jest.advanceTimersByTime(60_000);
      expect(onAutoStop).toHaveBeenCalledTimes(1);
    });

    it('resetCounters restarts the timer when screen OFF', () => {
      const service = new AutoStopService();
      const onAutoStop = jest.fn();

      service.start({ mode: 'minutes', amount: 1 }, onAutoStop);
      // @ts-ignore
      service.__testStartTimer();

      jest.advanceTimersByTime(30_000); // 30 seconds elapsed

      service.resetCounters(); // Should restart timer

      jest.advanceTimersByTime(59_999);
      expect(onAutoStop).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(onAutoStop).toHaveBeenCalledTimes(1);
    });
  });

  describe('Mode: paragraphs', () => {
    it.each([5, 10, 15, 20, 30])(
      'stops after %d paragraphs when screen OFF',
      count => {
        const service = new AutoStopService();
        const onAutoStop = jest.fn();

        service.start({ mode: 'paragraphs', amount: count }, onAutoStop);
        // @ts-ignore
        service.__testSetScreenOff(true);

        // Speak count-1 paragraphs
        for (let i = 0; i < count - 1; i++) {
          service.onParagraphSpoken();
        }
        expect(onAutoStop).not.toHaveBeenCalled();

        // Speak final paragraph
        service.onParagraphSpoken();
        expect(onAutoStop).toHaveBeenCalledTimes(1);
        expect(onAutoStop).toHaveBeenCalledWith('paragraphs');
      },
    );

    it('does not count paragraphs when screen ON', () => {
      const service = new AutoStopService();
      const onAutoStop = jest.fn();

      service.start({ mode: 'paragraphs', amount: 5 }, onAutoStop);

      // Screen is ON (default conservative state)
      for (let i = 0; i < 10; i++) {
        service.onParagraphSpoken();
      }
      expect(onAutoStop).not.toHaveBeenCalled();
    });

    it('resets count when screen goes ON, restarts when OFF', () => {
      const service = new AutoStopService();
      const onAutoStop = jest.fn();

      service.start({ mode: 'paragraphs', amount: 5 }, onAutoStop);
      // @ts-ignore
      service.__testSetScreenOff(true);

      // Speak 3 paragraphs
      for (let i = 0; i < 3; i++) {
        service.onParagraphSpoken();
      }

      // Screen turns ON - should reset (simulate via resetCounters + flag change)
      service.resetCounters();
      // @ts-ignore
      service.__testSetScreenOff(false);

      // Screen turns OFF again
      // @ts-ignore
      service.__testSetScreenOff(true);

      // Must now speak all 5 again (counter was reset)
      for (let i = 0; i < 5; i++) {
        service.onParagraphSpoken();
      }
      expect(onAutoStop).toHaveBeenCalledTimes(1);
    });

    it('resetCounters clears paragraph count', () => {
      const service = new AutoStopService();
      const onAutoStop = jest.fn();

      service.start({ mode: 'paragraphs', amount: 5 }, onAutoStop);
      // @ts-ignore
      service.__testSetScreenOff(true);

      // Speak 3 paragraphs
      for (let i = 0; i < 3; i++) {
        service.onParagraphSpoken();
      }

      service.resetCounters();

      // Must now speak all 5 again
      for (let i = 0; i < 5; i++) {
        service.onParagraphSpoken();
      }
      expect(onAutoStop).toHaveBeenCalledTimes(1);
    });
  });

  describe('Mode: chapters', () => {
    it.each([1, 3, 5, 10])('stops after %d chapters when screen OFF', count => {
      const service = new AutoStopService();
      const onAutoStop = jest.fn();

      service.start({ mode: 'chapters', amount: count }, onAutoStop);
      // @ts-ignore
      service.__testSetScreenOff(true);

      // Finish count-1 chapters
      for (let i = 0; i < count - 1; i++) {
        service.onChapterFinished();
      }
      expect(onAutoStop).not.toHaveBeenCalled();

      // Finish final chapter
      service.onChapterFinished();
      expect(onAutoStop).toHaveBeenCalledTimes(1);
      expect(onAutoStop).toHaveBeenCalledWith('chapters');
    });

    it('does not count chapters when screen ON', () => {
      const service = new AutoStopService();
      const onAutoStop = jest.fn();

      service.start({ mode: 'chapters', amount: 3 }, onAutoStop);

      // Screen is ON (default conservative state)
      for (let i = 0; i < 5; i++) {
        service.onChapterFinished();
      }
      expect(onAutoStop).not.toHaveBeenCalled();
    });

    it('resets count when screen goes ON, restarts when OFF', () => {
      const service = new AutoStopService();
      const onAutoStop = jest.fn();

      service.start({ mode: 'chapters', amount: 3 }, onAutoStop);
      // @ts-ignore
      service.__testSetScreenOff(true);

      // Finish 2 chapters
      service.onChapterFinished();
      service.onChapterFinished();

      // Screen turns ON - should reset (simulate via resetCounters + flag change)
      service.resetCounters();
      // @ts-ignore
      service.__testSetScreenOff(false);

      // Screen turns OFF again
      // @ts-ignore
      service.__testSetScreenOff(true);

      // Must now finish all 3 again (counter was reset)
      service.onChapterFinished();
      service.onChapterFinished();
      service.onChapterFinished();
      expect(onAutoStop).toHaveBeenCalledTimes(1);
    });

    it('resetCounters clears chapter count', () => {
      const service = new AutoStopService();
      const onAutoStop = jest.fn();

      service.start({ mode: 'chapters', amount: 3 }, onAutoStop);
      // @ts-ignore
      service.__testSetScreenOff(true);

      // Finish 2 chapters
      service.onChapterFinished();
      service.onChapterFinished();

      service.resetCounters();

      // Must now finish all 3 again
      service.onChapterFinished();
      service.onChapterFinished();
      service.onChapterFinished();
      expect(onAutoStop).toHaveBeenCalledTimes(1);
    });
  });

  describe('Mode: off', () => {
    it('does nothing when mode is off', () => {
      const service = new AutoStopService();
      const onAutoStop = jest.fn();

      service.start({ mode: 'off', amount: 0 }, onAutoStop);
      // @ts-ignore
      service.__testSetScreenOff(true);

      // Try all actions
      service.onParagraphSpoken();
      service.onChapterFinished();
      jest.advanceTimersByTime(60_000);

      expect(onAutoStop).not.toHaveBeenCalled();
    });
  });

  describe('Invalid configurations', () => {
    it('ignores invalid amount (zero)', () => {
      const service = new AutoStopService();
      const onAutoStop = jest.fn();

      service.start({ mode: 'minutes', amount: 0 }, onAutoStop);
      // @ts-ignore
      service.__testStartTimer();

      jest.advanceTimersByTime(60_000);
      expect(onAutoStop).not.toHaveBeenCalled();
    });

    it('ignores invalid amount (negative)', () => {
      const service = new AutoStopService();
      const onAutoStop = jest.fn();

      service.start({ mode: 'paragraphs', amount: -5 }, onAutoStop);
      // @ts-ignore
      service.__testSetScreenOff(true);

      for (let i = 0; i < 10; i++) {
        service.onParagraphSpoken();
      }
      expect(onAutoStop).not.toHaveBeenCalled();
    });

    it('ignores invalid amount (NaN)', () => {
      const service = new AutoStopService();
      const onAutoStop = jest.fn();

      service.start({ mode: 'chapters', amount: NaN }, onAutoStop);
      // @ts-ignore
      service.__testSetScreenOff(true);

      for (let i = 0; i < 5; i++) {
        service.onChapterFinished();
      }
      expect(onAutoStop).not.toHaveBeenCalled();
    });

    it('ignores invalid amount (Infinity)', () => {
      const service = new AutoStopService();
      const onAutoStop = jest.fn();

      service.start({ mode: 'minutes', amount: Infinity }, onAutoStop);
      // @ts-ignore
      service.__testStartTimer();

      jest.advanceTimersByTime(60_000);
      expect(onAutoStop).not.toHaveBeenCalled();
    });
  });

  describe('Service lifecycle', () => {
    it('stop() prevents callback and clears all state', () => {
      const service = new AutoStopService();
      const onAutoStop = jest.fn();

      service.start({ mode: 'minutes', amount: 1 }, onAutoStop);
      // @ts-ignore
      service.__testStartTimer();

      service.stop();
      jest.advanceTimersByTime(60_000);
      expect(onAutoStop).not.toHaveBeenCalled();
    });

    it('stop() clears paragraph count', () => {
      const service = new AutoStopService();
      const onAutoStop = jest.fn();

      service.start({ mode: 'paragraphs', amount: 5 }, onAutoStop);
      // @ts-ignore
      service.__testSetScreenOff(true);

      // Speak 3 paragraphs
      for (let i = 0; i < 3; i++) {
        service.onParagraphSpoken();
      }

      service.stop();

      // Start again with same config
      const onAutoStop2 = jest.fn();
      service.start({ mode: 'paragraphs', amount: 5 }, onAutoStop2);
      // @ts-ignore
      service.__testSetScreenOff(true);

      // Must speak all 5 (previous count was cleared)
      for (let i = 0; i < 5; i++) {
        service.onParagraphSpoken();
      }
      expect(onAutoStop2).toHaveBeenCalledTimes(1);
    });

    it('start() with new config clears previous state', () => {
      const service = new AutoStopService();
      const onAutoStop1 = jest.fn();

      // Start with paragraphs mode
      service.start({ mode: 'paragraphs', amount: 5 }, onAutoStop1);
      // @ts-ignore
      service.__testSetScreenOff(true);

      for (let i = 0; i < 3; i++) {
        service.onParagraphSpoken();
      }

      // Start with new config (minutes mode)
      const onAutoStop2 = jest.fn();
      service.start({ mode: 'minutes', amount: 1 }, onAutoStop2);
      // @ts-ignore
      service.__testStartTimer();

      // Old paragraph count should be cleared
      service.onParagraphSpoken();
      expect(onAutoStop1).not.toHaveBeenCalled();

      // New timer should work
      jest.advanceTimersByTime(60_000);
      expect(onAutoStop2).toHaveBeenCalledTimes(1);
    });

    it('trigger() calls stop() after invoking callback', () => {
      const service = new AutoStopService();
      const onAutoStop = jest.fn();

      service.start({ mode: 'minutes', amount: 1 }, onAutoStop);
      // @ts-ignore
      service.__testStartTimer();

      jest.advanceTimersByTime(60_000);
      expect(onAutoStop).toHaveBeenCalledTimes(1);

      // Service should be stopped now - advancing more time does nothing
      jest.advanceTimersByTime(60_000);
      expect(onAutoStop).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge cases', () => {
    it('handles multiple resetCounters calls', () => {
      const service = new AutoStopService();
      const onAutoStop = jest.fn();

      service.start({ mode: 'paragraphs', amount: 5 }, onAutoStop);
      // @ts-ignore
      service.__testSetScreenOff(true);

      service.onParagraphSpoken();
      service.resetCounters();
      service.onParagraphSpoken();
      service.resetCounters();
      service.onParagraphSpoken();
      service.resetCounters();

      // After all resets, must speak all 5
      for (let i = 0; i < 5; i++) {
        service.onParagraphSpoken();
      }
      expect(onAutoStop).toHaveBeenCalledTimes(1);
    });

    it('handles rapid screen ON/OFF transitions', () => {
      const service = new AutoStopService();
      const onAutoStop = jest.fn();

      service.start({ mode: 'paragraphs', amount: 3 }, onAutoStop);

      // Rapid transitions
      // @ts-ignore
      service.__testSetScreenOff(true);
      service.onParagraphSpoken();
      // @ts-ignore
      service.__testSetScreenOff(false);
      // @ts-ignore
      service.__testSetScreenOff(true);
      service.onParagraphSpoken();
      // @ts-ignore
      service.__testSetScreenOff(false);
      // @ts-ignore
      service.__testSetScreenOff(true);

      // After all transitions, must speak all 3
      for (let i = 0; i < 3; i++) {
        service.onParagraphSpoken();
      }
      expect(onAutoStop).toHaveBeenCalledTimes(1);
    });

    it('handles onParagraphSpoken in wrong mode (chapters)', () => {
      const service = new AutoStopService();
      const onAutoStop = jest.fn();

      service.start({ mode: 'chapters', amount: 3 }, onAutoStop);
      // @ts-ignore
      service.__testSetScreenOff(true);

      // Call wrong method
      for (let i = 0; i < 10; i++) {
        service.onParagraphSpoken();
      }
      expect(onAutoStop).not.toHaveBeenCalled();

      // Correct method should still work
      for (let i = 0; i < 3; i++) {
        service.onChapterFinished();
      }
      expect(onAutoStop).toHaveBeenCalledTimes(1);
    });

    it('handles onChapterFinished in wrong mode (paragraphs)', () => {
      const service = new AutoStopService();
      const onAutoStop = jest.fn();

      service.start({ mode: 'paragraphs', amount: 5 }, onAutoStop);
      // @ts-ignore
      service.__testSetScreenOff(true);

      // Call wrong method
      for (let i = 0; i < 10; i++) {
        service.onChapterFinished();
      }
      expect(onAutoStop).not.toHaveBeenCalled();

      // Correct method should still work
      for (let i = 0; i < 5; i++) {
        service.onParagraphSpoken();
      }
      expect(onAutoStop).toHaveBeenCalledTimes(1);
    });

    it('conservative default: assumes screen ON until explicit OFF', () => {
      const service = new AutoStopService();
      const onAutoStop = jest.fn();

      service.start({ mode: 'paragraphs', amount: 3 }, onAutoStop);

      // Without calling __testSetScreenOff(true), screen is assumed ON
      for (let i = 0; i < 10; i++) {
        service.onParagraphSpoken();
      }
      expect(onAutoStop).not.toHaveBeenCalled();
    });
  });
});
