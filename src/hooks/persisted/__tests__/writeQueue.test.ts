import { withWriteLock, __resetQueueForTests } from '../writeQueue';

const createDeferred = <T = void>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('withWriteLock (module-scoped plugin write queue)', () => {
  beforeEach(() => {
    __resetQueueForTests();
  });

  it('runs operations strictly in FIFO order without interleaving', async () => {
    const events: string[] = [];
    const gate = createDeferred<void>();

    const pA = withWriteLock(async () => {
      events.push('a-start');
      await gate.promise;
      events.push('a-end');
      return 'A';
    });
    const pB = withWriteLock(async () => {
      events.push('b-start');
      events.push('b-end');
      return 'B';
    });
    const pC = withWriteLock(async () => {
      events.push('c-start');
      events.push('c-end');
      return 'C';
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual(['a-start']);
    expect(events).not.toContain('b-start');

    gate.resolve();
    const results = await Promise.all([pA, pB, pC]);

    expect(results).toEqual(['A', 'B', 'C']);
    expect(events.indexOf('b-start')).toBeGreaterThan(events.indexOf('a-end'));
    expect(events.indexOf('c-start')).toBeGreaterThan(events.indexOf('b-end'));
  });

  it('releases the queue when an operation rejects', async () => {
    const first = withWriteLock(async () => {
      throw new Error('boom');
    });

    await expect(first).rejects.toThrow('boom');

    // The queue was released by `finally` — a subsequent operation still runs.
    await expect(withWriteLock(async () => 'ok')).resolves.toBe('ok');
  });

  it('releases the queue when a later operation in the chain rejects', async () => {
    const chain = Promise.allSettled([
      withWriteLock(async () => 'first'),
      withWriteLock(async () => {
        throw new Error('middle');
      }),
      withWriteLock(async () => 'third'),
    ]);

    const settled = await chain;
    expect(settled.map(s => s.status)).toEqual([
      'fulfilled',
      'rejected',
      'fulfilled',
    ]);
    expect((settled[2] as PromiseFulfilledResult<string>).value).toBe('third');
  });

  it('supports synchronous operations', async () => {
    await expect(withWriteLock(() => 'sync')).resolves.toBe('sync');
  });

  it('propagates the operation return value', async () => {
    const value = await withWriteLock(() => 42);
    expect(value).toBe(42);
  });
});
