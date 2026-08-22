# Upstream Merge Analysis - 2026-08-14

## Summary

- **Target**: `upstream/master` @ `990cd4f2e` (2026-08-11, PR #1972). NOTE: `upstream/main` is a **stale 2024 branch** (v1.1.19 era, HEAD 2024-07-13) — NOT a merge target.
- **Last sync**: `c3260e8e0` (2026-08-01) — batches A/B/C already ported.
- **New upstream commits since last sync**: **32** (2026-08-03 → 2026-08-11).
- **Method**: 5 parallel read-only reviewer subagents (thematic lanes), main-agent spot-verification of top claims (all confirmed).
- **Result**: **7 PORT (GREEN)** + **11 PORT-with-care (YELLOW)** + **14 SKIP**. 1 RED decision (custom-code feature) + 1 security-sensitive decision (TTS phone-call stop).

## Lane Reports

- `lane1-db-queries.md` — 10 DB/Queries/Updates commits
- `lane2-screen-ui.md` — 8 Library/Novel/Screen/Stats/APK commits
- `lane3-custom-code.md` — 1 commit: Custom Code Settings Page V2 (#1902)
- `lane4-repo-controls.md` — 1 commit: Repository Enable/Disable (#1628)
- `lane5-native-infra.md` — 12 native/EPUB/TTS/translation/docs commits

## Verified Live Bugs in Fork (from upstream fixes)

| Upstream fix | Fork bug (verified) |
|---|---|
| 63349de1b (#1960) | `NovelScreen.tsx:277-280` select-all only selects currently loaded batch (300), not all chapters |
| 8a12529ba (#1955) | `ChapterQueries.ts:267` `clearUpdates` = full-table `UPDATE Chapter SET updatedTime = NULL` → UI freeze |
| 3ac611f63/91358ad3d (#1622/#1946) | `shared/Epub.cpp` whitelists only jpeg/png/jpg → SVG/GIF/WebP images lost on EPUB import |
| 197d8670f (#1948) | `shared/Epub.cpp` cover resolution ignores media-type → cover.xhtml document breaks cover image |
| 7883b28cd (#1976) | `TTSForegroundService.kt` relies only on audio-focus; no PhoneStateListener (outgoing calls unhandled) |
| 1eb8c587c | `useLibrary.ts` `getLibrary` has no try/catch/finally → skeleton stuck on error |
| 15560b67b (#1977) | `NovelInfoHeader.tsx` doesn't forward plugin `imageRequestInit` headers to cover image |
| 51560195b/e0c89cdd9 (#1964) | `useLoadingColors.ts` still primary-tinted (upstream softened/neutralized) |

## Merge Plan

### PORT (GREEN — safe manual ports)

| hash | title | notes |
|---|---|---|
| 63349de1b | Select All Chapters Across Lazy-Loaded Batches (#1960) | NovelScreen select-all → `getNovelChapters`; check useDownload chunking |
| 13885320a | Add Novels To Library When Setting Categories (#1945) | NovelQueries `inLibrary=1`; keep tx-discipline |
| 15560b67b | Pass Plugin imageRequestInit Headers (#1977) | NovelInfoHeader source headers |
| 51560195b + e0c89cdd9 | Soften/Neutralize Skeleton Colors (#1964) | useLoadingColors values (take post-e0c89cdd9) |
| 3ad6e372f | Correct Translation Strings Across Locales | per-key merge (protect fork keys) |
| 3bf025108 | Restore Indonesian Translations | full-file + fork-key merge (fork id_ID visibly degraded) |

### PORT-with-care (YELLOW — merge with validation)

| hash | title | risk / notes |
|---|---|---|
| 8a12529ba | Prevent Update Clearing From Freezing App (#1955) | MED — SettingsAdvancedScreen has **DoH section**; surgical |
| 57eca11a9 | Pass Library Status Through Novel Navigation | LOW — History/Updates plumbing (fork types already half-ready) |
| 1eb8c587c | Prevent Library From Remaining in Loading State | LOW-MED — useLibrary try/finally |
| 3ece098b9 | Optimize APK Size (#1969) | MED — selective only: lottie dead deps + gradle shrink eval |
| 909504a72 | Repository Enable/Disable (#1628) | LOW-MED — new migration 005 + RepositoryQueries + RepositoryCard |
| 7883b28cd | Stop TTS During Phone Calls (#1976) | **HIGH value, SECURITY decision** — READ_PHONE_STATE; TTSForegroundService |
| 3ac611f63 + 91358ad3d | EPUB image format support | LOW — shared/Epub.cpp whitelist expansion |
| 197d8670f | EPUB cover document imports | LOW-MED — shared/Epub.cpp cover media-type guard |
| e4246dee5 | Atomic EPUB export (optional hardening) | LOW — defer; fork just stabilized export flow |
| f69e5d6a7 | Update Translations (#1934) | subset by referenced keys only |
| 64707409b | Custom Code Settings Page V2 (#1902) | **RED wholesale / PARTIAL** — see decision below |

### SKIP (14)

| hash | reason |
|---|---|
| 179feb56e | Already have — no 1000-row limit in fork queries |
| 675f19ef9 | Limit-half already satisfied; reactive half verify |
| 23f9b183b | Already refresh on focus (provider-level) |
| b9d1abcf2 | SQL triggers already maintain download counts |
| 586e08514 | Migration crash resilience already in fork MigrationRunner |
| a727c229c | Drizzle migration; concept noted for future 005 |
| 67e01bc2d | Stats files missing in fork (Batch D reference) |
| c6679b7f4 | Edge-to-edge already native in MainActivity |
| 084dcccab | Drawer read color already matches ChapterItem (verify) |
| 990cd4f2e | WorkManager — fork uses background-actions |
| c3482a851 | Nitro jest alias — N/A |
| c3b75ebeb | Plugin bundles already in reliable storage |
| 7f1f76408 | AGENTS.md — fork has own |
| — (none) | |

## Cross-Cutting Protections

- **Zero commits** touch: TTS pipeline (WebViewReader/htmlParagraphExtractor/useTTSController/TTSState/novelTtsSettings), DoH native, per-novel settings, UI scaling.
- **Surgical-only**: SettingsAdvancedScreen (DoH block), useSettings.ts (additive keys only), ConfirmationDialog (fork C-7 styles), Switch.tsx (backward-compat props only).
- **New migrations**: 909504a72 needs `005_add_repository_enabled.ts` (coordinate with Batch D pending migrations — claim 005 now).
- **Tests**: 80 suites / 1304 tests baseline; run full gates after each batch (type-check, lint, format, test, TTS wake-cycle + refill).

## Next Steps

1. User decision on 64707409b (custom code page) + 7883b28cd (phone-call TTS / READ_PHONE_STATE permission).
2. Execute GREEN batch on a merge branch (`merge/upstream-sync-2026-08-14`), validating after each item.
3. Execute YELLOW batch with per-item validation.
4. Update `.agents/upstream-merge-memory.md` + port any remaining decisions.
