# Upstream Merge Analysis — 2026-08

**Status**: 📋 PLANNED (analysis only — NO code changes made yet)
**Date**: 2026-08-03
**Upstream analyzed**: `original` branch (= upstream/master @ `c3260e8e0`, 2026-08-01)
**Fork analyzed**: `dev` branch (HEAD `40c667679` v2.1.3, 2026-08-03)
**Merge base**: `467a97dcf` (2025-12-24)

---

## What this folder contains

| File | Purpose |
|---|---|
| `README.md` | This index + executive summary |
| `analysis.md` | Full synthesis report: the 3 architecture walls, tiers, per-commit classification rationale, skip list |
| `commit-manifest.csv` | Machine-readable classification of **all 170 upstream commits** (action, batch, value, risk, port, fork-overlap files, notes) |
| `batches/PRD-A-safety-fixes.md` | Batch A: 27 verified bug fixes (15 Tier-1 + 5 SQL + 7 extended) |
| `batches/PRD-B-high-value-features.md` | Batch B: 7 high-value features (+ 15 stretch) |
| `batches/PRD-C-ux-theme-train.md` | Batch C: theme refactor → dynamic colors → M3 components |
| `batches/PRD-D-project-scale-features.md` | Batch D: project-scale rewrites (time tracking, search, stats, perf) |
| `reference/upstream_commits_170.txt` | Raw commit list (hash\|author\|date\|subject) |
| `reference/commit_overlap_170.txt` | Per-commit fork-overlap files |
| `reference/fork_context.md` | Fork architecture context given to analysis agents |
| `reference/subagent/group1-4-report.md` | Full per-commit assessments from the 4 analysis agents |

## Executive summary

- **170 upstream commits analyzed**; **76 are worth porting** (in some form), **94 skipped**.
- Full merge remains **infeasible** (confirmed again): three hard architecture walls separate the repos (Drizzle/op-sqlite vs raw SQL; Nitro/WorkManager vs custom Kotlin + background-actions; Expo-managed/rock vs bare Expo 54/Gradle 9.2.0).
- The recommended strategy stays **selective cherry-pick / manual port** (per `.agents/upstream-merge-memory.md` 2025-12-30).
- **Highest-value insight**: the fork often carries the *byte-identical pre-fix code* that upstream just fixed — the fork has the same live bugs. Batch A is therefore almost pure risk-reduction with verified low conflict surface.
- **2026-08-04 update**: independent 4-subagent review applied corrections (see `REVIEW-2026-08-04.md`) — `0cb9da9027` reclassified to PORT-A2 (pre-Drizzle tx fix), 5 DIRECT labels → MANUAL, `9783c4d5e3` → PORT-A1, `c3c891cea0` relabeled SKIP-INFRA.

## Suggested execution order

1. **Batch A — Safety fixes** (half-day): 29 verified bug fixes → run `pnpm run test` + TTS wake-cycle tests.
2. **Batch B — High-value features** (2–3 days): Kitsu tracker, ignorable update notifications, EPUB chapter numbers, parallel library updates, first-unread FAB, jump-to-chapter fix, download cooldown.
3. **Batch C — UX/theme train**: theme refactor → dynamic Material You colors → M3 slider/tabs/menu.
4. **Batch D — Project-scale** (separate PRs): time tracking, in-chapter search, stats overhaul, reader perf sprint.
5. **Continuous**: re-scan `original` every 2–4 weeks for new fixes in pre-fix-era code patterns.

## Preconditions before implementation

- ⚠️ `dev` branch is currently **unpushed** (TTS text-cleanup work, per AGENTS.md). Commit/push current state before starting Batch A.
- Each PRD lists its own testing gates (`pnpm run type-check`, `lint`, `format`, `test`, TTS wake-cycle/refill suites).

## Legend (manifest columns)

- **action**: `PORT` (recommend porting) | `SKIP` (do not port)
- **batch**: A1/A2/A3 (safety), B/B-stretch, C/C-optional, D/D-stretch/D-optional, or SKIP-* category
- **value**: HIGH / MEDIUM / LOW / NONE — user-facing benefit to the fork
- **risk**: GREEN (new files / untouched files) / YELLOW (localized overlap) / RED (fork-critical files or upstream-only infra)
- **port**: DIRECT (cherry-pick) / MANUAL (adapt) / MANUAL-rewrite (reimplement on fork architecture) / NOT-FEASIBLE
