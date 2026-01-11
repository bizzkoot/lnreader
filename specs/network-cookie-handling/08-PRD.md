# PRD: Network & Cookie Handling Enhancement

**Date**: January 1, 2026
**Product**: LNReader (React Native)
**Version**: 1.0.0
**Status**: Draft

---

## Document Control

| Version | Date       | Author       | Changes                             |
| ------- | ---------- | ------------ | ----------------------------------- |
| 1.0     | 2026-01-01 | AI Assistant | Initial PRD based on yokai research |

---

## 1. Executive Summary

### Problem Statement

LNReader currently lacks automatic cookie persistence, Cloudflare bypass, and DNS over HTTPS (DoH) support. Plugin developers must manually manage cookies, users face frequent login requirements, and Cloudflare-protected sources fail to load.

### Solution

Implement yokai-inspired network and cookie handling architecture in LNReader:

1. **Automatic cookie persistence** (Phase 1)
2. **Transparent Cloudflare bypass** (Phase 2)
3. **DNS over HTTPS support** (Phase 3)

### Business Value

- **Improved User Experience**: No re-login on app restart
- **Better Plugin Compatibility**: Cloudflare-protected sources work out-of-the-box
- **Enhanced Privacy**: Encrypted DNS queries via DoH
- **Reduced Plugin Maintenance**: Zero cookie management code for plugin developers

### Success Metrics

- **User Retention**: +15% (fewer login frustrations)
- **Plugin Success Rate**: +25% (Cloudflare sources work)
- **User Satisfaction**: 4.5/5 stars (privacy features)

---

## 2. Background & Context

### Current State

LNReader uses React Native's `fetch()` API with the following limitations:

| Feature             | Current Status              | User Impact                                          |
| ------------------- | --------------------------- | ---------------------------------------------------- |
| Cookie Persistence  | ❌ No automatic persistence | Must re-login on app restart                         |
| WebView Cookie Sync | ❌ No automatic sync        | Login in WebView doesn't persist to fetch()          |
| Cloudflare Bypass   | ❌ No support               | Cloudflare-protected sources fail                    |
| DoH Support         | ❌ System DNS only          | No privacy enhancement                               |
| Interceptors        | ❌ No built-in support      | Request/response hooks require manual implementation |

### yokai Research Findings

Yokai (native Android) implements:

- ✅ Automatic cookie persistence via `AndroidCookieJar`
- ✅ Transparent Cloudflare bypass via `WebViewInterceptor`
- ✅ DoH support with 12 providers
- ✅ Modular interceptor chain architecture

**Key Insight**: Yokai's success is due to leveraging native Android APIs for seamless integration.

### LNReader Constraints

- **Platform**: React Native 0.82.1
- **Plugin System**: JavaScript plugins loaded at runtime
- **Existing Infrastructure**: WebViewReader component for TTS
- **Development Resources**: 1 developer (estimated)

---

## 3. Requirements

### 3.1 Phase 1: Cookie Persistence (High Priority)

#### Functional Requirements

| ID     | Requirement                        | Priority | Acceptance Criteria                               |
| ------ | ---------------------------------- | -------- | ------------------------------------------------- |
| CP-001 | Automatic cookie persistence       | P0       | Cookies saved after app restart without re-login  |
| CP-002 | Cookie storage across app sessions | P0       | Cookies persist for configured expiry time        |
| CP-003 | WebView cookie extraction          | P0       | Cookies set in WebView are available to fetch()   |
| CP-004 | Cookie injection to fetch()        | P0       | Cookies are included in fetch() requests          |
| CP-005 | Cookie expiry handling             | P1       | Expired cookies are removed automatically         |
| CP-006 | Secure/HttpOnly cookie support     | P1       | Secure cookies respected, HttpOnly flags honored  |
| CP-007 | Cookie CRUD operations             | P2       | Get, set, remove cookies by domain/path           |
| CP-008 | Clear all cookies                  | P2       | User can clear all cookies globally or per-domain |

#### Non-Functional Requirements

| ID     | Requirement          | Metric  | Target                    |
| ------ | -------------------- | ------- | ------------------------- |
| CP-N01 | Cookie read latency  | <10ms   | 95th percentile           |
| CP-N02 | Cookie write latency | <15ms   | 95th percentile           |
| CP-N03 | Cookie storage size  | <1MB    | Typical user (50 cookies) |
| CP-N04 | Memory overhead      | <5MB    | Runtime                   |
| CP-N05 | Security encryption  | AES-256 | Encrypted at rest         |

#### User Stories

| ID     | Story                                                                                                                              | Priority |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- | -------- |
| CP-US1 | As a user, I want my login session to persist across app restarts so I don't have to re-login every time.                          | P0       |
| CP-US2 | As a plugin developer, I want cookies to be automatically included in my fetch() requests so I don't have to manage them manually. | P0       |
| CP-US3 | As a user, I want to clear all cookies when I log out so my session is terminated.                                                 | P1       |
| CP-US4 | As a user, I want my cookies to be secure and encrypted so they can't be stolen.                                                   | P1       |

---

### 3.2 Phase 2: Cloudflare Bypass (Medium Priority)

#### Functional Requirements

| ID     | Requirement                    | Priority | Acceptance Criteria                                     |
| ------ | ------------------------------ | -------- | ------------------------------------------------------- |
| CB-001 | Automatic Cloudflare detection | P0       | Detect 403/503 responses with Server: cloudflare header |
| CB-002 | Background WebView bypass      | P0       | Challenge solved in hidden WebView without blocking UI  |
| CB-003 | cf_clearance cookie detection  | P0       | Wait for cf_clearance cookie before retry               |
| CB-004 | Automatic request retry        | P0       | Retry original request with new cookies                 |
| CB-005 | Timeout handling               | P1       | Fail gracefully if challenge not solved in 30 seconds   |
| CB-006 | Fallback to manual WebView     | P1       | Show WebView modal if automatic bypass fails            |
| CB-007 | Bypass disable option          | P2       | Users can disable automatic bypass in settings          |

#### Non-Functional Requirements

| ID     | Requirement                 | Metric       | Target                |
| ------ | --------------------------- | ------------ | --------------------- |
| CB-N01 | WebView initialization time | <2s          | First load            |
| CB-N02 | Challenge solve time        | <10s         | 95th percentile       |
| CB-N03 | Memory overhead             | <10MB        | Per bypass            |
| CB-N04 | User experience             | Non-blocking | Background processing |

#### User Stories

| ID     | Story                                                                                            | Priority |
| ------ | ------------------------------------------------------------------------------------------------ | -------- |
| CB-US1 | As a user, I want Cloudflare-protected sources to work automatically without seeing error pages. | P0       |
| CB-US2 | As a user, I want to see a loading indicator while Cloudflare challenge is being solved.         | P1       |
| CB-US3 | As a plugin developer, I don't want to handle Cloudflare challenges manually in my code.         | P0       |
| CB-US4 | As a user, I want to disable automatic Cloudflare bypass if it causes issues.                    | P2       |

---

### 3.3 Phase 3: DNS over HTTPS (Low Priority)

#### Functional Requirements

| ID      | Requirement            | Priority | Acceptance Criteria                     |
| ------- | ---------------------- | -------- | --------------------------------------- |
| DOH-001 | DoH provider selection | P0       | Users can select DoH provider from list |
| DOH-002 | Minimum 3 providers    | P0       | Cloudflare, Google, AdGuard             |
| DOH-003 | DoH enable/disable     | P0       | Users can toggle DoH on/off             |
| DOH-004 | Fallback to system DNS | P1       | Use system DNS if DoH fails             |
| DOH-005 | Additional providers   | P2       | Quad9, Mullvad, etc. (optional)         |
| DOH-006 | Bootstrap DNS          | P2       | Prevent circular dependencies           |

#### Non-Functional Requirements

| ID      | Requirement          | Metric | Target                |
| ------- | -------------------- | ------ | --------------------- |
| DOH-N01 | DoH query latency    | <100ms | 95th percentile       |
| DOH-N02 | Fallback reliability | >99%   | System DNS uptime     |
| DOH-N03 | Privacy encryption   | HTTPS  | All queries encrypted |

#### User Stories

| ID      | Story                                                                                | Priority |
| ------- | ------------------------------------------------------------------------------------ | -------- |
| DOH-US1 | As a user, I want to enable DNS over HTTPS to encrypt my DNS queries for privacy.    | P0       |
| DOH-US2 | As a user, I want to select my preferred DoH provider (Cloudflare, Google, AdGuard). | P0       |
| DOH-US3 | As a user, I want DNS queries to work even if my DoH provider is blocked (fallback). | P1       |

---

## 4. Technical Architecture

### 4.1 System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    LNReader App                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Plugin System (JavaScript)             │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │   │
│  │  │ Plugin A │  │ Plugin B │  │ Plugin C │  │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  │   │
│  └───────┼────────────┼────────────┼─────────┘   │
│          │            │            │                   │
│          └────────────┼────────────┘                   │
│                       │                                │
│                       ▼                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Enhanced HttpClient (Native Module)       │   │
│  │                                                     │   │
│  │  ┌───────────────────────────────────────────┐   │   │
│  │  │          Interceptor Chain               │   │   │
│  │  │  1. CookieInterceptor (native)       │   │   │
│  │  │  2. CloudflareInterceptor (native)    │   │   │
│  │  │  3. RateLimitInterceptor (native)    │   │   │
│  │  └───────────────────────────────────────────┘   │   │
│  │                                                     │   │
│  │  ┌───────────────────────────────────────────┐   │   │
│  │  │          Native Modules                │   │   │
│  │  │  • CookieManager (Android/iOS)       │   │   │
│  │  │  • DoHResolver (Android/iOS)          │   │   │
│  │  │  • WebViewCookieSync (Android/iOS)    │   │   │
│  │  └───────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              WebView Component                   │   │
│  │  • Cloudflare bypass (background)             │   │
│  │  • Cookie extraction                          │   │
│  │  • User authentication (manual)                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Native Modules

#### CookieManager Module

**Purpose**: Manage cookie persistence and operations

**Android Implementation**:

```kotlin
@ReactModule(name = "CookieManager")
class CookieManagerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule() {

    @ReactMethod
    fun getCookies(url: String, promise: Promise) {
        val cookieManager = CookieManager.getInstance()
        val cookies = cookieManager.getCookie(url)
        promise.resolve(cookies)
    }

    @ReactMethod
    fun setCookies(url: String, cookies: String, promise: Promise) {
        val cookieManager = CookieManager.getInstance()
        cookieManager.setCookie(url, cookies)
        promise.resolve(null)
    }

    @ReactMethod
    fun removeCookies(url: String, names: ReadableArray, promise: Promise) {
        // Implementation...
        promise.resolve(null)
    }

    @ReactMethod
    fun clearAll(promise: Promise) {
        val cookieManager = CookieManager.getInstance()
        cookieManager.removeAllCookies { }
        promise.resolve(null)
    }
}
```

**iOS Implementation**:

```swift
@objc(CookieManager)
class CookieManager: NSObject {

    @objc(getCookies:resolver:)
    func getCookies(url: String, resolver: @escaping RCTPromiseResolveBlock) {
        guard let url = URL(string: url) else {
            return resolver([])
        }

        if let cookies = HTTPCookieStorage.shared.cookies(for: url) {
            let cookieStrings = cookies.map { $0.name + "=" + $0.value }
            resolver(cookieStrings)
        } else {
            resolver([])
        }
    }

    @objc(setCookies:url:resolver:)
    func setCookies(cookies: String, url: String, resolver: @escaping RCTPromiseResolveBlock) {
        // Implementation...
        resolver(nil)
    }
}
```

**JavaScript Interface**:

```typescript
import { NativeModules } from 'react-native';

interface CookieManagerInterface {
  getCookies(url: string): Promise<string>;
  setCookies(url: string, cookies: string): Promise<void>;
  removeCookies(url: string, names: string[]): Promise<void>;
  clearAll(): Promise<void>;
}

const CookieManager = NativeModules.CookieManager as CookieManagerInterface;
```

---

#### DoHResolver Module

**Purpose**: Resolve DNS queries via DNS over HTTPS

**Android Implementation** (using OkHttp):

```kotlin
@ReactModule(name = "DoHResolver")
class DoHResolverModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule() {

    @ReactMethod
    fun resolve(hostname: String, provider: String, promise: Promise) {
        val dohUrl = when (provider) {
            "cloudflare" -> "https://cloudflare-dns.com/dns-query"
            "google" -> "https://dns.google/dns-query"
            "adguard" -> "https://dns-unfiltered.adguard.com/dns-query"
            else -> "https://cloudflare-dns.com/dns-query"
        }

        val dnsClient = OkHttpClient.Builder()
            .dns(DnsOverHttps.Builder().client(OkHttpClient())
                .url(dohUrl.toHttpUrl())
                .build())
            .build()

        GlobalScope.launch(Dispatchers.IO) {
            try {
                val addresses = dnsClient.dns(hostname)
                val ipAddresses = addresses.map { it.hostAddress }
                promise.resolve(Arguments.fromList(ipAddresses))
            } catch (e: Exception) {
                promise.reject("DNS_ERROR", e.message)
            }
        }
    }
}
```

**JavaScript Interface**:

```typescript
import { NativeModules } from 'react-native';

interface DoHResolverInterface {
  resolve(hostname: string, provider: string): Promise<string[]>;
}

const DoHResolver = NativeModules.DoHResolver as DoHResolverInterface;

// Usage
const ips = await DoHResolver.resolve('example.com', 'cloudflare');
```

---

#### WebViewCookieSync Module

**Purpose**: Extract cookies from React Native WebView

**Implementation**:

```typescript
import { WebView } from 'react-native-webview';

class WebViewCookieSync {
  async getCookiesFromWebView(
    webViewRef: React.RefObject<WebView>,
    url: string,
  ): Promise<Cookie[]> {
    return new Promise(resolve => {
      webViewRef.current?.injectJavaScript(`
        (function() {
          const cookies = document.cookie.split(';').map(cookie => {
            const [name, value] = cookie.trim().split('=');
            return { name, value };
          });
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'cookies',
            data: cookies
          }));
        })();
      `);

      const handleMessage = (event: any) => {
        const { type, data } = JSON.parse(event.nativeEvent.data);
        if (type === 'cookies') {
          resolve(data);
          webView.removeEventListener('message', handleMessage);
        }
      };

      webView.addEventListener('message', handleMessage);
    });
  }
}
```

---

### 4.3 Enhanced HTTP Client

**Purpose**: Wrapper around fetch() with interceptor support

```typescript
import { CookieManager } from './modules/CookieManager';
import { DoHResolver } from './modules/DoHResolver';

class HttpClient {
  private interceptors: Interceptor[] = [];
  private dohEnabled = false;
  private dohProvider = 'cloudflare';

  addInterceptor(interceptor: Interceptor) {
    this.interceptors.push(interceptor);
  }

  setDoH(enabled: boolean, provider: string) {
    this.dohEnabled = enabled;
    this.dohProvider = provider;
  }

  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    // Phase 1: Apply request interceptors
    for (const interceptor of this.interceptors) {
      const result = await interceptor.request?.(url, options);
      if (result) {
        url = result.url ?? url;
        options = result.options ?? options;
      }
    }

    // Phase 2: Resolve DNS via DoH if enabled
    if (this.dohEnabled) {
      try {
        const hostname = new URL(url).hostname;
        const ips = await DoHResolver.resolve(hostname, this.dohProvider);
        // Use resolved IP in request (implementation depends on fetch() capabilities)
      } catch (error) {
        console.warn(
          'DoH resolution failed, falling back to system DNS:',
          error,
        );
      }
    }

    // Phase 3: Inject cookies
    const cookies = await CookieManager.getCookies(url);
    if (cookies) {
      options.headers = new Headers(options.headers);
      options.headers.set('Cookie', cookies);
    }

    // Phase 4: Make request
    let response = await fetch(url, options);

    // Phase 5: Parse and save cookies
    const setCookieHeaders = response.headers.getSetCookie?.() || [];
    for (const cookie of setCookieHeaders) {
      await CookieManager.setCookies(url, cookie);
    }

    // Phase 6: Apply response interceptors
    for (const interceptor of this.interceptors) {
      const result = await interceptor.response?.(response);
      if (result) {
        response = result;
      }
    }

    return response;
  }
}

// Cookie interceptor (automatic)
const cookieInterceptor: Interceptor = {
  request: async (url, options) => {
    // Inject cookies automatically (handled in HttpClient.fetch)
    return null;
  },
  response: async response => {
    // Save cookies automatically (handled in HttpClient.fetch)
    return response;
  },
};

// Cloudflare interceptor
const cloudflareInterceptor: Interceptor = {
  request: async (url, options) => null,
  response: async response => {
    if (
      [403, 503].includes(response.status) &&
      response.headers.get('Server')?.includes('cloudflare')
    ) {
      // Trigger Cloudflare bypass
      await cloudflareBypass.bypass(url, options);
      // Retry request
      return await client.fetch(url, options);
    }
    return response;
  },
};

// Create client with interceptors
const client = new HttpClient();
client.addInterceptor(cookieInterceptor);
client.addInterceptor(cloudflareInterceptor);
```

---

## 5. Implementation Plan

### 5.1 Phase 1: Cookie Persistence (2-3 weeks)

#### Sprint 1: Core Cookie Management (Week 1)

- [ ] **Task 1.1**: Create CookieManager native module (Android)
  - Implement `getCookies()`, `setCookies()`, `removeCookies()`, `clearAll()`
  - Use Android's `CookieManager` API
  - Write unit tests

- [ ] **Task 1.2**: Create CookieManager native module (iOS)
  - Implement `getCookies()`, `setCookies()`, `removeCookies()`, `clearAll()`
  - Use iOS's `HTTPCookieStorage` API
  - Write unit tests

- [ ] **Task 1.3**: Create JavaScript interface
  - Define TypeScript types
  - Create wrapper functions
  - Write integration tests

#### Sprint 2: WebView Integration (Week 2)

- [ ] **Task 1.4**: Implement WebView cookie extraction
  - Create `WebViewCookieSync` class
  - Test cookie extraction from WebView
  - Test cookie injection to WebView

- [ ] **Task 1.5**: Integrate with WebViewReader
  - Update WebViewReader component to sync cookies
  - Test cookie sync after page loads
  - Test cookie sync after user login

#### Sprint 3: HTTP Client Integration (Week 2-3)

- [ ] **Task 1.6**: Create enhanced HttpClient
  - Implement fetch wrapper with interceptor support
  - Implement automatic cookie injection
  - Implement automatic cookie saving

- [ ] **Task 1.7**: Update plugin system
  - Replace fetch() with enhanced client
  - Test with existing plugins
  - Ensure backward compatibility

- [ ] **Task 1.8**: Testing & Bug Fixes
  - Write E2E tests for cookie persistence
  - Test with multiple plugins
  - Fix bugs

---

### 5.2 Phase 2: Cloudflare Bypass (1-2 weeks)

#### Sprint 4: Cloudflare Detection (Week 1)

- [ ] **Task 2.1**: Implement Cloudflare interceptor
  - Detect 403/503 responses
  - Check Server header for cloudflare
  - Write unit tests

- [ ] **Task 2.2**: Create background WebView
  - Implement hidden WebView for bypass
  - Implement loading indicator
  - Test WebView initialization

#### Sprint 5: Challenge Resolution (Week 1-2)

- [ ] **Task 2.3**: Implement challenge detection
  - Monitor WebView navigation
  - Monitor for cf_clearance cookie
  - Implement 30-second timeout

- [ ] **Task 2.4**: Implement request retry
  - Retry original request with new cookies
  - Handle retry limit (max 3 attempts)
  - Write unit tests

- [ ] **Task 2.5**: Fallback mechanism
  - Show modal WebView if automatic bypass fails
  - Allow manual Cloudflare solve
  - Test user experience

- [ ] **Task 2.6**: Testing & Bug Fixes
  - Test with real Cloudflare-protected sites
  - Test timeout scenarios
  - Fix bugs

---

### 5.3 Phase 3: DoH Support (3-4 weeks)

#### Sprint 6: DoH Module (Week 1-2)

- [ ] **Task 3.1**: Create DoHResolver native module (Android)
  - Implement `resolve()` using OkHttp DNS module
  - Support 3 minimum providers (Cloudflare, Google, AdGuard)
  - Write unit tests

- [ ] **Task 3.2**: Create DoHResolver native module (iOS)
  - Implement `resolve()` using NWConnection or native DNS
  - Support 3 minimum providers
  - Write unit tests

- [ ] **Task 3.3**: Implement bootstrap DNS fallback
  - Add hardcoded IPs for DoH providers
  - Fallback to system DNS if DoH fails
  - Write unit tests

#### Sprint 7: Configuration UI (Week 2-3)

- [ ] **Task 3.4**: Create DoH settings screen
  - Provider selection dropdown
  - Enable/disable toggle
  - Test connection button

- [ ] **Task 3.5**: Integrate with HTTP client
  - Add DoH resolution to fetch wrapper
  - Implement fallback to system DNS
  - Test with different providers

- [ ] **Task 3.6**: Testing & Bug Fixes
  - Test DoH resolution with different providers
  - Test fallback mechanism
  - Fix bugs

---

## 6. Testing Strategy

### 6.1 Unit Tests

**CookieManager Module**:

- `getCookies()`: Test retrieval for different URLs
- `setCookies()`: Test cookie setting and persistence
- `removeCookies()`: Test cookie removal by name
- `clearAll()`: Test global cookie clearing

**DoHResolver Module**:

- `resolve()`: Test resolution with different providers
- `resolve()`: Test bootstrap DNS fallback
- `resolve()`: Test system DNS fallback

**HttpClient**:

- `fetch()`: Test cookie injection
- `fetch()`: Test cookie saving
- `fetch()`: Test interceptor chain

### 6.2 Integration Tests

**Cookie Persistence**:

- Test cookie persistence across app restart
- Test cookie sync between WebView and fetch()
- Test cookie expiry handling

**Cloudflare Bypass**:

- Test automatic Cloudflare detection
- Test background WebView bypass
- Test request retry with new cookies

**DoH Resolution**:

- Test DoH resolution with different providers
- Test fallback to system DNS
- Test with network errors

### 6.3 E2E Tests

**End-to-End Workflows**:

1. User logs in via WebView → Cookies persist across app restart
2. User navigates to Cloudflare-protected source → Automatic bypass works
3. User enables DoH → All DNS queries use DoH
4. User clears cookies → All cookies removed

---

## 7. Deployment Plan

### 7.1 Phase 1 Deployment

**Alpha Release** (Internal Testing):

- Cookie persistence for a subset of plugins
- WebView cookie sync
- Gather feedback from internal team

**Beta Release** (Closed Beta):

- Cookie persistence for all plugins
- Enhanced HTTP client
- Invite 50 beta testers
- Gather bug reports and feedback

**Public Release** (v1.0.0):

- Full cookie persistence feature
- Update documentation
- Release notes

### 7.2 Phase 2 Deployment

**Alpha Release** (Internal Testing):

- Cloudflare bypass for a subset of sources
- Background WebView
- Gather feedback

**Beta Release** (Closed Beta):

- Cloudflare bypass for all sources
- Fallback to manual WebView
- Invite 50 beta testers

**Public Release** (v1.1.0):

- Full Cloudflare bypass feature
- Update documentation
- Release notes

### 7.3 Phase 3 Deployment

**Alpha Release** (Internal Testing):

- DoH support with 3 providers
- Configuration UI
- Gather feedback

**Beta Release** (Closed Beta):

- DoH support with additional providers
- Performance optimizations
- Invite 50 beta testers

**Public Release** (v1.2.0):

- Full DoH support feature
- Update documentation
- Release notes

---

## 8. Risk Assessment

| Risk                                                       | Likelihood | Impact | Mitigation                                             |
| ---------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------ |
| Cookie security vulnerability (unencrypted storage)        | Medium     | High   | Implement AES-256 encryption for sensitive cookies     |
| Cloudflare bypass fails (JavaScript challenge too complex) | Low        | Medium | Provide fallback to manual WebView                     |
| DoH provider blocked in certain regions                    | High       | Low    | Support multiple providers with fallback to system DNS |
| Performance degradation (cookie operations add latency)    | Medium     | Low    | Implement in-memory cache for frequent reads           |
| Native module bugs (crashes)                               | Low        | High   | Comprehensive unit testing + try-catch blocks          |
| WebView memory leak (not properly destroyed)               | Low        | Medium | Proper cleanup in componentWillUnmount                 |
| DoH latency higher than system DNS                         | Medium     | Low    | Timeout handling + fallback to system DNS              |

---

## 9. Success Criteria

### Phase 1 Success

- [ ] Cookies persist across app restart (manual verification)
- [ ] WebView cookies sync to fetch() (E2E test pass)
- [ ] Plugin developers don't need to manage cookies (code review)
- [ ] Cookie storage encrypted (security audit)
- [ ] Performance impact <5% (benchmarking)

### Phase 2 Success

- [ ] Cloudflare-protected sources work automatically (E2E test pass)
- [ ] Background WebView doesn't block UI (manual verification)
- [ ] Fallback to manual WebView works (manual verification)
- [ ] Performance impact <10% during bypass (benchmarking)

### Phase 3 Success

- [ ] DoH queries resolve correctly (E2E test pass)
- [ ] Fallback to system DNS works (E2E test pass)
- [ ] Configuration UI works (manual verification)
- [ ] Performance impact <100ms per query (benchmarking)

---

## 10. Appendix

### 10.1 Terminology

| Term                     | Definition                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| **DoH**                  | DNS over HTTPS - Encrypted DNS resolution via HTTPS                                             |
| **Cloudflare Challenge** | JavaScript-based anti-bot protection used by Cloudflare                                         |
| **cf_clearance**         | Cookie set by Cloudflare after challenge is solved                                              |
| **Native Module**        | React Native module written in native code (Kotlin/Java for Android, Swift/Objective-C for iOS) |
| **Interceptor**          | Middleware that intercepts and modifies requests/responses                                      |

### 10.2 References

- [Yokai Network Research](./06-SUMMARY.md)
- [Yokai Code Snippets](./04-CODE_SNIPPETS.md)
- [React Native Documentation](https://reactnative.dev/docs/network)
- [React Native WebView](https://github.com/react-native-webview/react-native-webview)
- [OkHttp Documentation](https://square.github.io/okhttp/)
- [Cookie Specification](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
- [DNS over HTTPS RFC](https://datatracker.ietf.org/doc/html/rfc8484)

---

## 11. Approval

| Role             | Name | Date | Signature |
| ---------------- | ---- | ---- | --------- |
| Product Owner    |      |      |           |
| Engineering Lead |      |      |           |
| QA Lead          |      |      |           |
| Security Review  |      |      |           |

---

**Document Status**: Draft - Pending Approval
