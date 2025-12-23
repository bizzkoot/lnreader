# Backup & Restore Audit

**Date:** 2025-12-23  
**Scope:** Automatic backups, manual backups, restore flow, onboarding restore side effects  
**Status:** ✅ **IMPLEMENTED** - Versioned Schema + Migration Pipeline  

## Relevant files

- Backup utilities:
  - [src/services/backup/utils.ts](../../../src/services/backup/utils.ts)
- Local backup create/restore/share:
  - [src/services/backup/local/index.ts](../../../src/services/backup/local/index.ts)
- Autobackup scheduling:
  - [src/hooks/persisted/useAutoBackup.ts](../../../src/hooks/persisted/useAutoBackup.ts)
- Onboarding restore entry:
  - [src/screens/onboarding/OnboardingScreen.tsx](../../../src/screens/onboarding/OnboardingScreen.tsx)
- Tests:
  - [src/services/backup/__tests__/backupSchema.test.ts](../../../src/services/backup/__tests__/backupSchema.test.ts)

## Implementation Summary (2025-12-23)

### What Was Implemented

**Versioned Backup Schema (v2)**
- `BACKUP_SCHEMA_VERSION = 2` with explicit manifest
- Manifest includes: `backupVersion`, `appVersion`, `platform`, `createdAt`
- Typed MMKV entries: `{ t: 's'|'n'|'b'|'o', v: value }`
- Backward-compatible detection: no manifest = v1 legacy

**Migration Pipeline**
- `detectBackupVersion(parsed)`: Detects v1 vs v2 from structure
- `migrateBackup(data, fromVersion)`: Handles v1 → v2 conversion
- Future-ready for v2 → v3 paths

**Robust Restore**
- `validateAndRestoreMMKVEntries()`: Type-checked restore with exclusions
- Device-specific key exclusion enforced via `getExcludedMMKVKeys()`:
  - `LAST_AUTO_BACKUP_TIME`
  - `LOCAL_BACKUP_FOLDER_URI`
  - ServiceManager keys
  - Tracker migration keys
- Unknown types silently skipped (no crashes)
- Invalid values rejected (type mismatches)

**Backward Compatibility**
- v1 (legacy) backups still restore correctly
- v2 backups include both new format + legacy files
- Restore auto-detects version and applies appropriate logic

**Test Coverage**
- 25 regression tests added
- All device-specific keys verified excluded
- Type validation coverage
- Legacy backup compatibility verified

### Example v2 Backup Structure

```json
{
  "manifest": {
    "backupVersion": 2,
    "appVersion": "2.0.13",
    "platform": "android",
    "createdAt": "2025-12-23T10:30:00Z"
  },
  "sections": {
    "mmkv": {
      "entries": {
        "user.theme": { "t": "s", "v": "dark" },
        "reader.fontSize": { "t": "n", "v": 16 },
        "auto.backup.enabled": { "t": "b", "v": true },
        "settings": { "t": "o", "v": { "key": "value" } }
      }
    }
  }
}
```

### Files Modified

| File | Changes |
|------|---------|
| [utils.ts](../../../src/services/backup/utils.ts) | Schema types, migration, typed MMKV backup/restore, exclusion list as function |
| [strings/languages/en/strings.json](../../../strings/languages/en/strings.json) | Added `manifestFileWriteFailed`, `sectionsFileWriteFailed` |
| [strings/types/index.ts](../../../strings/types/index.ts) | Added translation type definitions |
| [backupSchema.test.ts](../../../src/services/backup/__tests__/backupSchema.test.ts) | New test suite (25 tests, all passing) |

### Verification

```bash
# Type check
pnpm run type-check  # ✅ PASS

# Lint
pnpm run lint  # ✅ PASS (0 errors, 23 pre-existing warnings)

# Tests
pnpm test src/services/backup/__tests__/backupSchema.test.ts  # ✅ 25/25 tests pass
```

---

## Findings (Historical + Status)

### 1) ✅ FIXED: Restore can reintroduce device-specific keys

**Severity:** 🚨 CRITICAL  
**Status:** ✅ **RESOLVED** (2025-12-23)

**Fix Implemented:**
- Device-specific keys enforced via `getExcludedMMKVKeys()`
- Excluded keys never applied during restore (both v1 and v2)
- Regression tests ensure keys like `LAST_AUTO_BACKUP_TIME` and `LOCAL_BACKUP_FOLDER_URI` never restore

**Test Coverage:**
- `should skip excluded keys (LAST_AUTO_BACKUP_TIME)`
- `should skip excluded keys (LOCAL_BACKUP_FOLDER_URI)`
- `should never restore LAST_AUTO_BACKUP_TIME even if present in backup`
- `should never restore LOCAL_BACKUP_FOLDER_URI even if present in backup`
- `should exclude all device-specific keys`

---

### 2) ✅ FIXED: Restore should validate schema/version and unknown keys

**Severity:** ⚠️ MAJOR  
**Status:** ✅ **RESOLVED** (2025-12-23)

**Fix Implemented:**
- Backup v2 includes explicit manifest with `backupVersion`
- Type-safe MMKV entries with explicit type markers
- Unknown types silently skipped (logged but not applied)
- Type mismatches rejected (e.g., string value for number type)
- Migration pipeline handles v1 → v2 conversion automatically

**Test Coverage:**
- `should detect v2 backup with manifest`
- `should detect v1 legacy backup without manifest`
- `should migrate v1 to v2 structure`
- `should restore valid string/number/boolean/object entries`
- `should skip invalid entries (wrong type)`
- `should skip entries with missing properties`
- `should skip entries with unknown type`

---

### 3) ✅ FIXED: "Success toast" for share flow

**Severity:** 🔧 MINOR  
**Status:** ✅ **RESOLVED** (Previously)

**Fix:** Success toast only shown for confirmed folder writes, not share dialog.

---

### 4) ⏳ PARTIAL: Autobackup timestamp on success only

**Severity:** ⚠️ MAJOR  
**Status:** ⏳ **PARTIAL** (2025-12-23 previous run)

**What Was Done:**
- `LAST_AUTO_BACKUP_TIME` updates after backup task enqueue succeeds
- Still needs true "on-success" callback after file write completes

**Next Step:**
- Add callback from `createBackup` to confirm file write success before updating timestamp

---

## Summary

### ✅ Completed (2025-12-23)
- Versioned backup schema (v2)
- Migration pipeline (v1 → v2, future-ready)
- Typed MMKV restore with validation
- Device-specific key exclusion enforced
- 25 regression tests (all passing)
- Backward compatibility maintained

### ⏳ Remaining
- Auto-backup success callback timing (minor improvement)

### Impact
- **Security**: Prevents device-specific key restoration (auto-backup trigger, folder URIs)
- **Reliability**: Type-safe restore, unknown/invalid entries handled gracefully
- **Maintainability**: Explicit schema, easy to add v3 features
- **Backward Compatibility**: Existing v1 backups still work
