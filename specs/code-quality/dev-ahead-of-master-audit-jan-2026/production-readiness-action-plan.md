# Production Readiness Action Plan

**Created:** January 3, 2026  
**Objective:** Ensure LNReader app is production ready with stable, recent dependencies  
**Source:** Audit verification against codebase + `dev-ahead-of-master-audit-jan-2026`

---

## Verification Summary

> [!IMPORTANT]
> **REVALIDATED** on January 3, 2026 against actual codebase and git commits.  
> See `VERIFICATION-REPORT.md` for detailed analysis.

| Audit Claim                                  | Verification Status  | Notes                                                 |
| -------------------------------------------- | -------------------- | ----------------------------------------------------- |
| `System.exit(0)` harsh termination           | ✅ **CONFIRMED**      | `DoHManagerModule.kt:114`                             |
| Set-Cookie comma split vulnerability         | ✅ **CONFIRMED**      | `fetch.ts:110` (+ also has `split('=')` on line 113!) |
| Cookie `split('=')` in **WebviewScreen.tsx** | ✅ **CONFIRMED**      | Line 128 - real vulnerability                         |
| Cookie `split('=')` in **CookieManager.ts**  | ❌ **FALSE POSITIVE** | Uses `Object.entries()` - no bug!                     |
| No certificate pinning for DoH               | ✅ **CONFIRMED**      | No `certificatePinner` in codebase                    |
| No timeout for DoH bootstrap client          | ✅ **CONFIRMED**      | Line 127 - no `.connectTimeout()`                     |
| SharedPreferences async `apply()`            | ✅ **CONFIRMED**      | Lines 55 & 67 - should use `commit()`                 |
| `.pnpm-patches/cookies/` bloat               | ✅ **CONFIRMED**      | 11 files (should only have .patch)                    |
| Cookies patch version mismatch               | ✅ **CONFIRMED**      | Package: 6.2.1, Patch targets: 8.0.1                  |
| Gradle version                               | ⚠️ **CORRECTED**      | Audit says 8.9, actual is **9.2.0**                   |
| TTS debounce 500ms                           | ✅ **CONFIRMED**      | useTTSController.ts:382                               |

**Audit Accuracy:** 13/14 correct (93%) ✅  

---

## Phase 1: Critical Security & Bug Fixes (P0)
**Estimated Time:** 12-16 hours  
**Priority:** Must complete before any production release

### 1.1 Fix Cookie Value Truncation in WebviewScreen ⚠️
**File:** `src/screens/WebviewScreen/WebviewScreen.tsx:128`  
**Issue:** `split('=')` breaks on cookie values containing `=` (e.g., JWT tokens, base64)

> [!NOTE]
> Commit `2c50cd997` renamed variables (`name`→`cookieName`) but did NOT fix the underlying split bug.

```typescript
// CURRENT (line 128):
const [cookieName, cookieValue] = cookieStr.trim().split('=');
if (cookieName && cookieValue) {
  cookies[cookieName] = cookieValue;
}

// FIX:
const firstEqIndex = cookieStr.indexOf('=');
if (firstEqIndex === -1) return; // Skip malformed

const cookieName = cookieStr.slice(0, firstEqIndex).trim();
const rawValue = cookieStr.slice(firstEqIndex + 1).trim();
const cookieValue = decodeURIComponent(rawValue); // URL decode

// Skip cookie attributes (Path, Domain, Secure, etc.)
const attrName = cookieName.toLowerCase();
if (['path', 'domain', 'expires', 'max-age', 'secure', 'httponly', 'samesite'].includes(attrName)) {
  return;
}

if (cookieName && cookieValue) {
  cookies[cookieName] = cookieValue;
}
```

**Test:** JWT token cookie `session=eyJhbG.ciOiJ.IUzI1` should NOT truncate  
**Estimate:** 3 hours (including attribute filtering + tests)

---

### 1.2 Fix Set-Cookie Header Parsing (TWO bugs!) ⚠️
**File:** `src/plugins/helpers/fetch.ts:108-118`  
**Issues:**  
1. ❌ Comma delimiter fails on `Expires` attribute (contains comma in date)
2. ❌ Value `split('=')` truncates values containing `=`

> [!WARNING]
> Current code has **BOTH** the comma split AND the equals split vulnerabilities!

```typescript
// CURRENT (lines 108-118):
// Parse Set-Cookie header (can be comma-separated for multiple cookies)
// Note: This is a simplified parser. Complex cookies with commas in values may need more robust parsing
setCookieHeader.split(',').forEach(cookieStr => {  // ❌ BUG #1: Comma split
  const [nameValue] = cookieStr.split(';');
  if (nameValue) {
    const [name, value] = nameValue.split('=');     // ❌ BUG #2: Equals split
    if (name && value) {
      cookies[name.trim()] = value.trim();
    }
  }
});

// FIX:
// Multiple Set-Cookie headers are separated by newlines in HTTP/1.1
const cookieLines = setCookieHeader.split(/\r?\n/);

for (const cookieLine of cookieLines) {
  const [nameValue, ...attributes] = cookieLine.split(';');
  
  // Use indexOf to handle values with '='
  const firstEqIndex = nameValue.indexOf('=');
  if (firstEqIndex === -1) continue;
  
  const name = nameValue.slice(0, firstEqIndex).trim();
  const value = nameValue.slice(firstEqIndex + 1).trim();
  
  if (name && value !== undefined) {
    parsedCookies[name] = value;
  }
}
```

**Test Cases:**
- `Set-Cookie: session=abc; Expires=Wed, 09 Jun 2025 10:18:14 GMT` (comma in Expires)
- `Set-Cookie: jwt=eyJhbG.ciOiJ.IUzI1NiIsInR5c` (equals in value)

**Estimate:** 4 hours (including integration tests)

---

### 1.3 Replace System.exit(0) with Graceful Shutdown
**File:** `android/app/src/main/java/com/rajarsheechatterjee/LNReader/DoHManagerModule.kt:114`  
**Issue:** Harsh termination without cleanup causes potential data loss

```kotlin
// CURRENT:
try {
    System.exit(0)
} catch (e: Exception) {
    reactApplicationContext.currentActivity?.finish()
}

// FIX:
try {
    // Force flush SharedPreferences
    val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit().commit() // Synchronous write
    
    // Graceful exit
    reactApplicationContext.currentActivity?.finish()
    System.exit(0)
} catch (e: Exception) {
    reactApplicationContext.currentActivity?.finish()
}
```

**Estimate:** 2 hours

---

### 1.4 Add DoH Query Timeout
**File:** `android/app/src/main/java/com/rajarsheechatterjee/LNReader/DoHManagerModule.kt`  
**Issue:** No timeout for DoH queries (infinite hang possible)

```kotlin
// Add to buildDnsOverHttps():
val bootstrapClient = OkHttpClient.Builder()
    .connectTimeout(5, TimeUnit.SECONDS)
    .readTimeout(5, TimeUnit.SECONDS)
    .writeTimeout(5, TimeUnit.SECONDS)
    .build()
```

**Estimate:** 1 hour

---

### 1.5 Change SharedPreferences to Synchronous Write
**File:** `android/app/src/main/java/com/rajarsheechatterjee/LNReader/DoHManagerModule.kt`  
**Issue:** Using `apply()` instead of `commit()` - settings lost on crash

```kotlin
// Find and replace all:
prefs?.edit()?.putInt(KEY_PROVIDER, providerId)?.apply()

// With:
prefs?.edit()?.putInt(KEY_PROVIDER, providerId)?.commit()
```

**Estimate:** 30 minutes

---

### 1.6 Remove Obsolete Files
**Actions:**
1. Remove `.pnpm-patches/cookies/` directory (bloat)
2. Verify/remove `patches/@react-native-cookies__cookies.patch` (targets wrong version 8.0.1 vs installed 6.2.1)

```bash
rm -rf .pnpm-patches/cookies/
# Edit pnpm-workspace.yaml if cookies patch referenced
pnpm install
```

**Estimate:** 30 minutes

---

## Phase 2: Security Hardening (P1)
**Estimated Time:** 8-12 hours  
**Priority:** High - complete within 1 week

### 2.1 Add Certificate Pinning for DoH Providers
**File:** `android/app/src/main/java/com/rajarsheechatterjee/LNReader/DoHManagerModule.kt`  
**Issue:** MITM vulnerability on DNS queries

> [!WARNING]
> This requires obtaining current SSL certificates for each DoH provider.
> Certificate pins may need periodic updates when providers rotate certificates.

```kotlin
val pinnedClient = OkHttpClient.Builder()
    .certificatePinner(
        CertificatePinner.Builder()
            .add("cloudflare-dns.com", "sha256/XXXX")
            .add("dns.google", "sha256/YYYY")
            .add("dns.adguard.com", "sha256/ZZZZ")
            .build()
    )
    .connectTimeout(5, TimeUnit.SECONDS)
    .build()
```

**Steps:**
1. Get current certificate hashes for each provider
2. Implement pinning
3. Add fallback for pin validation failure
4. Test with each provider

**Estimate:** 6 hours

---

### 2.2 Add User Confirmation for App Restart
**File:** `src/screens/settings/SettingsAdvancedScreen.tsx`  
**Issue:** No warning before forced app restart after DoH change

```typescript
Alert.alert(
  "Restart Required",
  "Changing DNS provider requires restarting the app. Any unsaved changes will be lost.",
  [
    { text: "Cancel", style: "cancel" },
    { text: "Restart Now", onPress: () => { /* restart logic */ } },
    { text: "Restart Later", style: "default" }
  ]
);
```

**Estimate:** 2 hours

---

### 2.3 Add Cookie Attribute Filtering  
**File:** `src/screens/WebviewScreen/WebviewScreen.tsx`  
**Issue:** Cookie attributes (Path, Domain, etc.) parsed as cookie names

```typescript
const COOKIE_ATTRIBUTES = ['path', 'domain', 'expires', 'max-age', 'secure', 'httponly', 'samesite'];

// In parsing loop:
if (COOKIE_ATTRIBUTES.includes(cookieName.toLowerCase())) {
  return; // Skip attributes, only store actual cookies
}
```

**Estimate:** 2 hours

---

## Phase 3: Build Validation & Cleanup (P1)
**Estimated Time:** 4-6 hours  
**Priority:** High - before any release

### 3.1 Full Build Validation
```bash
cd android
./gradlew clean
./gradlew assembleDebug
./gradlew assembleRelease

# Verify APKs
ls -lh app/build/outputs/apk/

# Run all tests
cd ..
pnpm test
```

### 3.2 Verify Patches Still Apply
```bash
# Verify react-native-sha256 patch (should be version 1.4.10)
pnpm ls react-native-sha256

# Reinstall to confirm patches apply
pnpm install
```

### 3.3 Manual Device Testing
- [ ] Install APK on physical device
- [ ] Test TTS playback (foreground, background, Bluetooth controls)
- [ ] Test DoH provider switching
- [ ] Test cookie persistence across app restarts
- [ ] Monitor logcat for errors

**Estimate:** 4-6 hours

---

## Phase 4: Performance Optimization (P2)
**Estimated Time:** 6-8 hours  
**Priority:** Medium - next sprint

### 4.1 Fix TTS Performance Regression
**File:** `src/screens/reader/hooks/useTTSController.ts`  
**Issue:** `CHAPTER_LIST_REFRESH_DEBOUNCE_MS = 500` causes 3600+ DB queries per 30-min chapter

```typescript
// Increase debounce
const CHAPTER_LIST_REFRESH_DEBOUNCE_MS = 2000; // 4x fewer queries

// Or add visibility check
if (isChapterListVisibleRef.current) {
  refreshChaptersFromContextRef.current?.();
}
```

**Estimate:** 2 hours

---

### 4.2 Extract Duplicated Code
**Files:** `useTTSController.ts` (6 locations with identical `setTimeout` blocks)

Create helper function:
```typescript
const syncChapterList = useCallback((delayMs: number = 100) => {
  setTimeout(() => {
    try {
      refreshChaptersFromContext?.();
    } catch (e) {
      ttsCtrlLog.warn('chapter-list-sync-failed', '', e);
    }
  }, delayMs);
}, [refreshChaptersFromContext]);
```

**Estimate:** 3 hours

---

### 4.3 Add React.memo to ChapterRow
**File:** `src/screens/novel/components/NovelScreenList.tsx`  
**Issue:** Entire chapter list re-renders on every TTS progress update

```typescript
const ChapterRow = React.memo(ChapterRowComponent, (prev, next) => {
  return prev.chapter.id === next.chapter.id &&
         prev.chapter.progress === next.chapter.progress;
});
```

**Estimate:** 2 hours

---

## Phase 5: Testing & Documentation (P2)
**Estimated Time:** 8-12 hours  
**Priority:** Medium

### 5.1 Add Missing Integration Tests
- [ ] TTS progress sync
- [ ] Cookie parsing edge cases (values with `=`, URL encoding)
- [ ] DoH timeout behavior

### 5.2 Update Documentation
- [ ] Fix date inaccuracy in AGENTS.md (Jan 3 → Jan 2)
- [ ] Update Gradle version references (8.9 → 9.2.0)
- [ ] Add troubleshooting section to README

---

## Dependency Updates (Separate Phase)
**Priority:** After P0-P2 completion

> [!IMPORTANT]  
> Current dependencies are already relatively recent. Focus on stability rather than bleeding edge.

| Dependencies | Current | Latest Stable | Recommendation |
| ------------ | ------- | ------------- | -------------- |
| React Native | 0.82.1  | 0.82.1        | ✅ Current      |
| Gradle       | 9.2.0   | 9.2.0         | ✅ Current      |
| Reanimated   | 4.2.0   | 4.2.x         | ✅ Current      |
| OkHttp       | 4.12.0  | 4.12.x        | ✅ Current      |

**Action:** Run `npx npm-check-updates` periodically to monitor for security patches.

---

## Summary

| Phase       | Tasks                         | Est. Time  | Priority            |
| ----------- | ----------------------------- | ---------- | ------------------- |
| **Phase 1** | Critical Bug & Security Fixes | 12-16h     | P0 - Before release |
| **Phase 2** | Security Hardening            | 8-12h      | P1 - Within 1 week  |
| **Phase 3** | Build Validation              | 4-6h       | P1 - Before release |
| **Phase 4** | Performance Optimization      | 6-8h       | P2 - Next sprint    |
| **Phase 5** | Testing & Documentation       | 8-12h      | P2 - Ongoing        |
| **Total**   |                               | **38-54h** |                     |

---

## Quick Start Commands

```bash
# Run all tests
pnpm test

# Build release APK
pnpm run build:release:android

# Format before commit
pnpm run format && git add . && git commit -m "fix: description"

# Clean build
pnpm run clean:android && pnpm run dev:clean-start
```

---

## Verification Checklist

### Before Merge to Master
- [ ] All Phase 1 fixes applied
- [ ] All tests passing (1072+)
- [ ] Release APK builds successfully
- [ ] Manual testing on physical device
- [ ] No new ESLint/TypeScript errors

### Before Production Release
- [ ] Phase 1 + Phase 3 complete
- [ ] Certificate pinning tested with all DoH providers
- [ ] User confirmation dialogs working
- [ ] Performance regression fixed

---

*This action plan was created by verifying audit findings against the actual codebase and prioritizing fixes based on impact and risk.*
