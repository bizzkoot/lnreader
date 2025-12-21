# Progress (Updated: 2025-12-20)

## Done

- WebView persistence fix (refs for nextChapter/prevChapter)
- Boundary display fix (correct previous chapter name from DOM)
- MMKV unread bug fix (4 DB functions delete MMKV keys)
- TTS clearing logic rewritten (original vs stitched code paths)
- DOM trim calculation fix (absolute threshold)
- Comprehensive documentation in IMPLEMENTATION_PLAN.md with wrong approaches
- Debug logs added to reveal boundary mismatch bug

## Doing

- Investigating boundary mismatch bug (paragraphs 214+ not matching boundary 1)
- Awaiting user testing with clean rebuild to get boundary debug logs

## Next

- Analyze boundary debug logs from user
- Fix boundary calculation or matching logic based on logs
- Test TTS clearing after boundaries fixed
- Test DOM trim after boundaries fixed
- Add settings UI for threshold selector
- Git commit after all fixes verified
