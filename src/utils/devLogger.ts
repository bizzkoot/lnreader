const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
// Allow enabling verbose debug logs by setting global flag at runtime
const verbose = isDev && !!(globalThis as any).__LNREADER_VERBOSE__;

const format = (level: string, ...args: any[]) => {
  if (!isDev) return;
  const prefix = `[LNReader][${level}]`;
  // Use console.* directly in dev only
  // eslint-disable-next-line no-console
  console.log(prefix, ...args);
};

// Debug-level logs are disabled by default even in dev to avoid spam.
export const debug = (...args: any[]) => {
  if (!verbose) return;
  format('DEBUG', ...args);
};

export const info = (...args: any[]) => {
  if (!isDev) return;
  format('INFO', ...args);
};

export const warn = (...args: any[]) => {
  if (!isDev) return;
  format('WARN', ...args);
};

export const error = (...args: any[]) => {
  if (!isDev) return;
  format('ERROR', ...args);
};

export default {
  debug,
  info,
  warn,
  error,
};
