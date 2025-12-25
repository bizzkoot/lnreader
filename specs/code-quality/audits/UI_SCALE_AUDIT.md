# UI Scale Audit

**Date:** 2025-12-23  
**Scope:** UI scale feature, layout correctness, accessibility implications (v2.0.12-era)

## Relevant files

- UI scale specs:
  - [specs/UI-Scale/AUDIT_REPORT.md](../../UI-Scale/AUDIT_REPORT.md)
- Theme/layout scaling helpers (search targets):
  - `uiScale`, `scaleDimension`, `useUIScale`

## Findings

## 1) UI scale needs accessibility boundaries and per-surface tuning

**Severity:** ⚠️ MAJOR

**Evidence**

- Feature exists and was audited in:
  - [specs/UI-Scale/AUDIT_REPORT.md](../../UI-Scale/AUDIT_REPORT.md)

**Why**

A single global scalar can:
- cause text truncation in dense components (chips, rows)
- break hit targets if scaling down
- create reflow issues in modals/bottom sheets and reader toolbars

**Fix**

- Clamp UI scale to a safe range (e.g., 0.9–1.3) unless user explicitly unlocks “advanced”.
- Differentiate typography scaling vs spacing scaling:
  - Let font size follow system accessibility (Dynamic Type / Android font scale)
  - Apply UI scale mostly to spacing and icon sizes

---

## 2) Persisted UI scale should not bypass OS font scale expectations

**Severity:** 🔧 MINOR

**Why**

Users who increase Android font scale / iOS Dynamic Type expect UI to respect system settings.

**Fix**

- Verify which surfaces use `allowFontScaling` and ensure it isn’t globally disabled.
- Provide a settings hint: “UI Scale affects spacing/icons; text uses system scale (recommended).”

---

## 3) Add visual regression checks for scaled layouts

**Severity:** 🔧 MINOR

**Fix**

- Create a minimal “settings preview” screen or Storybook-like snapshots for:
  - 0.9x, 1.0x, 1.2x, 1.3x
- Manual QA checklist:
  - onboarding, reader toolbar, TTS bottom sheet, library list

## Suggested Tests

- Unit test: `scaleDimension` clamps properly.
- Screenshot tests (if you have infra) for key screens at extremes.
