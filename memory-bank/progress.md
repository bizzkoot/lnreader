# Progress (Updated: 2025-12-23)

## Done

- Audited feature set since v2.0.12 (and v2.0.12-era additions): continuous scrolling, EPUB TTS sync, per-novel TTS settings, backups, unified progress, UI scale, media notification, WebView security.
- Created audit pack markdowns in specs/code-quality/audits/ (index + per-feature deep dives) and added FIX_PLAN_CHECKLIST.md.
- Ran checks: `pnpm run type-check` passes; `pnpm run lint` reports warnings only (no errors).

## Doing

- Reducing highest-risk eslint warnings (hooks deps / ref cleanup) in reader/TTS surfaces.

## Next

- Decide P0 implementation path for per-novel TTS identity for local EPUBs.
- Convert remaining eslint warnings to fixes where safe (avoid overfitting deps arrays; prefer stabilizing style objects/handlers).
