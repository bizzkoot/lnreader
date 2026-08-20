/**
 * Module-scoped serialization queue for plugin-list MMKV writes.
 *
 * `usePlugins` is instantiated in several places (Main, AvailableTab,
 * InstalledTab, PluginListItem, SettingsRepositoryScreen). A per-instance
 * `useRef` queue would give each instance its own serialization chain, which
 * is safe only as long as every write-lock block stays synchronous. Hoisting
 * the queue to module scope (same pattern as `src/plugins/mutationQueue.ts`)
 * guarantees cross-instance FIFO ordering even if a block later gains an
 * `await` (e.g. a DB call inside a reconcile).
 *
 * Guarantees:
 * - Operations run strictly in FIFO order; no two operations overlap.
 * - A rejected (or thrown) operation still releases the queue via `finally`,
 *   so a failure never wedges subsequent writes.
 * - The queue never rejects: `await previous` resolves unconditionally
 *   because the chain only ever resolves through `release()`.
 */

let writeQueue: Promise<void> = Promise.resolve();

// test-only: reset module-scoped chain between tests to avoid cross-test pollution
export const __resetQueueForTests = () => {
  writeQueue = Promise.resolve();
};

export const withWriteLock = async <T>(
  operation: () => Promise<T> | T,
): Promise<T> => {
  const previous = writeQueue;
  let release!: () => void;
  writeQueue = new Promise<void>(resolve => {
    release = resolve;
  });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
};
