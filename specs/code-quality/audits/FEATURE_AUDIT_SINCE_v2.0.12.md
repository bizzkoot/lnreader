# LNReader Feature Audit (Since v2.0.12)

**Date:** 2025-12-23  
**Scope:** All features added on/after tag `v2.0.12` (including “v2.0.12-era” additions)  
**App Type:** Consumer Android mobile reader (React Native + WebView + native Android TTS)  

## Standards / References (verified)

- React: Effect dependency rules, cleanup symmetry, and avoiding unnecessary dependencies  
  https://react.dev/reference/react/useEffect
- React Native: Performance overview (JS thread FPS sensitivity, console logging cost)  
  https://reactnative.dev/docs/performance
- React Native: Security overview (storage of sensitive info, general security posture)  
  https://reactnative.dev/docs/security
- Android: Notifications overview (channels, importance, action behaviors)  
  https://developer.android.com/develop/ui/views/notifications
- AndroidX Media: `NotificationCompat.MediaStyle` (compact view supports up to 3 visible actions)  
  https://developer.android.com/reference/androidx/media/app/NotificationCompat.MediaStyle

## Feature Inventory (detected from `v2.0.12..HEAD`)

From git history and changed files:

- Continuous scrolling with DOM stitching/trim + thresholds
- EPUB TTS synchronization (chapter title tracking, paragraph 0 alignment)
- Per-novel TTS settings
- Backup updates: auto backups, restore UX fixes, separate auto/manual naming + pruning, restore exclusions
- v2.0.12-era additions (included by request): unified progress tracking, UI scale, enhanced media notification, WebView security hardening

See the individual audit files in this folder for deep dives:

- [Continuous scrolling audit](CONTINUOUS_SCROLL_AUDIT.md)
- [TTS features audit](TTS_FEATURES_AUDIT.md)
- [Backup system audit](BACKUP_AUDIT.md)
- [UI scale audit](UI_SCALE_AUDIT.md)
- [WebView security hardening audit](WEBVIEW_SECURITY_AUDIT.md)

## Triage Summary

### ✅ P0 Completed (2025-12-23)

- ✅ **Backup restore integrity**: Versioned schema (v2) + typed validation + device-key exclusion ([BACKUP_AUDIT.md](BACKUP_AUDIT.md))
  - Implemented manifest with `backupVersion`, migration pipeline, typed MMKV entries
  - Device-specific keys (LAST_AUTO_BACKUP_TIME, LOCAL_BACKUP_FOLDER_URI) excluded from restore
  - 25 regression tests passing

- ✅ **WebView progress safety**: ChapterId validation already implemented ([WebViewReader.tsx:583-596](../../src/screens/reader/components/WebViewReader.tsx#L583-L596))
  - Rejects saves without chapterId or with mismatched chapterId
  - No changes needed - audit written before fix was in place

- ✅ **Per-novel TTS settings**: Current behavior acceptable
  - Local EPUB ID instability accepted as low-priority tradeoff
  - TTS settings (voice/pitch/rate) not critical enough for complex stable ID implementation
  - Safety check `typeof novelId !== 'number'` already exists

### P0 (Fix next)

- Auto-backup timestamps should reflect success, not attempted schedule (⏳ Partial - timestamp updates after enqueue, needs on-success callback)
- ~~Continuous scrolling: enforce `chapterId` presence on save events when stitched DOM is active~~ ✅ Already enforced

### P1

- Per-novel TTS: resolve “stable ID” for local EPUB / non-DB novels (disable toggle or implement local key namespace)
- Remove production `console.*` from hot paths; optionally adopt remove-console build plugin
- Avoid double JSON parsing of WebView messages on hot path

### P2

- Improve threshold setting UX and default reset affordances
- Replace boolean-heavy TTS queue logic with explicit state enum (reduce regression risk)

## Health Score (delta since v2.0.12)

**Score:** 7.8 / 10 (+0.6 after backup fix)  
**Why:** High feature velocity and strong engineering discipline in tests/specs. Main risks now are (1) cross-layer state sync between WebView/RN/native and (2) auto-backup success timing. Backup restore integrity significantly improved with versioned schema.
