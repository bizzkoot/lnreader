# Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-03 | Use native TTS queue-empty event and RN-driven chapter continuation; include `paragraphIndex` in `speak()` and use `utterance_<index>` IDs | WebView JS is suspended when the device sleeps/when screen is off; relying on WebView for chapter-transition and queue refills breaks background TTS. Native detection of an empty queue allows RN to prefetch and continue playback without JS execution. |
| 2025-12-03 | Extract paragraphs from HTML in React Native (htmlParagraphExtractor.ts) instead of relying on WebView DOM | When navigating to next chapter during background TTS (screen off), WebView doesn't execute JS. By extracting paragraphs directly from HTML in RN using regex-based parsing, we can start TTS batch playback without waiting for WebView initialization. |
| 2025-12-03 | Add backgroundTTSPendingRef flag to coordinate chapter transitions | When onQueueEmpty fires and we navigate to next chapter, we set this flag. When the new chapter's HTML loads (effect on chapter.id + html), if flag is set, we start TTS directly from RN. This decouples TTS continuation from WebView lifecycle. |
| 2025-12-03 | Reset currentParagraphIndexRef to 0 on chapter change | Prevents stale paragraph indices from old chapter being used for highlighting in new chapter. Combined with bounds checking in core.js highlightParagraph(), this prevents "index out of bounds" errors during chapter transitions. |
