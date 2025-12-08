/**
 * Helper utilities for TTS wake/resume behavior tests.
 */
function computeInitialIndex(dbIndex, mmkvIndex, ttsStateIndex) {
  const d = typeof dbIndex === 'number' ? dbIndex : -1;
  const m = typeof mmkvIndex === 'number' ? mmkvIndex : -1;
  const t = typeof ttsStateIndex === 'number' ? ttsStateIndex : -1;
  return Math.max(d, m, t, -1);
}

function buildBatch(paragraphs, startIndex) {
  if (!Array.isArray(paragraphs)) {
    throw new Error('paragraphs must be an array');
  }
  const idx = Math.max(0, typeof startIndex === 'number' ? startIndex : 0);
  const textsToSpeak = paragraphs.slice(idx);
  const utteranceIds = textsToSpeak.map(
    (_, i) => `chapter_XXX_utterance_${idx + i}`,
  );
  return { startIndex: idx, textsToSpeak, utteranceIds };
}

function shouldIgnoreSaveEvent({
  timeSinceTransition = Number.POSITIVE_INFINITY,
  eventChapterId,
  currentChapterId,
  incomingIdx = -1,
  currentIdx = -1,
  latestIdx = -1,
  graceMs = 1000,
}) {
  if (eventChapterId !== undefined && eventChapterId !== currentChapterId) {
    return true;
  }

  if (timeSinceTransition < graceMs) {
    if (eventChapterId === undefined) return true;

    if (typeof incomingIdx === 'number' && incomingIdx >= 0) {
      if (latestIdx >= 0 && incomingIdx < latestIdx) return true;
      if (incomingIdx === 0 && Math.max(currentIdx, latestIdx) > 0) return true;
    }
  }

  return false;
}

module.exports = {
  computeInitialIndex,
  buildBatch,
  shouldIgnoreSaveEvent,
};
