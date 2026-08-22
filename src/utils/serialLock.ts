/**
 * Generic FIFO serial lock primitive.
 * Used to serialize async mutations that must not overlap.
 */

export const createSerialLock = () => {
  let queue: Promise<void> = Promise.resolve();
  const resetForTests = () => {
    queue = Promise.resolve();
  };
  const withLock = async <T>(operation: () => Promise<T> | T): Promise<T> => {
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>(resolve => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  };
  return { withLock, __resetQueueForTests: resetForTests };
};
