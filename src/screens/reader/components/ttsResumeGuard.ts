export type DeferredSpeak = { text: string; paragraphIndex?: number };

export default function createResumeGuard() {
  let pending = false;
  let savedIndex = -1;
  let deferredSpeakQueue: DeferredSpeak[] = [];
  let queuedBatch: { startIndex: number; texts: string[] } | null = null;

  return {
    requestConfirmation: (idx: number) => {
      pending = true;
      savedIndex = Number.isFinite(idx) ? idx : -1;
    },

    isPending: () => pending,

    onSpeak: (text: string, paragraphIndex?: number) => {
      if (pending) {
        deferredSpeakQueue.push({ text, paragraphIndex });
        return false; // deferred
      }
      return true; // allowed to process immediately
    },

    onQueue: (startIndex: number, texts: string[]) => {
      if (pending) {
        queuedBatch = { startIndex, texts };
        return false;
      }
      return true;
    },

    confirm: async (speakFn: (t: string, p?: number) => Promise<any>, addToBatchFn: (texts: string[], ids: string[]) => Promise<any>, chapterId?: number) => {
      // process speak queue in order
      while (deferredSpeakQueue.length > 0) {
        const item = deferredSpeakQueue.shift()!;
        await speakFn(item.text, item.paragraphIndex);
      }
      if (queuedBatch && queuedBatch.texts.length > 0) {
        const ids = queuedBatch.texts.map((_, i) => `chapter_${chapterId ?? 'X'}_utterance_${queuedBatch!.startIndex + i}`);
        await addToBatchFn(queuedBatch.texts, ids);
        queuedBatch = null;
      }
      pending = false;
    },

    cancel: () => {
      pending = false;
      deferredSpeakQueue = [];
      queuedBatch = null;
    },

    _debugState: () => ({ pending, savedIndex, deferredSpeakQueue: [...deferredSpeakQueue], queuedBatch }),
  };
}
