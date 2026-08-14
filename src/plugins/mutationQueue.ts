/**
 * Module-scoped serialization queue for plugin mutations.
 *
 * Extracted from pluginManager so the queue primitive can be unit-tested in
 * isolation — importing pluginManager pulls in cheerio/htmlparser2/urlencode
 * and native-file dependencies.
 *
 * Guarantees:
 * - Operations run strictly in FIFO order; no two operations overlap.
 * - A rejected (or thrown) operation still releases the queue via `finally`,
 *   so a failure never wedges subsequent installs/uninstalls/updates.
 * - The queue never rejects: `await previous` resolves unconditionally
 *   because the chain only ever resolves through `release()`.
 */

let mutationQueue = Promise.resolve();

export const withPluginMutationLock = async <T>(
  operation: () => Promise<T> | T,
): Promise<T> => {
  const previous = mutationQueue;
  let release!: () => void;
  mutationQueue = new Promise<void>(resolve => {
    release = resolve;
  });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
};
