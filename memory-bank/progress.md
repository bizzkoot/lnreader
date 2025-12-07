# Progress (Updated: 2025-12-05)

## Done

- Fixed TTS bugs: wrong lines after wake + premature chapter jump (race conditions)

## Doing
 - Cross-chapter progress sync fixes: ensure prior chapters marked completed and future chapters reset to unread (DB changes + selector + UI flow)
 - TTS resume UI: added conflicting-chapters list, limited to 3 with overflow warning; unified selection handler for Start/Resume flows
- Committing TTS bug fixes
## Doing

- Run unit tests + device verification
## Next
## Next

- Monitor telemetry for cross-chapter progress cases; add targeted unit tests for ChapterQueries behavior
- Build and test on device
