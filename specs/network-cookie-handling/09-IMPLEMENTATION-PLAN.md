# Implementation Plan: Network & Cookie Handling Enhancement

**Date**: January 1, 2026  
**Version**: 1.0 (Refined)  
**Status**: Ready for Execution  
**Approach**: Session-based implementation with yokai best practices

---

## Executive Summary

This plan implements automatic cookie persistence and management in LNReader following yokai's proven architecture, adapted for React Native. The implementation is broken into **5 independent sessions**, each executable in 2-3 hours, with full test coverage and zero regressions.

**Key Insight**: LNReader already has 60% of infrastructure in place:

- ✅ `@react-native-cookies/cookies` library installed (unused)
- ✅ `NativeFile.kt` has OkHttp cookie bridge configured
- ✅ WebView localStorage/sessionStorage extraction pattern exists

We need to **activate and integrate** existing components, not build from scratch.

---

## Phased Approach

| Phase                           | Priority | Effort     | Risk   | Sessions |
| ------------------------------- | -------- | ---------- | ------ | -------- |
| **Phase 1: Cookie Persistence** | P0       | 5 sessions | LOW    | 1-5      |
| **Phase 2: Cloudflare Bypass**  | P1       | 3 sessions | MEDIUM | 6-8      |
| **Phase 3: DoH Support**        | P2       | 4 sessions | MEDIUM | 9-12     |

**This document covers Phase 1 only** (Sessions 1-5).

---

## Success Criteria (Phase 1)

### Must-Have (P0)

- [ ] Cookies persist across app restarts (validated via manual test)
- [ ] `fetchApi()` automatically injects cookies from CookieManager
- [ ] `fetchApi()` automatically saves Set-Cookie headers to CookieManager
- [ ] Cookies sync between WebView and HTTP requests
- [ ] Plugin developers don't need to change any code
- [ ] All 917+ existing tests pass
- [ ] Zero breaking changes to existing plugin API

### Should-Have (P1)

- [ ] Cookie clearing UI in 3 locations (like yokai):
  - Global: Settings → Advanced → Clear Cookies
  - Per-Source: Source details → Clear Cookies
  - WebView: WebView menu → Clear Cookies
- [ ] User feedback (Toast) when cookies cleared
- [ ] Cookie count displayed when clearing

### Nice-to-Have (P2)

- [ ] Cookie expiry management
- [ ] Cookie encryption for sensitive values
- [ ] Cookie debug logging (dev mode only)

---

## Yokai Patterns to Replicate

### 1. AndroidCookieJar Architecture

**Yokai Implementation:**

```kotlin
class AndroidCookieJar : CookieJar {
    private val manager = CookieManager.getInstance()

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        cookies.forEach { manager.setCookie(url.toString(), it.toString()) }
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val cookies = manager.getCookie(url.toString())
        return cookies?.split(";")?.mapNotNull { Cookie.parse(url, it) } ?: emptyList()
    }

    fun remove(url: HttpUrl, cookieNames: List<String>? = null): Int
    fun removeAll()
}
```

**LNReader Adaptation:**
Use `@react-native-cookies/cookies` which wraps the same Android `CookieManager`.

---

### 2. Three-Tier Cookie Clearing

**Yokai locations:**

1. **Global**: Settings → Advanced → "Clear cookies" → `cookieJar.removeAll()`
2. **Per-Extension**: Extension details → Menu → "Clear cookies" → `cookieJar.remove(url)`
3. **WebView**: WebView menu → "Clear cookies" → `cookieJar.remove(currentUrl)`

**LNReader adaptation:**

1. **Global**: Settings → Advanced → "Clear Cookies" → `CookieManager.clearAll()`
2. **Per-Source**: Novel/Source screen → Menu → "Clear Cookies" → `CookieManager.clearByName(url)`
3. **WebView**: `WebviewScreen` menu → "Clear Cookies" → `CookieManager.clearByName(currentUrl)`

---

### 3. Automatic Cookie Injection (Interceptor Pattern)

**Yokai Implementation:**
OkHttp automatically injects cookies via `CookieJar` interface.

**LNReader Adaptation:**
Wrap `fetchApi()` to inject cookies before request and save after response.

---

## Phase 1 Detailed Plan

---

## SESSION 1: Core Cookie Infrastructure

**Goal**: Activate `@react-native-cookies/cookies` and create cookie manager wrapper

**Files to Modify:**

- [NEW] `src/services/network/CookieManager.ts`
- [NEW] `src/services/network/__tests__/CookieManager.test.ts`

**Tasks:**

1. Create `CookieManager.ts` wrapper around `@react-native-cookies/cookies`
2. Implement methods:
   - `getCookies(url: string): Promise<Record<string, string>>`
   - `setCookies(url: string, cookies: Record<string, string>): Promise<void>`
   - `clearCookies(url: string): Promise<number>`
   - `clearAllCookies(): Promise<void>`
3. Add error handling and logging
4. Write comprehensive unit tests

**Validation:**

```bash
pnpm run test -- --testPathPattern=CookieManager.test
```

**Estimated Time**: 1.5 hours

**Rollback**: Delete new files, no existing code modified.

---

## SESSION 2: Enhanced fetchApi with Cookie Injection

**Goal**: Modify `fetchApi()` to automatically inject/save cookies

**Files to Modify:**

- [EDIT] `src/plugins/helpers/fetch.ts`
- [NEW] `src/plugins/helpers/__tests__/fetch.cookies.test.ts`

**Changes to `fetch.ts`:**

```typescript
// Add import
import { CookieManager } from '@services/network/CookieManager';

// Modify fetchApi
export const fetchApi = async (
  url: string,
  init?: FetchInit,
): Promise<Response> => {
  init = makeInit(init);

  // STEP 1: Inject cookies from CookieManager
  const storedCookies = await CookieManager.getCookies(url);
  if (Object.keys(storedCookies).length > 0) {
    const cookieString = Object.entries(storedCookies)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');

    if (init.headers instanceof Headers) {
      init.headers.set('Cookie', cookieString);
    } else {
      init.headers = {
        ...init.headers,
        Cookie: cookieString,
      };
    }
  }

  // STEP 2: Make request
  const response = await fetch(url, init);

  // STEP 3: Save Set-Cookie headers
  const setCookieHeaders = response.headers.get('set-cookie');
  if (setCookieHeaders) {
    const cookies: Record<string, string> = {};
    setCookieHeaders.split(',').forEach(cookieStr => {
      const [nameValue] = cookieStr.split(';');
      const [name, value] = nameValue.split('=');
      if (name && value) {
        cookies[name.trim()] = value.trim();
      }
    });
    await CookieManager.setCookies(url, cookies);
  }

  return response;
};
```

**Tasks:**

1. Add cookie injection before fetch
2. Add cookie saving after response
3. Handle edge cases (empty cookies, malformed headers)
4. Write integration tests

**Validation:**

```bash
pnpm run test -- --testPathPattern=fetch.cookies.test
pnpm run test  # All existing tests must pass
```

**Estimated Time**: 2 hours

**Rollback**: Git revert fetch.ts changes.

---

## SESSION 3: WebView Cookie Sync

**Goal**: Extract cookies from WebView and sync to CookieManager

**Files to Modify:**

- [EDIT] `src/screens/WebviewScreen/WebviewScreen.tsx`
- [NEW] `src/screens/WebviewScreen/__tests__/WebviewScreen.cookies.test.ts`

**Changes to `WebviewScreen.tsx`:**

```typescript
// Add import
import { CookieManager } from '@services/network/CookieManager';

// Add cookie extraction to injectedJavaScript
const injectJavaScriptCode = `
  try {
    const data = {
      localStorage,
      sessionStorage,
      cookies: document.cookie  // NEW: Extract cookies
    };
    window.ReactNativeWebView.postMessage(JSON.stringify(data));
  } catch (e) { /* Intentionally empty: Security sandbox */ }
`;

// Modify onMessage handler
onMessage={async ({ nativeEvent }) => {
  try {
    const parsed = JSON.parse(nativeEvent.data);
    if (parsed && typeof parsed === 'object') {
      // Existing localStorage/sessionStorage handling
      if (
        (!('localStorage' in parsed) || typeof parsed.localStorage === 'object') &&
        (!('sessionStorage' in parsed) || typeof parsed.sessionStorage === 'object')
      ) {
        setTempData(parsed);
      }

      // NEW: Cookie handling
      if (parsed.cookies && typeof parsed.cookies === 'string') {
        const cookies: Record<string, string> = {};
        parsed.cookies.split(';').forEach((cookieStr: string) => {
          const [name, value] = cookieStr.trim().split('=');
          if (name && value) {
            cookies[name] = value;
          }
        });
        await CookieManager.setCookies(currentUrl, cookies);
      }
    }
  } catch (e) {
    // Ignore invalid payloads
  }
}}
```

**Tasks:**

1. Add cookie extraction to `injectedJavaScript`
2. Parse and save cookies in `onMessage`
3. Add error handling
4. Write tests for cookie sync

**Validation:**

```bash
pnpm run test -- --testPathPattern=WebviewScreen.cookies.test
```

**Estimated Time**: 1.5 hours

**Rollback**: Git revert WebviewScreen changes.

---

## SESSION 4: Cookie Clearing UI (Part 1 - Core)

**Goal**: Implement global cookie clearing in settings

**Files to Modify:**

- [EDIT] `src/screens/settings/SettingsAdvancedScreen.tsx`
- [NEW] `src/services/network/__tests__/CookieClearing.integration.test.ts`

**Changes to `SettingsAdvancedScreen.tsx`:**

```typescript
import { CookieManager } from '@services/network/CookieManager';
import { showToast } from '@utils/showToast';

// Add to settings list (after "Clear WebView data" or similar)
<List.Item
  title={getString('settings.clearCookies')}
  description={getString('settings.clearCookiesDescription')}
  onPress={async () => {
    try {
      await CookieManager.clearAllCookies();
      showToast(getString('settings.cookiesCleared'));
    } catch (error) {
      showToast(getString('settings.cookiesClearFailed'));
    }
  }}
  left={(props) => <List.Icon {...props} icon="cookie-off" />}
/>
```

**Tasks:**

1. Add "Clear Cookies" option to Settings → Advanced
2. Implement global clear with user feedback
3. Add translations for strings
4. Write integration test

**Validation:**

```bash
pnpm run test -- --testPathPattern=CookieClearing.integration.test
# Manual test: Settings → Advanced → Clear Cookies → Toast appears
```

**Estimated Time**: 1.5 hours

**Rollback**: Git revert settings screen changes.

---

## SESSION 5: Cookie Clearing UI (Part 2 - Per-Source & WebView)

**Goal**: Implement per-source and WebView cookie clearing

**Files to Modify:**

- [EDIT] `src/screens/novel/NovelScreen.tsx` (or similar source details screen)
- [EDIT] `src/screens/WebviewScreen/components/Menu.tsx`
- [NEW] `src/screens/WebviewScreen/__tests__/CookieClearingMenu.test.ts`

**Changes to `NovelScreen.tsx`:**
Add menu item in novel options menu:

```typescript
// In novel menu actions
{
  title: getString('novel.clearCookies'),
  icon: 'cookie-off',
  onPress: async () => {
    try {
      const url = resolveUrl(novel.pluginId, novel.path, true);
      const count = await CookieManager.clearCookies(url);
      showToast(
        getString('novel.cookiesCleared', { count })
      );
    } catch (error) {
      showToast(getString('novel.cookiesClearFailed'));
    }
  },
}
```

**Changes to `WebviewScreen/components/Menu.tsx`:**
Add menu item:

```typescript
<List.Item
  title={getString('webview.clearCookies')}
  onPress={async () => {
    try {
      const count = await CookieManager.clearCookies(currentUrl);
      showToast(
        getString('webview.cookiesCleared', { count })
      );
      setMenuVisible(false);
    } catch (error) {
      showToast(getString('webview.cookiesClearFailed'));
    }
  }}
  left={(props) => <List.Icon {...props} icon="cookie-off" />}
/>
```

**Tasks:**

1. Add per-source cookie clearing in novel menu
2. Add WebView cookie clearing in WebView menu
3. Add all translation strings
4. Write tests for both UIs

**Validation:**

```bash
pnpm run test -- --testPathPattern=CookieClearingMenu.test
# Manual test: Novel menu → Clear Cookies → Toast with count
# Manual test: WebView menu → Clear Cookies → Toast with count
```

**Estimated Time**: 2 hours

**Rollback**: Git revert menu changes.

---

## Translation Strings Needed

Add to `strings/languages/en.json`:

```json
{
  "settings": {
    "clearCookies": "Clear cookies",
    "clearCookiesDescription": "Remove all stored cookies",
    "cookiesCleared": "Cookies cleared successfully",
    "cookiesClearFailed": "Failed to clear cookies"
  },
  "novel": {
    "clearCookies": "Clear cookies for this source",
    "cookiesCleared": "Cleared {{count}} cookie(s)",
    "cookiesClearFailed": "Failed to clear cookies"
  },
  "webview": {
    "clearCookies": "Clear cookies",
    "cookiesCleared": "Cleared {{count}} cookie(s)",
    "cookiesClearFailed": "Failed to clear cookies"
  }
}
```

---

## Testing Strategy

### Unit Tests (Per Session)

Each session includes unit tests for new/modified code:

- Session 1: CookieManager API tests
- Session 2: fetchApi cookie injection/saving tests
- Session 3: WebView cookie extraction tests
- Session 4: Settings UI interaction tests
- Session 5: Menu UI interaction tests

### Integration Tests

After all sessions complete:

```bash
# Run full test suite
pnpm run test

# Manual integration test
1. Install app on device
2. Login to a source via WebView
3. Close app completely (swipe away from recents)
4. Reopen app
5. VERIFY: Still logged in (cookie persisted)
6. Navigate to novel from that source
7. VERIFY: Fetch requests include cookies (check network logs)
8. Clear cookies via Settings → Advanced
9. VERIFY: Logged out, fetch requests have no cookies
```

### Regression Tests

```bash
# Verify all existing tests pass
pnpm run test

# Verify app builds successfully
pnpm run build:release:android

# Verify no ESLint errors
pnpm run lint
```

---

## Files Created/Modified Summary

### New Files (7)

```
src/services/network/CookieManager.ts
src/services/network/__tests__/CookieManager.test.ts
src/plugins/helpers/__tests__/fetch.cookies.test.ts
src/screens/WebviewScreen/__tests__/WebviewScreen.cookies.test.ts
src/services/network/__tests__/CookieClearing.integration.test.ts
src/screens/WebviewScreen/__tests__/CookieClearingMenu.test.ts
specs/network-cookie-handling/09-IMPLEMENTATION-PLAN.md (this file)
```

### Modified Files (5)

```
src/plugins/helpers/fetch.ts (~30 lines added)
src/screens/WebviewScreen/WebviewScreen.tsx (~20 lines added)
src/screens/settings/SettingsAdvancedScreen.tsx (~15 lines added)
src/screens/novel/NovelScreen.tsx (~10 lines added)
src/screens/WebviewScreen/components/Menu.tsx (~10 lines added)
strings/languages/en.json (~15 lines added)
```

**Total Code Changes**: ~100 lines added, 7 new test files

---

## Risk Mitigation

### Risk 1: Breaking Existing Plugin Fetch Calls

**Mitigation**:

- Cookie injection is additive (doesn't modify existing headers)
- `fetchApi()` signature unchanged
- Async cookie operations wrapped in try-catch
- All existing tests validated

**Rollback**: Git revert specific session changes.

### Risk 2: `@react-native-cookies/cookies` Build Issues

**Mitigation**:

- Library already installed (in package.json)
- Test import in Session 1 before proceeding
- Known workaround: patch build.gradle if jcenter() issue occurs

**Rollback**: Remove CookieManager.ts, don't use library.

### Risk 3: Cookie Sync Timing Issues

**Mitigation**:

- Android's CookieManager is synchronous after first access
- WebView cookie extraction happens on `onMessage` (after page load)
- Race conditions unlikely due to sequential execution

**Rollback**: Remove WebView cookie sync code.

### Risk 4: Performance Degradation

**Mitigation**:

- Cookie read/write operations are <5ms (MMKV-level speed)
- Async operations don't block UI thread
- Cookie injection only adds 1 network header

**Testing**: Benchmark fetch performance before/after.

---

## Rollback Strategy

Each session is independent with clear rollback:

| Session | Rollback Command                                                        | Impact                 |
| ------- | ----------------------------------------------------------------------- | ---------------------- |
| 1       | `rm -rf src/services/network/CookieManager*`                            | None (new files only)  |
| 2       | `git checkout src/plugins/helpers/fetch.ts`                             | Reverts to plain fetch |
| 3       | `git checkout src/screens/WebviewScreen/WebviewScreen.tsx`              | Reverts WebView sync   |
| 4       | `git checkout src/screens/settings/SettingsAdvancedScreen.tsx`          | Removes settings UI    |
| 5       | `git checkout src/screens/*/Menu.tsx src/screens/novel/NovelScreen.tsx` | Removes menu items     |

**Full Rollback** (emergency):

```bash
git checkout HEAD~5  # Undo last 5 commits
pnpm run test        # Verify all tests pass
```

---

## Session Execution Checklist

For each session, follow this workflow:

### Pre-Session

- [ ] Read session plan from this document
- [ ] Verify current working directory is clean (`git status`)
- [ ] Run existing tests to establish baseline (`pnpm run test`)
- [ ] Create feature branch: `git checkout -b feat/cookies-session-N`

### During Session

- [ ] Implement changes as specified in session plan
- [ ] Write unit tests for new/modified code
- [ ] Run tests: `pnpm run test -- --testPathPattern=<session-test>`
- [ ] Verify no lint errors: `pnpm run lint:fix`
- [ ] Format code: `pnpm run format`

### Post-Session

- [ ] Run full test suite: `pnpm run test` (all 917+ tests must pass)
- [ ] Commit changes: `git add . && git commit -m "feat: [Session N] <description>"`
- [ ] Manual validation (if specified in session plan)
- [ ] Document any issues or deviations in commit message

### Session Complete Criteria

- [ ] All session tests pass
- [ ] All existing tests pass (no regressions)
- [ ] Code formatted and linted
- [ ] Changes committed to git
- [ ] Manual validation complete (if required)

---

## Next Steps After Phase 1

Once all 5 sessions complete:

1. **Create Phase 1 Summary Document** (`10-PHASE1-SUMMARY.md`)
   - What was implemented
   - Test coverage achieved
   - Known limitations
   - Performance benchmarks

2. **User Testing** (1-2 days)
   - Install on test devices
   - Login to authenticated sources
   - Verify cookie persistence across restarts
   - Test cookie clearing UI
   - Gather feedback

3. **Bug Fixes** (if needed)
   - Address any issues found in user testing
   - Update tests to cover edge cases

4. **Phase 2 Planning** (Cloudflare Bypass)
   - Research react-native-webview background capabilities
   - Design interceptor pattern for 403/503 detection
   - Plan cf_clearance cookie detection

5. **Phase 3 Planning** (DNS over HTTPS)
   - Research native DNS module options
   - Design DoH provider configuration UI
   - Plan fallback to system DNS

---

## Appendix A: Yokai Code References

### AndroidCookieJar.kt (Full Implementation)

```kotlin
package eu.kanade.tachiyomi.network

import android.webkit.CookieManager
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl

class AndroidCookieJar : CookieJar {
    private val manager = CookieManager.getInstance()

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val urlString = url.toString()
        cookies.forEach { manager.setCookie(urlString, it.toString()) }
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        return get(url)
    }

    fun get(url: HttpUrl): List<Cookie> {
        val cookies = manager.getCookie(url.toString())

        return if (cookies != null && cookies.isNotEmpty()) {
            cookies.split(";").mapNotNull { Cookie.parse(url, it) }
        } else {
            emptyList()
        }
    }

    fun remove(url: HttpUrl, cookieNames: List<String>? = null, maxAge: Int = -1): Int {
        val urlString = url.toString()
        val cookies = manager.getCookie(urlString) ?: return 0

        fun List<String>.filterNames(): List<String> {
            return if (cookieNames != null) {
                this.filter { it in cookieNames }
            } else {
                this
            }
        }

        return cookies.split(";")
            .map { it.substringBefore("=") }
            .filterNames()
            .onEach { manager.setCookie(urlString, "$it=;Max-Age=$maxAge") }
            .count()
    }

    fun removeAll() {
        manager.removeAllCookies {}
    }
}
```

---

## Appendix B: React Native Cookie Manager API

### `@react-native-cookies/cookies` API

```typescript
import CookieManager from '@react-native-cookies/cookies';

// Set cookie (structured object)
await CookieManager.set('https://example.com', {
  name: 'session_id',
  value: 'abc123',
  domain: 'example.com',
  path: '/',
  expires: new Date(Date.now() + 86400000).toISOString(),
});

// Set cookie from raw string
await CookieManager.setFromResponse(
  'https://example.com',
  'session_id=abc123; Path=/; Domain=example.com',
);

// Get cookies
const cookies = await CookieManager.get('https://example.com');
// Returns: { session_id: { name: 'session_id', value: 'abc123', ... } }

// Clear all cookies
await CookieManager.clearAll();

// Flush to disk (Android only)
await CookieManager.flush();
```

---

## Appendix C: Testing Commands

```bash
# Run specific test file
pnpm run test -- --testPathPattern=CookieManager.test

# Run all tests in directory
pnpm run test -- src/services/network/__tests__

# Run tests with coverage
pnpm run test -- --coverage

# Run tests in watch mode (for development)
pnpm run test -- --watch --testPathPattern=fetch.cookies.test

# Full test suite (all 917+ tests)
pnpm run test

# Type check
pnpm run type-check

# Lint
pnpm run lint

# Lint and auto-fix
pnpm run lint:fix

# Format code
pnpm run format

# Build release APK
pnpm run build:release:android
```

---

**Document Status**: ✅ Ready for Execution  
**Next Action**: Proceed to Session 1 in a new session by reading this plan
