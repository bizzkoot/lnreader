type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type ConsoleFn = (...args: unknown[]) => void;

type RateLimitedLoggerOptions = {
  /** Minimum time between identical log keys (ms). */
  windowMs: number;
  /** If true, first log prints immediately, later logs are collapsed until flush. */
  leading: boolean;
  /** If true, emit a trailing summary line when window elapses. */
  trailing: boolean;
  /** Max distinct keys stored (oldest are evicted). */
  maxKeys: number;
};

const DEFAULT_OPTIONS: RateLimitedLoggerOptions = {
  windowMs: 1000,
  leading: true,
  trailing: true,
  maxKeys: 200,
};

type Bucket = {
  firstAt: number;
  lastAt: number;
  count: number;
  lastArgs: unknown[];
  flushTimer?: ReturnType<typeof setTimeout>;
};

function getConsoleFn(level: LogLevel): ConsoleFn {
  // eslint-disable-next-line no-console
  const c = console;
  switch (level) {
    case 'error':
      return c.error.bind(c);
    case 'warn':
      return c.warn.bind(c);
    case 'info':
      return c.log.bind(c);
    case 'debug':
    default:
      return c.log.bind(c);
  }
}

function formatScope(scope: string): string {
  return scope ? `[${scope}]` : '';
}

function isJestEnv(): boolean {
  // Jest sets this in worker processes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeof (process as any)?.env?.JEST_WORKER_ID === 'string';
}

export function createRateLimitedLogger(
  scope: string,
  options?: Partial<RateLimitedLoggerOptions>,
) {
  const cfg: RateLimitedLoggerOptions = {
    ...DEFAULT_OPTIONS,
    ...(options || {}),
  };
  // In Jest, any trailing setTimeout flush can fire after the test finishes
  // and cause "Cannot log after tests are done". Keep leading logs (useful)
  // but disable trailing summaries.
  if (isJestEnv()) {
    cfg.trailing = false;
  }
  const buckets = new Map<string, Bucket>();
  const keyOrder: string[] = [];

  function ensureCapacity() {
    while (keyOrder.length > cfg.maxKeys) {
      const evictKey = keyOrder.shift();
      if (!evictKey) break;
      const bucket = buckets.get(evictKey);
      if (bucket?.flushTimer) clearTimeout(bucket.flushTimer);
      buckets.delete(evictKey);
    }
  }

  function upsertKey(key: string) {
    const idx = keyOrder.indexOf(key);
    if (idx !== -1) keyOrder.splice(idx, 1);
    keyOrder.push(key);
    ensureCapacity();
  }

  function scheduleFlush(key: string, level: LogLevel) {
    const bucket = buckets.get(key);
    if (!bucket || !cfg.trailing) return;
    if (bucket.flushTimer) return;

    const remaining = Math.max(0, cfg.windowMs - (Date.now() - bucket.firstAt));
    bucket.flushTimer = setTimeout(() => {
      const b = buckets.get(key);
      if (!b) return;
      b.flushTimer = undefined;

      // Only emit summary if it actually spammed.
      if (b.count > 1) {
        const fn = getConsoleFn(level);
        fn(
          `${formatScope(scope)} ${key} (repeated ${b.count}x in ${cfg.windowMs}ms)`,
          ...b.lastArgs,
        );
      }

      // Reset bucket for next window.
      buckets.delete(key);
      const idx = keyOrder.indexOf(key);
      if (idx !== -1) keyOrder.splice(idx, 1);
    }, remaining);

    // Allow Node to exit even if a timer exists.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (bucket.flushTimer as any)?.unref?.();
  }

  function log(level: LogLevel, key: string, ...args: unknown[]) {
    if (!__DEV__) return;

    const now = Date.now();
    const existing = buckets.get(key);
    if (!existing) {
      const bucket: Bucket = {
        firstAt: now,
        lastAt: now,
        count: 1,
        lastArgs: args,
      };
      buckets.set(key, bucket);
      upsertKey(key);
      scheduleFlush(key, level);
      if (cfg.leading) {
        const fn = getConsoleFn(level);
        fn(`${formatScope(scope)} ${key}`, ...args);
      }
      return;
    }

    // Within the window => collapse.
    const withinWindow = now - existing.firstAt < cfg.windowMs;
    if (withinWindow) {
      existing.lastAt = now;
      existing.count += 1;
      existing.lastArgs = args;
      upsertKey(key);
      scheduleFlush(key, level);
      return;
    }

    // Window elapsed => flush previous and start a new window.
    if (existing.flushTimer) {
      clearTimeout(existing.flushTimer);
      existing.flushTimer = undefined;
    }
    if (cfg.trailing && existing.count > 1) {
      const fn = getConsoleFn(level);
      fn(
        `${formatScope(scope)} ${key} (repeated ${existing.count}x in ${cfg.windowMs}ms)`,
        ...existing.lastArgs,
      );
    }

    const bucket: Bucket = {
      firstAt: now,
      lastAt: now,
      count: 1,
      lastArgs: args,
    };
    buckets.set(key, bucket);
    upsertKey(key);
    scheduleFlush(key, level);
    if (cfg.leading) {
      const fn = getConsoleFn(level);
      fn(`${formatScope(scope)} ${key}`, ...args);
    }
  }

  return {
    debug: (key: string, ...args: unknown[]) => log('debug', key, ...args),
    info: (key: string, ...args: unknown[]) => log('info', key, ...args),
    warn: (key: string, ...args: unknown[]) => log('warn', key, ...args),
    error: (key: string, ...args: unknown[]) => log('error', key, ...args),
  };
}
