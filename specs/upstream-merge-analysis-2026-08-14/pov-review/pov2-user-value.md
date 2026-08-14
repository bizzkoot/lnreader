All key claims verified from the working tree (NovelScreen select-all at :277-280, useLoadingColors primary-tint at :7, Epub.cpp whitelist at :391-392 and unguarded cover at :397-398, useLibrary.ts missing try/finally at :68-75, NovelInfoHeader cover without headers at :155/:161). Findings below.

---

# USER-VALUE PRIORITIZATION — 19 upstream candidates

## (1) VALUE-RANKED TOP 10 — why users care

1. **8a12529ba — update-clear-freeze (#1955)** — Clearing Updates today runs a full-table `UPDATE Chapter SET updatedTime = NULL` on the JS thread (ChapterQueries.ts:267, verified); on any sizeable library the app visibly freezes/ANRs — a bug users hit every time they use this setting, with the worst possible symptom (frozen app). Verified live.
2. **7883b28cd — TTS stop on phone calls (#1976)** — The flagship feature keeps talking over a ringing/outgoing call today; the fork's audio-focus-only mechanism is unreliable because the TTS engine (not the app) owns the stream (lane5: TTSForegroundService has focus handling but zero TelephonyManager/PhoneStateListener). Direct conflict between the app's #1 feature and the phone's core function. ⚠️ READ_PHONE_STATE permission prompt — see section (3).
3. **91358ad3d — all EPUB image formats (#1946)** — EPUB import (a core reading path) currently only copies `image/jpeg|png|jpg` (Epub.cpp:391-392, verified); GIF/WebP/BMP/SVG books import with broken images — degraded reading experience for a large share of imported EPUBs.
4. **3ac611f63 — EPUB SVG (#1622)** — Same two-line whitelist root cause, SVG slice; SVG is common in LN covers/illustrations. Land together with #3 (one fix).
5. **197d8670f — EPUB cover-as-document (#1948)** — `meta_out.cover` is set from `id_to_href` with no media-type guard (Epub.cpp:397-398, verified) → EPUBs whose cover is a `cover.xhtml` page get a broken cover in library + novel header after import.
6. **63349de1b — select-all across batches (#1960)** — Select-all on a novel page only selects the loaded 300-row batch (NovelScreen.tsx:277-280, verified live); users on long-running series get silently partial bulk download/mark-read. Frequent for library-management power users.
7. **3bf025108 — Indonesian restore** — Fork id_ID is visibly degraded (574 vs 638 lines, English fallbacks, `"indonesia"` placeholder strings); restoring real Indonesian is a direct win for the fork's core community language.
8. **1eb8c587c — library loading-state** — `getLibrary` sets `isLoading(true)` then awaits `Promise.all` with no try/catch/finally (useLibrary.ts:68-75, verified); one DB rejection → library stuck on skeleton until app restart. Rare trigger, catastrophic symptom.
9. **15560b67b — cover headers (#1977)** — Novel-detail cover renders `{ uri }` with no plugin `imageRequestInit` headers (NovelInfoHeader.tsx:155/161, verified); sources requiring UA/auth/Cloudflare headers show a broken cover on the novel page.
10. **51560195b + e0c89cdd9 — skeleton colors (#1964)** — Kills the primary-tinted shimmer every user sees on every skeleton (useLoadingColors.ts:7, verified). Cosmetic but universal polish; two commits, one file, trivial risk.

*Next tier (didn't make top-10):* **909504a72** repo enable/disable — genuine feature for users with dead/slow plugin repos (kills repeated failed-update toasts), but invisible to non-custom-repo users; **3ad6e372f** translation corrections — real but subtle string polish across 34 locales; **13885320a** categories-adds-to-library — data-integrity edge case (non-library novel gets categories → invisible-to-user inconsistency); **3ece098b9** APK size — smaller download, no visible in-app change.

## (2) Users would NOT notice

- **57eca11a9 — library-status-nav**: pure plumbing (isLocal/inLibrary into History→Novel route); behavior only changes subtly for local novels opened from History.
- **f69e5d6a7 — translations-update (#1934)**: new keys target upstream-only features (MediaSession seekbar, background tasks, etc.); fork references none of them → dead weight, zero visible change.
- **e4246dee5 — atomic EPUB export (#1954)**: only matters if an export is interrupted mid-write; fork just stabilized this flow — hardening for a corner case.
- **909504a72 — repo enable/disable**: invisible unless the user runs custom plugin repos.
- **3ad6e372f — translation corrections**: imperceptible per-string polish for non-English users.
- **13885320a — categories adds to library**: only fires on the unusual path of setting categories on a not-yet-library novel.
- **3ece098b9 — APK size**: invisible in-app (smaller download only).

## (3) Commits that could make the app WORSE if ported carelessly

- **64707409b (RED, #1902)** — highest hazard. textRemover.js runs DOM removal inside the reader; the fork's TTS paragraph indices are derived RN-side (htmlParagraphExtractor) but core.js DOM counting/highlight/scroll-sync could desync if textRemover removes paragraph-level nodes (lane3's critical audit). WebViewReader wiring must stay surgical (config via ref, never into `memoizedHTML` deps — the exact class of bug the fork already fixed for highlight offset). New native dep `react-native-keyboard-controller` on Expo 54/Gradle 9.2.0 is unverified. SettingsReaderScreen restructure would touch the TTS settings tab. **Only a partial, audited port is safe.**
- **7883b28cd (#1976)** — READ_PHONE_STATE is a dangerous permission: runtime prompt on API 31+ (or `maxSdkVersion` workaround needed); a careless port can crash on SecurityException (no try/catch), leak the listener (no onDestroy unregister), or stop TTS on spurious events. Port correctly and it's fine; port sloppily and it's a new prompt + crash surface in the flagship feature.
- **3ece098b9 (APK size, #1969)** — R8/shrinking on the release build can strip TTS/plugin classes used via reflection → runtime crashes; the 12 import hunks land in fork-modified reader files (useChapter, LibraryScreen); package.json changes risk dep conflicts.
- **3ad6e372f / 3bf025108 / f69e5d6a7 (translations)** — wholesale file overwrites would clobber fork-only keys (`readerScreen.bottomSheet.tts.*`, `skipVersion`, `chapterChapnum`, `exportEpubModal.*`) → missing labels in the TTS/EPUB UI. Per-key merge is mandatory.
- **909504a72 (#1628)** — migration 005 numbering collides with pending Batch D migrations (duplicate-version crash in MigrationRunner); expo-sqlite 0/1→boolean coercion bugs; shared Switch/ConfirmationDialog prop additions ripple into TTS settings screens; disabling a repo silently stops its plugin updates (users may read it as "updates broke").
- **e4246dee5 (atomic export)** — SAF `content://` destinations may not support atomic rename; without filesystem+SAF testing it could regress the just-fixed export flow.

## Net takeaway

Highest user value per unit of risk: **8a12529ba, the EPUB whitelist/cover pair (91358ad3d+3ac611f63+197d8670f), 63349de1b, 3bf025108, 1eb8c587c, 15560b67b, skeleton-colors** — all verified live bugs or direct user-facing wins, all small surgical ports. **7883b28cd** is top-value but must be a careful native port (permission policy first). **64707409b is the only candidate I'd actively discourage as-is** — the rest are safe or make-worse only through careless implementation.

---

## Acceptance report