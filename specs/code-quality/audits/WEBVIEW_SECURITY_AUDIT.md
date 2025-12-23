# WebView Security Audit

**Date:** 2025-12-23  
**Scope:** Reader WebView hardening work (nonce validation, URL allowlisting, message parsing, rate limiting)

## Relevant files

- Security helpers + tests:
  - [src/utils/webviewSecurity.ts](../../../src/utils/webviewSecurity.ts)
  - [src/utils/__tests__/webviewSecurity.test.ts](../../../src/utils/__tests__/webviewSecurity.test.ts)
- WebView integration:
  - [src/screens/reader/components/WebViewReader.tsx](../../../src/screens/reader/components/WebViewReader.tsx)

## Standards (verified)

- OWASP Mobile Top 10:
  - https://owasp.org/www-project-mobile-top-10/
- OWASP XSS prevention cheat sheet (for any HTML injection concerns):
  - https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- React Native WebView docs:
  - https://github.com/react-native-webview/react-native-webview/blob/master/docs/Guide.md

## Findings

## 1) Good: nonce + structured parsing is the right baseline

**Severity:** ✅ Strength

**Where**

- Nonce creation + message parsing + rate limiter:
  - [webviewSecurity.ts](../../../src/utils/webviewSecurity.ts)
- WebView integration and validation:
  - [WebViewReader.tsx](../../../src/screens/reader/components/WebViewReader.tsx)

**Why**

This meaningfully reduces cross-context message spoofing and limits flooding risk.

---

## 2) Ensure navigation allowlist is “default deny”, including file:// and intent://

**Severity:** 🚨 CRITICAL

**Where**

- `onShouldStartLoadWithRequest` handling should enforce local-only + explicit allowlist:
  - [WebViewReader.tsx](../../../src/screens/reader/components/WebViewReader.tsx)

**Why**

WebViews are a common injection target. If any external navigation (including `intent://`, `mailto:`, `tel:`) can be opened automatically, you risk phishing or privilege escalation.

**Fix**

- Ensure the handler explicitly denies by default.
- Allow only:
  - your bundled local reader content (e.g. `file:///android_asset/...`)
  - explicit safe external URLs via user intent (tap) + `Linking.openURL` guarded

---

## 3) Avoid double-parse and ambiguous message formats

**Severity:** ⚠️ MAJOR

**Where**

- Any `JSON.parse(JSON.parse(...))` or “stringified JSON inside JSON” patterns in:
  - [WebViewReader.tsx](../../../src/screens/reader/components/WebViewReader.tsx)

**Why**

Ambiguous formats increase risk of parsing bugs and bypasses (e.g., attacker crafts a message that passes a shallow check).

**Fix**

- Adopt a single canonical message envelope:
  - `{ nonce, type, payload, ts }`
- Parse once, validate shape, then route.

---

## 4) Rate limiter must be per-nonce/session and reset on reload

**Severity:** 🔧 MINOR

**Why**

A global limiter across sessions can produce “stuck” behavior after reload. A per-session limiter reduces false positives.

**Fix**

- Ensure limiter resets when a new nonce is issued.

## Suggested Tests

- Navigation allowlist tests for:
  - `file://` allowed only for asset origins
  - `http(s)://` denied unless user-initiated
  - `intent://` denied
- Message parsing tests:
  - rejects missing nonce
  - rejects unknown types
  - rejects oversized payload
