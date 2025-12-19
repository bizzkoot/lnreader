# TTS: Queue Size Cache Calibration (Spec)

**Status:** Draft
**Author:** GitHub Copilot
**Date:** 2025-12-19

---

## Summary

This spec defines a small, low-risk feature to detect and correct drift in the `lastKnownQueueSize` cache used by `TTSAudioManager` to avoid excessive native bridge calls when refilling the native TTS queue.

## Motivation

We introduced a cache (`lastKnownQueueSize`) to drastically reduce `refillQueue()` calls. In rare fallback scenarios (e.g., `addToBatch` failures followed by `speakBatch`), the cache can drift from the true native queue size by several items. Excessive drift can cause either premature `onQueueEmpty` (if cache underestimates) or delayed refill (if cache overestimates).

## Goals

- Keep the `lastKnownQueueSize` in reasonable alignment with the real native queue size.
- Avoid frequent or heavy native calls; calibration should be infrequent and cheap.
- Provide dev-only telemetry and logging when drift is detected.
- Add test coverage to prevent regressions.

## Non-goals

- We will not replace the cache approach; calibration is an incremental fix.
- No changes to public API or user-facing behavior (except dev logs/toasts on repeated failure if desired).

---

## Design

Add a `calibrateQueueCache()` private method on `TTSAudioManager`:

```ts
private async calibrateQueueCache() {
  try {
    const actualSize = await TTSHighlight.getQueueSize();
    const drift = Math.abs(actualSize - this.lastKnownQueueSize);
    if (drift > 5) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn(
          `TTSAudioManager: Cache drift detected (cached=${this.lastKnownQueueSize}, actual=${actualSize}, drift=${drift})`,
        );
      }
      this.devCounters.cacheDriftDetections = (this.devCounters.cacheDriftDetections || 0) + 1;
      this.lastKnownQueueSize = actualSize;
    }
  } catch (err) {
    logError('TTSAudioManager: calibrateQueueCache failed:', err);
  }
}
```

**Threshold**: Drift threshold set to `5` items (configurable constant if needed).

**Where to call**:
- After `speakBatch()` successfully starts (initial batch) — small cost, keeps cache aligned early.
- After a successful refill (`addToBatch` success) — update cache with `+= nextBatchSize` and call calibration.
- Periodic check in `onSpeechDone`: calibrate every N spoken items (e.g., every 10) to limit native calls.

**Notes**:
- The method is defensive — it logs dev-only warnings and increments a dev counter for monitoring, but won't change normal refill behavior unless drift is severe.
- The emergency `onQueueEmpty` logic remains the safety net.

---

## Metrics & Telemetry

Add `cacheDriftDetections: number` to `devCounters` in `TTSAudioManager` to help quantify occurrences during QA and dogfood runs.

Log the following in dev builds only:
- `TTSAudioManager: Cache drift detected (cached=..., actual=..., drift=...)` (warn)

---

## Tests

Unit tests (`jest`):
- `src/services/__tests__/TTSAudioManager.cache.test.ts`:
  - Mock `TTSHighlight.getQueueSize()` to return differing values and verify `calibrateQueueCache()` updates `lastKnownQueueSize` when drift > 5.
  - Verify `devCounters.cacheDriftDetections` increments.
  - Verify no calibration when drift <= 5.

Integration / E2E:
- Run long TTS playback (100+ paragraphs) and assert no repeated queue exhaustion due to drift.
- Ensure dev logs show 0 expected drifts; if drifts are found, examine scenarios that caused fallback failures.

---

## Implementation Checklist

- [ ] Add `calibrateQueueCache()` to `TTSAudioManager`.
- [ ] Update `devCounters` to include `cacheDriftDetections`.
- [ ] Call calibration in the three integration points described above.
- [ ] Add unit tests and update refill tests to expect calibration calls in key flows.
- [ ] Run full test suite and smoke test a long TTS run locally.
- [ ] Add a small note to `docs/TTS/TTS_EDGE_CASES.md` linking to this spec.

---

## Commit Message (suggested)

```
feat(tts): add cache calibration to prevent queue size drift

- Add calibrateQueueCache() to TTSAudioManager
- Increment devCounters.cacheDriftDetections when drift > 5
- Call calibration after batch start, after successful refill, and periodically
- Add unit tests + spec in /specs/tts-cache-calibration.md
```

---

## Risks & Rollback

- Risk: Minor increase in native calls if calibration runs too frequently. Mitigation: calibration is infrequent (only after events and every ~10 paragraphs).
- Rollback: Revert commit or disable calibration calls if unexpected behavior occurs.

---

## Time Estimate

- Implementation: 30–60 minutes
- Tests: 30 minutes
- QA (manual long-run): 20–60 minutes

---

## Next Steps

1. Confirm spec and accept implementation approval.
2. Implement code and tests in a small PR, run CI.
3. Run a long-run dogfood test and monitor `cacheDriftDetections`.

---

