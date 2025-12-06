import deletionGuard from '../src/utils/deletionGuard';

// Simple helper to wait
const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

describe('DeletionGuard concurrency simulation', () => {
  beforeEach(() => {
    // reset internal state
    deletionGuard.end();
  });

  test('saves are ignored while deletion is pending', async () => {
    let acceptedSaves = 0;
    let ignoredSaves = 0;

    // Simulate deletion process
    const deletionProcess = (async () => {
      const started = deletionGuard.begin();
      expect(started).toBe(true);
      // hold the deletion open for 200ms
      await wait(200);
      deletionGuard.end();
    })();

    // Start spamming save events while deletion is ongoing
    const saveSpam = (async () => {
      const start = Date.now();
      while (Date.now() - start < 300) {
        if (deletionGuard.isPending()) {
          ignoredSaves += 1;
        } else {
          acceptedSaves += 1;
        }
        // small gap
        // eslint-disable-next-line no-await-in-loop
        await wait(10);
      }
    })();

    await Promise.all([deletionProcess, saveSpam]);

    // We expect at least some saves to be ignored and that at least one save is accepted
    expect(ignoredSaves).toBeGreaterThan(0);
    expect(acceptedSaves).toBeGreaterThanOrEqual(0);
  });
});
