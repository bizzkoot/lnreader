import { AutoStopService } from '../AutoStopService';

describe('AutoStopService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stops after specified minutes', () => {
    const service = new AutoStopService();
    const onAutoStop = jest.fn();

    service.start({ mode: 'minutes', amount: 15 }, onAutoStop);
    // Manually start timer for testing (bypasses screen-off detection)
    // @ts-ignore - accessing test-only method
    service.__testStartTimer();

    jest.advanceTimersByTime(15 * 60_000 - 1);
    expect(onAutoStop).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onAutoStop).toHaveBeenCalledTimes(1);
    expect(onAutoStop).toHaveBeenCalledWith('minutes');
  });

  it('stops after N paragraphs spoken (only when screen OFF)', () => {
    const service = new AutoStopService();
    const onAutoStop = jest.fn();

    service.start({ mode: 'paragraphs', amount: 5 }, onAutoStop);

    // Paragraphs spoken while screen ON should NOT count
    for (let i = 0; i < 10; i++) service.onParagraphSpoken();
    expect(onAutoStop).not.toHaveBeenCalled();

    // @ts-ignore - Simulate screen going OFF via test method
    service.__testSetScreenOff(true);

    // Now paragraphs should count
    for (let i = 0; i < 4; i++) service.onParagraphSpoken();
    expect(onAutoStop).not.toHaveBeenCalled();

    service.onParagraphSpoken();
    expect(onAutoStop).toHaveBeenCalledTimes(1);
    expect(onAutoStop).toHaveBeenCalledWith('paragraphs');
  });

  it('stops after N chapters finished (only when screen OFF)', () => {
    const service = new AutoStopService();
    const onAutoStop = jest.fn();

    service.start({ mode: 'chapters', amount: 3 }, onAutoStop);

    // Chapters while screen ON should NOT count
    service.onChapterFinished();
    service.onChapterFinished();
    expect(onAutoStop).not.toHaveBeenCalled();

    // @ts-ignore - Simulate screen going OFF via test method
    service.__testSetScreenOff(true);

    service.onChapterFinished();
    service.onChapterFinished();
    expect(onAutoStop).not.toHaveBeenCalled();

    service.onChapterFinished();
    expect(onAutoStop).toHaveBeenCalledTimes(1);
    expect(onAutoStop).toHaveBeenCalledWith('chapters');
  });

  it('stop() prevents callback', () => {
    const service = new AutoStopService();
    const onAutoStop = jest.fn();

    service.start({ mode: 'minutes', amount: 1 }, onAutoStop);
    // @ts-ignore - accessing test-only method
    service.__testStartTimer();

    service.stop();
    jest.advanceTimersByTime(60_000);
    expect(onAutoStop).not.toHaveBeenCalled();
  });

  it('resetCounters restarts minutes window', () => {
    const service = new AutoStopService();
    const onAutoStop = jest.fn();

    service.start({ mode: 'minutes', amount: 1 }, onAutoStop);
    // @ts-ignore - accessing test-only method
    service.__testStartTimer();

    jest.advanceTimersByTime(30_000); // 30 seconds elapsed

    service.resetCounters(); // Should restart timer

    jest.advanceTimersByTime(59_999);
    expect(onAutoStop).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onAutoStop).toHaveBeenCalledTimes(1);
  });
});
