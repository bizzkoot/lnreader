#!/usr/bin/env node
/*
 * Lightweight simulator for TTSAudioManager.refillQueue behavior.
 * Simulates intermittent native addToBatch failures and verifies retry + fallback.
 */
const BATCH_SIZE = 15;
const REFILL_THRESHOLD = 5;

// Simulated native module that sometimes fails addToBatch
const Native = {
  _queueSize: 3, // starting queue size so refill will trigger
  async getQueueSize() {
    // simulate async latency
    await new Promise(r => setTimeout(r, 20));
    return this._queueSize;
  },
  async addToBatch(texts, ids) {
    await new Promise(r => setTimeout(r, 40));
    // Randomly fail ~40% of the time to simulate native instability
    if (Math.random() < 0.4) {
      const err = new Error('Simulated native addToBatch failure');
      throw err;
    }
    // simulate the native queue growing
    this._queueSize += texts.length;
    return true;
  },
  async speakBatch(texts, ids) {
    await new Promise(r => setTimeout(r, 40));
    // speakBatch always succeeds in this sim
    this._queueSize += texts.length;
    return texts.length;
  },
};

async function simulateRefill(currentQueue, currentIndex) {
  console.log(
    'Simulator starting — currentQueue length:',
    currentQueue.length,
    'currentIndex:',
    currentIndex,
  );

  async function refillQueue() {
    if (currentIndex >= currentQueue.length) {
      console.log('Simulator: no more items to refill');
      return false;
    }

    const queueSize = await Native.getQueueSize();
    console.log('Simulator: native queueSize is', queueSize);
    if (queueSize > REFILL_THRESHOLD) {
      console.log('Simulator: queue has enough items — skip refill');
      return false;
    }

    const remainingCount = currentQueue.length - currentIndex;
    const nextBatchSize = Math.min(BATCH_SIZE, remainingCount);
    const nextTexts = currentQueue.slice(
      currentIndex,
      currentIndex + nextBatchSize,
    );
    const nextIds = new Array(nextBatchSize)
      .fill(0)
      .map((_, i) => `uid_${currentIndex + i}`);

    const maxAddAttempts = 3;
    for (let attempt = 1; attempt <= maxAddAttempts; attempt++) {
      try {
        console.log(
          `Simulator: addToBatch attempt ${attempt} for ${nextBatchSize} items`,
        );
        await Native.addToBatch(nextTexts, nextIds);
        console.log('Simulator: addToBatch succeeded');
        currentIndex += nextBatchSize;
        return true;
      } catch (err) {
        console.warn(
          `Simulator: addToBatch failed attempt ${attempt}:`,
          err.message,
        );
        if (attempt < maxAddAttempts)
          await new Promise(r => setTimeout(r, 150 * attempt));
      }
    }

    // After retries: check queue size and try fallback
    const queueSizeAfter = await Native.getQueueSize();
    console.log(
      'Simulator: queueSizeAfter failed add attempts:',
      queueSizeAfter,
    );
    if (queueSizeAfter === 0) {
      console.log('Simulator: queue empty — using speakBatch fallback');
      await Native.speakBatch(nextTexts, nextIds);
      currentIndex += nextBatchSize;
      console.log('Simulator: speakBatch fallback succeeded');
      return true;
    }

    console.error(
      'Simulator: refill failed after retries and fallback conditions',
    );
    return false;
  }

  // simulate multiple refill attempts until queue consumed
  while (currentIndex < currentQueue.length) {
    const ok = await refillQueue();
    if (!ok) break;
    console.log('Simulator: currentIndex now', currentIndex);
    // artificially consume some native queue to simulate speaking
    Native._queueSize = Math.max(
      0,
      Native._queueSize - Math.floor(Math.random() * 7 + 1),
    );
    await new Promise(r => setTimeout(r, 120));
  }

  console.log(
    'Simulator finished — index:',
    currentIndex,
    'queue length:',
    currentQueue.length,
  );
}

async function run() {
  // Prepare a simulated chapter paragraph list
  const paragraphs = new Array(60).fill(0).map((_, i) => `para_${i}`);
  // start near the beginning
  const startIndex = 1;
  await simulateRefill(paragraphs, startIndex);
}

run().catch(err => {
  console.error('Simulator encountered error', err);
  process.exit(1);
});
