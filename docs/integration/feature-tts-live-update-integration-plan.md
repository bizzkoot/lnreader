# Integration plan — feature/tts-live-update

Author: automated review (local)
Branch reviewed: origin/feature/tts-live-update (commit 016043d0)
Base branch (local): dev

Summary

- The feature/tts-live-update branch adds live TTS settings updates to the Reader.
- Key changes: WebViewReader runtime behavior, MMKV-based live update listeners, new helper (ttsBridge), improved Settings UI UX, tests, small tooling/scripts, and TS config updates.

Changed files (high level)

- Major runtime changes:
  - src/screens/reader/components/WebViewReader.tsx — large, cross-cutting changes to TTS flow, background handling, screen wake sync, and cross-chapter events.
- Medium risk / UI changes:
  - src/screens/settings/SettingsReaderScreen/tabs/AccessibilityTab.tsx — slider UX, local state, now relies on persisted settings for live updates.
- Low risk / dev tooling / tests / types:
  - src/utils/ttsBridge.ts (new helper)
  - src/types/global.d.ts (global window typing)
  - src/screens/reader/components/**tests**/WebViewReader.applyTtsUpdate.test.tsx
  - src/utils/**tests**/ttsBridge.test.ts
  - scripts/\* (helpers for tests)
  - README.md / RELEASE_NOTES.md updates
  - tsconfig.json and package.json tweaks (test tooling/types)

Classification — safe to pull vs high-risk

Safe/low-risk to cherry-pick first

- Documentation updates: README.md, RELEASE_NOTES.md.
- New dev scripts: scripts/install-jest-types.sh, scripts/run-tts-live-tests.sh.
- Types and tests: src/types/global.d.ts, tests added under src/utils and src/screens/reader/components (these may require test dependency install but are non-runtime changes).
- Utility helper: src/utils/ttsBridge.ts — small, well-contained helper; safe to add.
- tsconfig.json and devDependencies changes that only affect the dev/test environment (carefully; ensure local CI/test pipeline compatibility).

Medium risk (needs review & CI verification)

- Settings UI (AccessibilityTab.tsx) — primarily UI/UX behavior and persisted-settings changes: pulls should be followed by unit tests and manual state/UX checks.

High risk — do NOT merge directly without thorough testing and staged integration

- WebViewReader.tsx — major TTS orchestration logic. This file changes complex areas:
  - background TTS queue handling, onQueueEmpty navigation to next chapter
  - AppState (screen wake) sync behavior
  - Stale event rejection via chapter IDs, grace periods, and save semantics
  - Cross-chapter safe-injection logic and further JS injection into WebView
  - Immediate effects on native TTS behaviour via TTSHighlight bindings

Why this is high risk

- WebViewReader handles timing, native interop, and UI synchronization — small regressions can silently break TTS behavior, create incorrect saves, or scroll users to the wrong paragraph.
- The code touches race conditions (AppState, background vs foreground), native TTS services, and events arriving with stale IDs — these require device/OS tests across Android/iOS and different OS versions.

Integration strategy (step-by-step)

Phase A — Preparation (local non-destructive)

1. Create a safe integration branch off `dev`:
   - git checkout dev && git pull && git checkout -b integration/tts-live-update-review
2. Ensure CI/test environment matches the feature branch devDependencies (install dependencies locally, e.g., pnpm install). Use a reproducible environment: node >= 20.
3. Run linters and type-check: pnpm run lint, pnpm run type-check.
4. Run unit tests: pnpm run test. Add any missing devDeps required by new tests before continuing.

Phase B — Pull low-risk changes first (quick wins)

1. Cherry-pick the docs and scripts commits (README, RELEASE_NOTES, scripts/\*).
2. Add types (`src/types/global.d.ts`), `src/utils/ttsBridge.ts`, tsconfig updates and tests. Run unit tests and fix any broken test harness issues.
3. Confirm CI passes for the above changes.

Checkpoint: All tests and lint pass. Push integration branch and run CI.

Phase C — UI integration & verification (medium risk)

1. Merge AccessibilityTab.tsx changes next (single commit) — this is mainly UX and persisted-settings changes.
2. Update or add unit tests covering the new UI behavior and settings persistence.
3. Manually validate on a device/emulator (Android & iOS) the settings slider UX and confirm changes are persisted and visible in MMKV.

Checkpoint: UI verified and tests pass.

Phase D — WebViewReader / runtime integration (high risk, staged)
Note: treat this phase as the most sensitive. Prepare a dedicated feature branch and allocate device testing time.

1. Create a branch from the integration branch: `integration/tts-live-update-webview`.
2. Merge the WebViewReader changes into that branch (do NOT merge to dev directly).
3. Resolve any duplication or conflicting helper functions (e.g., applyTtsUpdateToWebView present in both WebViewReader.tsx and src/screens/reader/components/ttsHelpers.ts) — choose a single canonical implementation and import it.
4. Add comprehensive unit tests and mocks for TTSHighlight events. Where possible, add test harness for native messaging handlers using jest mocks.
5. Run full test suite and local smoke tests.

Manual QA matrix (must pass before merging to dev):

- Devices: Android API 26, 29, 31, 33+ and iOS 16, 17.
- Scenarios:
  - Background playback: start TTS → screen off → confirm onQueueEmpty navigates next chapter when configured.
  - Screen wake: during background playback, wake screen → confirm WebView sync behaviour and no stale scrolls.
  - Rapid chapter changes: trigger rapid navigation while TTS events are arriving → confirm no progress corruption.
  - Save events: validate that saves with missing or stale chapterId are ignored during the grace period.
  - Voice selection and live updates: change voice, rate, pitch — confirm WebView receives updates and TTS playback uses new settings on next utterance.
  - Resume logic: confirm resume behavior does not skip paragraphs.

Edge cases & safety nets

- Add runtime checks/logging guarded by **DEV** or feature-flag so we can enable/disable new behavior quickly in prod if regressions are observed.
- Add stricter event validation and centralize save/progress semantics.
- Ensure TTSHighlight native module API remains backward compatible — add native smoke tests (Android) for preferred voice fallback.

Rollout & monitoring

1. After passing QA, merge integration branch to dev (not master) and run CI.
2. Create a canary/testflight build and deploy to internal testers.
3. Monitor error reporting (Sentry/Crashlytics), logs for TTS flow regressions, and manual feedback from testers.
4. If any severe regression, revert the WebViewReader changes (git revert) and push a fix branch.

Developer notes

- Watch for duplicate helper implementations (applyTtsUpdateToWebView exists in file body and ttsHelpers). Consolidate before final merge.
- Node/env differences: package.json/tsconfig updates adjust dev toolchain. Verify node and pnpm versions in CI.

Acceptance Criteria before merge to dev

- All unit tests pass, linting and type-check pass.
- Manual QA signoff in matrix scenarios above (Android & iOS).
- No console errors for TTS event flows in typical usage.
- Clear doc/RELEASE_NOTES entry explaining behaviour and any new required platform permissions.

If you want, I can now export a short checklist or open PR draft with suggested cherry-picks. Stopping here per instruction.
