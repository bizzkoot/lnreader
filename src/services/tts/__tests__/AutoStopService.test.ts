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

    jest.advanceTimersByTime(15 * 60_000 - 1);
    expect(onAutoStop).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onAutoStop).toHaveBeenCalledTimes(1);
    expect(onAutoStop).toHaveBeenCalledWith('minutes');
  });

  it('stops after N paragraphs spoken', () => {
    const service = new AutoStopService();
    const onAutoStop = jest.fn();

    service.start({ mode: 'paragraphs', amount: 5 }, onAutoStop);

    for (let i = 0; i < 4; i++) service.onParagraphSpoken();
    expect(onAutoStop).not.toHaveBeenCalled();

    service.onParagraphSpoken();
    expect(onAutoStop).toHaveBeenCalledTimes(1);
    expect(onAutoStop).toHaveBeenCalledWith('paragraphs');
  });

  it('stops after N chapters finished', () => {
    const service = new AutoStopService();
    const onAutoStop = jest.fn();

    service.start({ mode: 'chapters', amount: 3 }, onAutoStop);

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
    service.stop();
    jest.advanceTimersByTime(60_000);
    expect(onAutoStop).not.toHaveBeenCalled();
  });

  it('resetCounters restarts minutes window', () => {
    const service = new AutoStopService();
    const onAutoStop = jest.fn();

    service.start({ mode: 'minutes', amount: 1 }, onAutoStop);
    jest.advanceTimersByTime(30_000);
    service.resetCounters();

    jest.advanceTimersByTime(59_999);
    expect(onAutoStop).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onAutoStop).toHaveBeenCalledTimes(1);
  });
});
