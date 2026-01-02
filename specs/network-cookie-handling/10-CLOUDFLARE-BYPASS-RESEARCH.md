# Research Report: Cloudflare Bypass for React Native (Phase 2)

**Date**: January 2, 2026  
**Author**: AI Research Assistant  
**Status**: Research Complete  
**Related**: [09-IMPLEMENTATION-PLAN.md](09-IMPLEMENTATION-PLAN.md), [08-PRD.md](08-PRD.md)

---

## Executive Summary

This report covers research for implementing Cloudflare bypass in LNReader (React Native). Phase 1 (Cookie Persistence) is complete, providing the foundation for Phase 2. The recommended approach is a **WebView-based challenge solver** that leverages our existing cookie infrastructure.

**Key Finding**: React Native cannot use headless browsers (Puppeteer) directly, but our Phase 1 CookieManager already integrates with WebView cookies, making a WebView-based approach highly feasible.

---

## 1. Cloudflare Challenge Types

### 1.1 Challenge Categories

| Challenge Type | Description | Automatable? | User Interaction |
|----------------|-------------|--------------|------------------|
| **JS Challenge** | JavaScript execution check (5s wait) | ✅ Yes (WebView) | None |
| **Interactive Challenge** | "Verify you are human" checkbox | 🔶 Semi-auto | Click required |
| **CAPTCHA Challenge** | hCaptcha/reCAPTCHA | ❌ No | Manual solve |
| **Managed Challenge** | Adaptive (JS or CAPTCHA based on risk) | 🔶 Sometimes | Depends |
| **Rate Limiting** | Too many requests from IP | ❌ No | Wait or change IP |
| **Bot Fight Mode** | Aggressive anti-bot (super bot) | ❌ No | Very difficult |

### 1.2 Detection Signatures

```typescript
// Cloudflare challenge detection in React Native
interface CloudflareDetection {
  // Response-based detection
  statusCodes: [403, 503];
  serverHeaders: ['cloudflare', 'cloudflare-nginx'];
  
  // Body-based detection (fallback)
  bodySignatures: [
    'cf-browser-verification',
    'cf_chl_opt',
    'challenge-platform',
    'Checking your browser',
    'Just a moment...',
    'Please wait while we verify your browser',
  ];
  
  // Cookie indicators
  bypassCookies: ['cf_clearance', '__cf_bm'];
}
```

### 1.3 Key Cookies

| Cookie Name | Purpose | Lifetime |
|-------------|---------|----------|
| `cf_clearance` | Main bypass token (post-challenge) | ~15 min - 24 hours |
| `__cf_bm` | Bot management token | 30 minutes |
| `cf_chl_prog` | Challenge progress | Session |
| `__cfduid` | Legacy (deprecated) | N/A |

---

## 2. Existing Solutions Analysis

### 2.1 Yokai/Tachiyomi Implementation

**Architecture**: OkHttp Interceptor + Android WebView

Based on our prior research in [02-RESEARCH_FINDINGS.md](02-RESEARCH_FINDINGS.md), yokai uses:

```kotlin
// CloudflareInterceptor.kt - Key Flow
class CloudflareInterceptor(
    private val context: Context,
    private val cookieManager: AndroidCookieJar,
    defaultUserAgentProvider: () -> String,
) : WebViewInterceptor(context, defaultUserAgentProvider) {

    // 1. DETECTION
    override fun shouldIntercept(response: Response): Boolean {
        return response.code in ERROR_CODES && 
               response.header("Server") in SERVER_CHECK
    }

    // 2. BYPASS (WebView-based)
    override fun intercept(chain: Interceptor.Chain, request: Request, response: Response): Response {
        response.close()
        cookieManager.remove(request.url, COOKIE_NAMES, 0)
        
        val oldCookie = cookieManager.get(request.url)
            .firstOrNull { it.name == "cf_clearance" }

        // Solve challenge in WebView
        resolveWithWebView(request, oldCookie)

        // Retry with new cookies
        return chain.proceed(request)
    }

    // 3. WEBVIEW CHALLENGE SOLVER
    private fun resolveWithWebView(originalRequest: Request, oldCookie: Cookie?) {
        val latch = CountDownLatch(1)  // Synchronization primitive
        
        executor.execute {
            webView = createWebView(originalRequest)
            webView?.webViewClient = object : WebViewClientCompat() {
                
                override fun onPageFinished(view: WebView, url: String) {
                    // Check for cf_clearance cookie
                    val bypassed = cookieManager.get(origRequestUrl.toHttpUrl())
                        .firstOrNull { it.name == "cf_clearance" }
                        .let { it != null && it != oldCookie }
                    
                    if (bypassed) {
                        cloudflareBypassed = true
                        latch.countDown()  // Signal success
                    }
                }
            }
            webView?.loadUrl(origRequestUrl, headers)
        }

        latch.awaitFor30Seconds()  // Wait up to 30 seconds
        webView?.destroy()
    }
}

private val ERROR_CODES = listOf(403, 503)
private val SERVER_CHECK = arrayOf("cloudflare-nginx", "cloudflare")
private val COOKIE_NAMES = listOf("cf_clearance")
```

**Key Insights from Yokai**:
1. **Interceptor pattern**: Transparent to extension developers
2. **Cookie-based detection**: Check for `cf_clearance` cookie to confirm bypass
3. **30-second timeout**: Reasonable wait time for JS challenges
4. **Same User-Agent**: WebView uses same UA as HTTP requests (critical!)
5. **CountDownLatch**: Block request until challenge solved

### 2.2 React Native Libraries

| Library | Status | Notes |
|---------|--------|-------|
| `react-native-webview` | ✅ Available | We already use this |
| `puppeteer-core` | ❌ Not available | Requires Node.js runtime |
| `playwright` | ❌ Not available | Requires Node.js runtime |
| `react-native-cloudflare-turnstile` | ❌ Not suitable | For Turnstile widget only |
| `@nicothin/cf-bypass` | ❌ Node.js only | Not RN compatible |

**Conclusion**: No turnkey React Native Cloudflare bypass library exists. WebView-based custom implementation is the only viable option.

### 2.3 Community Approaches

From analyzing similar apps:

1. **Tachiyomi-J2K, Neko**: Same interceptor pattern as yokai
2. **Kotatsu**: Similar WebView bypass with Kotlin coroutines
3. **Novel reader apps**: Most use WebView popup for user to solve manually

---

## 3. React Native Specific Constraints

### 3.1 Available Options

| Approach | Feasibility | Complexity | UX Impact |
|----------|-------------|------------|-----------|
| **Visible WebView Modal** | ✅ High | Low | Visible popup |
| **Hidden WebView (opacity: 0)** | 🔶 Medium | Medium | Background |
| **Offscreen WebView** | 🔶 Medium | Medium | Background |
| **Native Module (Android)** | ✅ High | High | Seamless |
| **Headless Browser (Puppeteer)** | ❌ Not possible | N/A | N/A |

### 3.2 WebView Constraints in React Native

```typescript
// React Native WebView CANNOT:
// - Run without being mounted in component tree
// - Share process/context across instances easily
// - Access internal browser APIs (unlike native Android)

// React Native WebView CAN:
// - Be visually hidden (opacity: 0, height: 0)
// - Execute JavaScript and extract cookies
// - Share cookies with @react-native-cookies/cookies (✅ Phase 1 done!)
// - Use same User-Agent as fetchApi (✅ getUserAgent())
```

### 3.3 Advantages from Phase 1

Our completed Phase 1 provides key infrastructure:

```typescript
// Already implemented in Phase 1:
✅ CookieManager.getCookies(url)  // Get cf_clearance
✅ CookieManager.setCookies(url, cookies)  // Save bypass cookies
✅ fetchApi() auto-injects cookies  // Retry with cf_clearance
✅ WebView cookie extraction  // onMessage → CookieManager sync
✅ getUserAgent()  // Consistent UA between WebView and fetch
```

---

## 4. Recommended Approach

### 4.1 Primary: WebView Challenge Solver Modal

**Flow Diagram**:
```
┌────────────────────────────────────────────────────────────────┐
│                     Cloudflare Bypass Flow                     │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  1. fetchApi(url) → Response                                   │
│         │                                                      │
│         ▼                                                      │
│  2. CloudflareDetector.isChallenge(response)?                  │
│         │ Yes                    │ No                          │
│         ▼                        └──→ Return response          │
│  3. CloudflareBypass.solve(url)                                │
│         │                                                      │
│         ▼                                                      │
│  4. Show WebView Modal (or hidden WebView)                     │
│     ┌─────────────────────────────┐                            │
│     │  WebView loads challenge    │                            │
│     │  UA = getUserAgent()        │                            │
│     │                             │                            │
│     │  onNavigationStateChange:   │                            │
│     │    → Check cf_clearance     │                            │
│     │                             │                            │
│     │  onMessage:                 │                            │
│     │    → Extract document.cookie│                            │
│     └─────────────────────────────┘                            │
│         │                                                      │
│         ▼                                                      │
│  5. cf_clearance cookie detected?                              │
│         │ Yes                    │ No (timeout)                │
│         ▼                        └──→ Show error / fallback    │
│  6. CookieManager.setCookies(url, cookies)                     │
│         │                                                      │
│         ▼                                                      │
│  7. Retry fetchApi(url) (cookies auto-injected)                │
│         │                                                      │
│         ▼                                                      │
│  8. Return successful response                                 │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 4.2 Implementation Architecture

```typescript
// src/services/network/CloudflareBypass.ts

interface CloudflareBypassResult {
  success: boolean;
  cookies?: Record<string, string>;
  error?: string;
}

interface CloudflareBypassOptions {
  url: string;
  timeout?: number;  // Default: 30000ms
  hidden?: boolean;  // Default: false (show modal)
  userAgent?: string;
}

class CloudflareBypass {
  /**
   * Detect if a response is a Cloudflare challenge
   */
  static isCloudflareChallenge(response: Response): boolean {
    if (![403, 503].includes(response.status)) return false;
    
    const server = response.headers.get('Server') || '';
    return server.includes('cloudflare');
  }

  /**
   * Solve Cloudflare challenge via WebView
   * Returns true if cf_clearance cookie obtained
   */
  static async solve(options: CloudflareBypassOptions): Promise<CloudflareBypassResult> {
    // Implementation will use React Native WebView
    // See Section 5 for detailed implementation
  }
}
```

### 4.3 Alternative: Fallback Manual WebView

For challenges requiring human interaction (CAPTCHA):

```typescript
// If automatic bypass fails, show visible WebView modal
async function manualBypass(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Open existing WebviewScreen with special mode
    navigation.navigate('WebviewScreen', {
      url,
      mode: 'cloudflare-bypass',  // New mode flag
      onBypassComplete: (success: boolean) => resolve(success),
    });
  });
}
```

---

## 5. Implementation Considerations

### 5.1 Key Files to Modify

| File | Changes | Priority |
|------|---------|----------|
| `src/services/network/CloudflareBypass.ts` | **NEW** - Bypass service | P0 |
| `src/services/network/CloudflareDetector.ts` | **NEW** - Challenge detection | P0 |
| `src/plugins/helpers/fetch.ts` | Add Cloudflare interceptor | P0 |
| `src/components/CloudflareWebView.tsx` | **NEW** - Hidden/modal WebView | P0 |
| `src/screens/WebviewScreen/WebviewScreen.tsx` | Add bypass mode | P1 |
| `src/context/CloudflareContext.tsx` | **NEW** - Global bypass state | P1 |

### 5.2 Code Sketch: CloudflareDetector

```typescript
// src/services/network/CloudflareDetector.ts

export class CloudflareDetector {
  private static readonly CLOUDFLARE_STATUS_CODES = [403, 503];
  private static readonly CLOUDFLARE_SERVER_HEADERS = ['cloudflare', 'cloudflare-nginx'];
  private static readonly CF_COOKIE_NAME = 'cf_clearance';

  /**
   * Check if response is a Cloudflare challenge
   */
  static isChallenge(response: Response): boolean {
    // Check status code
    if (!this.CLOUDFLARE_STATUS_CODES.includes(response.status)) {
      return false;
    }

    // Check Server header
    const server = response.headers.get('Server')?.toLowerCase() || '';
    return this.CLOUDFLARE_SERVER_HEADERS.some(cf => server.includes(cf));
  }

  /**
   * Check if we have a valid cf_clearance cookie
   */
  static async hasBypassCookie(url: string): Promise<boolean> {
    const cookies = await CookieManager.getCookies(url);
    return this.CF_COOKIE_NAME in cookies;
  }

  /**
   * Clear cf_clearance cookie (force re-bypass)
   */
  static async clearBypassCookie(url: string): Promise<void> {
    // Implementation using CookieManager
  }
}
```

### 5.3 Code Sketch: Modified fetchApi

```typescript
// src/plugins/helpers/fetch.ts - Enhanced with Cloudflare bypass

import { CloudflareDetector } from '@services/network/CloudflareDetector';
import { CloudflareBypass } from '@services/network/CloudflareBypass';

export const fetchApi = async (
  url: string,
  init?: FetchInit,
): Promise<Response> => {
  init = makeInit(init);

  // STEP 1: Inject cookies (existing Phase 1 code)
  // ... existing cookie injection code ...

  // STEP 2: Make request
  const response = await fetch(url, init);

  // STEP 3: Check for Cloudflare challenge
  if (CloudflareDetector.isChallenge(response)) {
    const bypassResult = await CloudflareBypass.solve({
      url,
      timeout: 30000,
      userAgent: init.headers?.['User-Agent'],
    });

    if (bypassResult.success) {
      // Retry request with new cookies (auto-injected by Phase 1)
      return fetchApi(url, init);
    } else {
      // Return original response if bypass failed
      // UI layer can show error or offer manual bypass
      return response;
    }
  }

  // STEP 4: Save cookies (existing Phase 1 code)
  // ... existing cookie saving code ...

  return response;
};
```

### 5.4 Code Sketch: CloudflareWebView Component

```tsx
// src/components/CloudflareWebView.tsx

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Modal, ActivityIndicator, Text } from 'react-native';
import WebView, { WebViewNavigation } from 'react-native-webview';
import { CookieManager } from '@services/network/CookieManager';
import { getUserAgent } from '@hooks/persisted/useUserAgent';

interface CloudflareWebViewProps {
  url: string;
  visible: boolean;
  hidden?: boolean;  // opacity: 0 mode
  timeout?: number;
  onSuccess: (cookies: Record<string, string>) => void;
  onFailure: (error: string) => void;
  onTimeout: () => void;
}

export const CloudflareWebView: React.FC<CloudflareWebViewProps> = ({
  url,
  visible,
  hidden = false,
  timeout = 30000,
  onSuccess,
  onFailure,
  onTimeout,
}) => {
  const webViewRef = useRef<WebView>(null);
  const [checking, setChecking] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Check for cf_clearance cookie
  const checkBypassCookie = useCallback(async (currentUrl: string) => {
    if (checking) return;
    setChecking(true);

    try {
      const cookies = await CookieManager.getCookies(currentUrl);
      if (cookies.cf_clearance) {
        clearTimeout(timeoutRef.current);
        onSuccess(cookies);
      }
    } catch (error) {
      // Continue waiting
    } finally {
      setChecking(false);
    }
  }, [checking, onSuccess]);

  // Extract cookies via injected JavaScript
  const injectCookieExtraction = `
    (function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'cf_cookies',
        url: window.location.href,
        cookies: document.cookie
      }));
    })();
    true;
  `;

  const handleMessage = useCallback(async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'cf_cookies' && data.cookies) {
        const cookies: Record<string, string> = {};
        data.cookies.split(';').forEach((c: string) => {
          const [name, value] = c.trim().split('=');
          if (name && value) cookies[name] = value;
        });

        if (cookies.cf_clearance) {
          await CookieManager.setCookies(url, cookies);
          clearTimeout(timeoutRef.current);
          onSuccess(cookies);
        }
      }
    } catch {}
  }, [url, onSuccess]);

  const handleNavigationChange = useCallback((navState: WebViewNavigation) => {
    if (!navState.loading) {
      // Page loaded, inject cookie extraction
      webViewRef.current?.injectJavaScript(injectCookieExtraction);
      checkBypassCookie(navState.url);
    }
  }, [checkBypassCookie]);

  // Setup timeout
  useEffect(() => {
    if (visible) {
      timeoutRef.current = setTimeout(() => {
        onTimeout();
      }, timeout);

      return () => clearTimeout(timeoutRef.current);
    }
  }, [visible, timeout, onTimeout]);

  const containerStyle = hidden 
    ? styles.hiddenContainer 
    : styles.visibleContainer;

  const webViewComponent = (
    <WebView
      ref={webViewRef}
      source={{ uri: url }}
      userAgent={getUserAgent()}  // Critical: Same UA as fetchApi
      javaScriptEnabled={true}
      domStorageEnabled={true}
      onNavigationStateChange={handleNavigationChange}
      onMessage={handleMessage}
      style={hidden ? styles.hiddenWebView : styles.webView}
    />
  );

  if (hidden) {
    return visible ? (
      <View style={styles.hiddenContainer}>
        {webViewComponent}
      </View>
    ) : null;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.modalContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Verifying Connection...</Text>
          <ActivityIndicator size="small" />
        </View>
        {webViewComponent}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  hiddenContainer: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
  hiddenWebView: {
    width: 1,
    height: 1,
  },
  visibleContainer: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  webView: {
    flex: 1,
  },
});
```

### 5.5 Estimated Effort

| Session | Goal | Effort | Risk |
|---------|------|--------|------|
| **Session 6** | CloudflareDetector + CloudflareBypass skeleton | 3 hours | LOW |
| **Session 7** | CloudflareWebView component (hidden + modal) | 4 hours | MEDIUM |
| **Session 8** | fetchApi integration + testing | 3 hours | MEDIUM |
| **Total** | | **10 hours** | |

### 5.6 Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Hidden WebView doesn't solve JS challenge | Medium | High | Fallback to visible modal |
| Cookie sync timing issues | Low | Medium | Polling + multiple extraction attempts |
| Cloudflare updates break detection | Medium | Medium | Body-based fallback detection |
| Memory leaks from WebView | Low | Medium | Proper cleanup in useEffect |
| User-Agent mismatch | Low | High | Always use `getUserAgent()` |

---

## 6. Open Questions

### 6.1 Requires Further Investigation

1. **Hidden WebView Effectiveness**
   - Does `opacity: 0` WebView successfully execute Cloudflare JS challenges?
   - Needs real-world testing with Cloudflare-protected sources

2. **Cookie Sync Timing**
   - How quickly do cookies appear in `CookieManager.getCookies()` after WebView sets them?
   - May need polling interval (e.g., check every 500ms)

3. **Challenge Type Detection**
   - Can we distinguish JS challenge from CAPTCHA challenge?
   - Might need body content analysis

4. **Cross-Platform Behavior**
   - Does iOS WKWebView handle Cloudflare challenges the same as Android?
   - Needs iOS-specific testing

5. **Rate Limiting by Cloudflare**
   - Will frequent bypass attempts trigger stricter challenges?
   - May need cooldown/backoff logic

### 6.2 Future Enhancements (Post-MVP)

- [ ] Automatic retry with exponential backoff
- [ ] Challenge type classification (JS vs CAPTCHA)
- [ ] Per-source bypass cookie caching
- [ ] Analytics: bypass success rate per source
- [ ] Background pre-emptive bypass (before cookies expire)

---

## 7. Appendix: Cloudflare Technical Details

### 7.1 cf_clearance Cookie Format

```
cf_clearance=<base64_token>; Path=/; Domain=.example.com; 
Expires=<timestamp>; HttpOnly; Secure; SameSite=None
```

### 7.2 Challenge Page Detection (Body Patterns)

```html
<!-- Cloudflare JS Challenge -->
<title>Just a moment...</title>
<div id="cf-content">Please wait...</div>
<script src="/cdn-cgi/challenge-platform/..."></script>

<!-- Cloudflare CAPTCHA -->
<div class="cf-turnstile"></div>
<iframe src="https://challenges.cloudflare.com/..."></iframe>
```

### 7.3 Cloudflare Headers

```http
HTTP/1.1 403 Forbidden
Server: cloudflare
CF-RAY: 1234567890abcdef-LAX
CF-Cache-Status: DYNAMIC
CF-Mitigated: challenge
```

---

## 8. Conclusion

**Recommended Implementation Path**:

1. ✅ Phase 1 Complete: Cookie infrastructure ready
2. 🔜 Session 6: Implement `CloudflareDetector` + `CloudflareBypass` service
3. 🔜 Session 7: Build `CloudflareWebView` component (modal + hidden modes)
4. 🔜 Session 8: Integrate with `fetchApi()` + comprehensive testing

**Success Criteria for Phase 2**:
- [ ] Automatic detection of Cloudflare challenges (403/503 + Server header)
- [ ] Background WebView bypass for JS challenges (≤30 seconds)
- [ ] Fallback modal for interactive challenges
- [ ] cf_clearance cookie persisted via Phase 1 CookieManager
- [ ] Subsequent requests use bypass cookies automatically
- [ ] Zero code changes required for plugin developers

---

*This research report should be reviewed and updated after real-world testing with Cloudflare-protected sources.*
