# Summary: Yokai Network & Cookie Handling Research

**Date**: January 1, 2026
**Research Subject**: yokai (null2264/yokai) network architecture

---

## Executive Summary

Yokai implements a **production-grade network layer** using native Android APIs (OkHttp 5.0.0-alpha.16, WebView CookieManager, DNS over HTTPS) that provides **automatic cookie persistence**, **transparent Cloudflare bypass**, and **comprehensive DNS configuration**.

### Key Findings

| Aspect                 | Yokai Implementation                           | Comparison to React Native        |
| ---------------------- | ---------------------------------------------- | --------------------------------- |
| **Cookie Persistence** | Automatic via AndroidCookieJar + CookieManager | ❌ No built-in support            |
| **Cloudflare Bypass**  | Transparent WebView-based interceptor          | ❌ Requires manual implementation |
| **DoH Support**        | 12 providers built-in                          | ❌ System DNS only                |
| **Interceptors**       | Modular chain architecture                     | ❌ No built-in support            |
| **Caching**            | 5 MiB disk cache with 10-min TTL               | 🟡 Limited                        |
| **Compression**        | Gzip + Brotli (automatic)                      | 🟡 Varies by platform             |

**Overall Assessment**: Yokai's network layer is **significantly more sophisticated** than React Native's fetch() API. Implementing equivalent functionality in React Native requires substantial native module development (estimated **6-9 weeks**).

---

## Key Takeaways

### 1. Automatic Cookie Persistence

**Yokai Approach**:

```kotlin
// One line of code
val client = OkHttpClient.Builder()
    .cookieJar(AndroidCookieJar())  // ← Automatic!
    .build()
```

**Why It Matters**:

- Zero boilerplate for extension developers
- Automatic persistence across app restarts
- Bidirectional sync with WebView
- Support for Secure/HttpOnly flags

**React Native Gap**:

- No built-in cookie persistence
- Requires manual implementation (AsyncStorage, MMKV, or encrypted storage)
- No automatic WebView sync
- ~4x more code required

---

### 2. Transparent Cloudflare Bypass

**Yokai Approach**:

- Automatically detects Cloudflare challenges (403/503 + Server header)
- Loads URL in background WebView
- Waits for `cf_clearance` cookie
- Retries request with new cookies
- **Transparent to extension developers** (no code changes needed)

**Why It Matters**:

- Extension developers don't need to handle Cloudflare
- User experience is seamless (no blocking UI)
- Cookies automatically persisted via AndroidCookieJar

**React Native Gap**:

- No built-in support
- Requires manual WebView implementation
- Blocking UI (user sees WebView)
- Manual cookie extraction and storage
- Poor user experience

---

### 3. Modular Interceptor Chain

**Yokai Approach**:

```kotlin
val client = OkHttpClient.Builder()
    .addInterceptor(UncaughtExceptionInterceptor())       // 1. Catch crashes
    .addInterceptor(UserAgentInterceptor { userAgent })    // 2. Add UA
    .addInterceptor(CloudflareInterceptor(...))         // 3. Cloudflare
    .addNetworkInterceptor(IgnoreGzipInterceptor())      // 4. Gzip
    .addNetworkInterceptor(BrotliInterceptor())           // 5. Brotli
    .addInterceptor(RateLimitInterceptor())             // 6. Rate limit
    .build()
```

**Why It Matters**:

- Modular architecture (easy to add/remove features)
- Reusable interceptors
- Type-safe (Kotlin compile-time validation)
- Single shared client for all extensions

**React Native Gap**:

- No built-in interceptors
- Requires manual wrapper implementation
- Less type-safe (TypeScript)
- Harder to share across codebase

---

### 4. Comprehensive DoH Support

**Yokai Approach**:

- 12 DoH providers built-in (Cloudflare, Google, AdGuard, Quad9, AliDNS, DNSPod, 360, Quad101, Mullvad, Control D, Njalla, Shecan)
- Configurable via app preferences
- Bootstrap DNS fallback (prevents circular dependencies)
- Privacy enhancement and censorship bypass

**Why It Matters**:

- Enhanced privacy (DNS queries encrypted)
- Censorship bypass for restricted regions
- Zero configuration required from extensions

**React Native Gap**:

- No built-in DoH support
- System DNS only
- Requires native module development
- Complex cross-platform implementation (Android + iOS)

---

## Technical Highlights

### AndroidCookieJar: The Secret Sauce

The `AndroidCookieJar` class is yokai's key innovation:

```kotlin
class AndroidCookieJar : CookieJar {
    private val manager = CookieManager.getInstance()  // Android's WebView CookieManager

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        cookies.forEach { manager.setCookie(url.toString(), it.toString()) }
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val cookies = manager.getCookie(url.toString())
        return cookies?.split(";")?.mapNotNull { Cookie.parse(url, it) } ?: emptyList()
    }
}
```

**Why This Works**:

- Bridges OkHttp's `CookieJar` interface with Android's `CookieManager`
- Enables **automatic bidirectional sync** between HTTP requests and WebView
- Leverages Android's native cookie persistence (no manual serialization)
- **Zero boilerplate** for extension developers

### CloudflareInterceptor: Invisible to Extensions

The `CloudflareInterceptor` extends `WebViewInterceptor` and handles challenges transparently:

```kotlin
override fun shouldIntercept(response: Response): Boolean {
    return response.code in listOf(403, 503) &&
           response.header("Server") in arrayOf("cloudflare-nginx", "cloudflare")
}

override fun intercept(chain: Interceptor.Chain, request: Request, response: Response): Response {
    // 1. Remove old cf_clearance cookie
    cookieManager.remove(request.url, ["cf_clearance"], 0)

    // 2. Load URL in WebView (solves challenge)
    webView.loadUrl(request.url.toString(), headers)

    // 3. Wait for cf_clearance cookie
    waitForCookie("cf_clearance")

    // 4. Retry request with new cookies
    return chain.proceed(request)
}
```

**Why This Works**:

- Detects Cloudflare challenges automatically
- Uses background WebView (no UI blocking)
- Waits for `cf_clearance` cookie before proceeding
- Retries request with new cookies
- **Extension developers don't need to change any code**

### DoH Providers: Global Configuration

Yokai provides 12 DoH providers via `DohProviders.kt`:

```kotlin
when (preferences.dohProvider().get()) {
    PREF_DOH_CLOUDFLARE -> builder.dohCloudflare()
    PREF_DOH_GOOGLE -> builder.dohGoogle()
    PREF_DOH_ADGUARD -> builder.dohAdGuard()
    PREF_DOH_QUAD9 -> builder.dohQuad9()
    PREF_DOH_ALIDNS -> builder.dohAliDNS()
    PREF_DOH_DNSPOD -> builder.dohDNSPod()
    PREF_DOH_360 -> builder.doh360()
    PREF_DOH_QUAD101 -> builder.dohQuad101()
    PREF_DOH_MULLVAD -> builder.dohMullvad()
    PREF_DOH_CONTROLD -> builder.dohControlD()
    PREF_DOH_NJALLA -> builder.dohNajalla()
    PREF_DOH_SHECAN -> builder.dohShecan()
}
```

**Why This Works**:

- Global configuration (applies to all extensions)
- Privacy enhancement (encrypted DNS queries)
- Censorship bypass (works in restricted regions)
- Bootstrap DNS fallback (prevents circular dependencies)

---

## Comparison: Yokai vs React Native

### Code Complexity

| Feature            | Yokai Lines | RN Lines   | Complexity |
| ------------------ | ----------- | ---------- | ---------- |
| Cookie Persistence | ~50         | ~200+      | 4x         |
| Cloudflare Bypass  | ~150        | ~500+      | 3x         |
| DoH Support        | ~200        | ~1000+     | 5x         |
| **Total**          | **~400**    | **~1700+** | **4x**     |

### Architecture

| Aspect         | Yokai                             | React Native                        |
| -------------- | --------------------------------- | ----------------------------------- |
| HTTP Library   | OkHttp (native Android)           | fetch() (polyfills to native)       |
| Cookie Storage | Android CookieManager (automatic) | AsyncStorage (manual)               |
| WebView Sync   | Native API integration            | JavaScript bridge (manual)          |
| DoH Support    | okhttp-dnsoverhttps (built-in)    | No support (requires native module) |
| Interceptors   | Built-in (chain architecture)     | No built-in (requires wrapper)      |
| Caching        | OkHttp Cache (configurable)       | Platform-dependent (limited)        |

### User Experience

| Aspect             | Yokai                    | React Native                       |
| ------------------ | ------------------------ | ---------------------------------- |
| Cookie Persistence | Automatic                | Manual (login required on restart) |
| Cloudflare Bypass  | Transparent (background) | Blocking WebView (UI disruption)   |
| DoH Configuration  | Settings (toggle on/off) | Not available                      |
| Cookie Sync        | Automatic                | Manual (requires code changes)     |

---

## Recommendations for LNReader

### Phase 1: Cookie Persistence (High Priority)

**Goal**: Implement automatic cookie persistence and WebView sync

**Implementation**:

1. Create React Native native module for cookie management
   - **Android**: Use `CookieManager` API
   - **iOS**: Use `HTTPCookieStorage` API
   - **JavaScript**: Expose `getCookies()`, `setCookies()`, `removeCookies()`, `clearAll()`

2. Integrate with WebView
   - Extract cookies from WebView after page loads
   - Sync to native cookie manager
   - Support for Secure/HttpOnly flags

3. Update plugin system
   - Inject cookies into fetch() requests
   - Parse and save Set-Cookie headers
   - Handle cookie expiry

**Effort Estimate**: 2-3 weeks (including testing)

**Benefits**:

- Users don't need to re-login on app restart
- Better support for authenticated sources
- Improved plugin reliability

---

### Phase 2: Cloudflare Bypass (Medium Priority)

**Goal**: Implement transparent Cloudflare challenge resolution

**Implementation**:

1. Use cookie manager from Phase 1
2. Create WebView interceptor pattern
   - Detect Cloudflare challenges (403/503 + Server header)
   - Load URL in background WebView
   - Wait for `cf_clearance` cookie
   - Retry request with new cookies

3. Non-blocking UI
   - Show loading indicator (not blocking WebView)
   - Use hidden WebView for background processing
   - Fallback to manual WebView if auto-bypass fails

**Effort Estimate**: 1-2 weeks

**Benefits**:

- Better plugin compatibility (Cloudflare-protected sites)
- Improved user experience (transparent bypass)
- Reduced manual intervention

---

### Phase 3: DoH Support (Low Priority)

**Goal**: Add DNS over HTTPS configuration

**Implementation**:

1. Create native DoH module
   - **Android**: Use OkHttp's DNS module (or implement custom)
   - **iOS**: Use NWConnection or native DNS APIs
   - **JavaScript**: Expose `setDohProvider(provider)`, `getDohProviders()`

2. Implement providers
   - Cloudflare, Google, AdGuard (minimum)
   - Add Quad9, Mullvad (optional)
   - Bootstrap DNS fallback

3. Add settings UI
   - Provider selection dropdown
   - Toggle on/off
   - Test connection button

**Effort Estimate**: 3-4 weeks (cross-platform)

**Benefits**:

- Enhanced privacy (encrypted DNS queries)
- Censorship bypass for restricted regions
- Improved DNS reliability

---

## Technical Debt & Limitations

### Yokai's Limitations

1. **Platform-Specific**: Only works on Android (no iOS in yokai)
2. **Hardcoded Values**: Some timeouts and cache sizes are hardcoded
3. **Limited Error Context**: HttpException only provides code, not detailed error info
4. **No Request/Response Logging**: Requires adding LoggingInterceptor for debugging

### React Native's Limitations

1. **No Built-in Interceptors**: Requires manual wrapper implementation
2. **Limited Cookie Support**: No automatic persistence or WebView sync
3. **No DoH Support**: System DNS only
4. **Platform Inconsistency**: fetch() behavior varies between platforms
5. **Limited Caching**: Cache behavior depends on underlying native implementation

---

## Lessons Learned

### 1. Leverage Native APIs

Yokai achieves sophistication by leveraging native Android APIs:

- `CookieManager` for automatic cookie persistence
- `WebView` for Cloudflare bypass
- `okhttp-dnsoverhttps` for DoH support

**Lesson**: Don't reinvent the wheel. Use native APIs for platform-specific features.

---

### 2. Transparent Integration

Yokai's features are **transparent to extension developers**:

- Cookie persistence: Automatic
- Cloudflare bypass: Automatic
- DoH: Global configuration

**Lesson**: Make common concerns invisible to plugin developers. Provide sensible defaults.

---

### 3. Modular Architecture

Yokai's interceptor chain is modular:

- Easy to add/remove features
- Reusable interceptors
- Type-safe (Kotlin)

**Lesson**: Use composable patterns for cross-cutting concerns.

---

### 4. Dependency Injection

Yokai uses Injekt for dependency injection:

- Single shared `NetworkHelper` instance
- Injected into all extensions
- Easy to mock for testing

**Lesson**: Use DI for shared resources (network client, database, etc.).

---

## Conclusion

Yokai's network layer demonstrates **best-in-class architecture** for native Android applications:

✅ **Automatic cookie persistence** via AndroidCookieJar (zero boilerplate)
✅ **Transparent Cloudflare bypass** via WebViewInterceptor (invisible to extensions)
✅ **Modular interceptor chain** (easy to add/remove features)
✅ **Comprehensive DoH support** (12 providers for privacy and censorship bypass)
✅ **Built-in caching, compression, and progress tracking** (production-grade)

For **LNReader (React Native)**, implementing equivalent functionality requires:

- **Native module development** for cookie persistence and WebView integration
- **6-9 weeks** of development effort
- **Significant code complexity** (3-5x more code than yokai)

**Recommendation**: Implement cookie persistence and WebView integration first (Phases 1-2), as these provide the highest value to users. DoH support (Phase 3) can be deferred as it's less critical for LNReader's use case.

---

## Next Steps

1. **Read Detailed Documentation**:
   - [Initial Research Request](./01-INITIAL_REQUEST.md)
   - [Research Findings](./02-RESEARCH_FINDINGS.md)
   - [Comparison Analysis](./03-COMPARISON_ANALYSIS.md)
   - [Code Snippets](./04-CODE_SNIPPETS.md)
   - [Architecture](./05-ARCHITECTURE.md)

2. **Review Implementation Plan**:
   - [Further Research](./07-FURTHER_RESEARCH.md)
   - [PRD](./08-PRD.md)

3. **Decision Point**:
   - Approve Phase 1 (Cookie Persistence)?
   - Approve Phase 2 (Cloudflare Bypass)?
   - Approve Phase 3 (DoH Support)?

4. **Begin Implementation**:
   - Create native module for cookie management
   - Integrate with WebView component
   - Update plugin system to use new cookie manager
   - Test with authenticated sources
