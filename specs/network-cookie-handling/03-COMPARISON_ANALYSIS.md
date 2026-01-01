# Comparison Analysis: Yokai (OkHttp) vs React Native fetch()

**Date**: January 1, 2026
**Comparison Focus**: Network and cookie handling capabilities

---

## Executive Summary

Yokai's network layer leverages native Android APIs (OkHttp, WebView CookieManager) to provide sophisticated cookie persistence, automatic Cloudflare bypass, and comprehensive DNS configuration. React Native's fetch() API provides basic HTTP functionality but lacks built-in support for cookies, interceptors, and DNS configuration.

**Key Finding**: React Native requires native module development to match yokai's capabilities, particularly for cookie persistence and WebView integration.

---

## Feature-by-Feature Comparison

| Feature                          | Yokai (OkHttp)                                                | React Native fetch()                                                      | Gap         |
| -------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------- |
| **Cookie Persistence**           | AndroidCookieJar + WebView CookieManager (automatic sync)     | No built-in persistence; requires manual cookie jar or AsyncStorage       | 🔴 Critical |
| **Cookie Storage**               | Automatic via Android CookieManager                           | Manual implementation required (AsyncStorage, MMKV, or encrypted storage) | 🔴 Critical |
| **Cookie Expiry**                | Automatic                                                     | Manual implementation required                                            | 🔴 Critical |
| **Cookie Domain Matching**       | Automatic (via CookieManager)                                 | Manual implementation required                                            | 🟡 High     |
| **Secure Cookies**               | Automatic (HttpOnly, Secure flags)                            | Manual flag checking required                                             | 🟡 High     |
| **WebView Integration**          | Native interceptor architecture; solves Cloudflare challenges | Requires WebView JavaScript bridge; no automatic sync                     | 🔴 Critical |
| **Cookie Sync (HTTP ↔ WebView)** | Automatic via AndroidCookieJar                                | Manual bridge implementation required                                     | 🔴 Critical |
| **HTTP Library**                 | OkHttp 5.0.0-alpha.16 (native Android)                        | fetch() polyfills to native (varies by platform)                          | 🟢 Low      |
| **DNS Configuration**            | Built-in DoH with 12 providers                                | System DNS only; requires native module                                   | 🟠 Medium   |
| **Interceptors**                 | Modular interceptor chain (e.g., Cloudflare, rate limiting)   | No built-in interceptors; requires custom wrapper                         | 🔴 Critical |
| **Request Caching**              | OkHttp Cache (5 MiB disk, 10-min TTL)                         | Limited; depends on underlying native implementation                      | 🟠 Medium   |
| **Cache Configuration**          | Granular control (size, TTL, per-host)                        | Very limited configuration                                                | 🟠 Medium   |
| **Compression Support**          | Gzip, Brotli (automatic)                                      | Automatic (varies by platform)                                            | 🟢 Low      |
| **Progress Tracking**            | ProgressResponseBody + listeners                              | Limited; requires xhr or custom native module                             | 🟠 Medium   |
| **Error Handling**               | HttpException wrapper with standardized messages              | Promise-based; inconsistent across platforms                              | 🟠 Medium   |
| **Timeout Configuration**        | Per-request timeouts (connect, read, call)                    | Platform-dependent; limited control                                       | 🟡 High     |
| **Retry Logic**                  | Built-in via interceptors                                     | Manual implementation required                                            | 🟡 High     |
| **Rate Limiting**                | Built-in via interceptors                                     | Manual implementation required                                            | 🟡 High     |
| **Authentication**               | Automatic via AndroidCookieJar                                | Manual cookie management required                                         | 🔴 Critical |
| **User-Agent Management**        | Automatic interceptor with configurable UA                    | Manual header addition required                                           | 🟢 Low      |
| **Connection Pooling**           | Automatic (OkHttp)                                            | Platform-dependent                                                        | 🟢 Low      |
| **Request/Response Logging**     | OkHttp LoggingInterceptor                                     | Manual console.log required                                               | 🟢 Low      |
| **JSON Parsing**                 | kotlinx.serialization integration                             | Manual JSON.parse required                                                | 🟢 Low      |
| **Streaming Support**            | Yes (via ResponseBody)                                        | Limited                                                                   | 🟡 High     |
| **Multipart Upload**             | Built-in                                                      | FormData API available                                                    | 🟢 Low      |
| **Cookie Management APIs**       | `remove()`, `removeAll()`, `get()`                            | Manual implementation                                                     | 🔴 Critical |

**Legend**:

- 🔴 **Critical**: Major gap requiring native module development
- 🟠 **Medium**: Significant gap that impacts functionality
- 🟡 **High**: Moderate gap requiring manual implementation
- 🟢 **Low**: Minor gap or already available

---

## Detailed Comparison

### 1. Cookie Persistence

#### Yokai (OkHttp)

```kotlin
// Automatic cookie persistence via AndroidCookieJar
val client = OkHttpClient.Builder()
    .cookieJar(AndroidCookieJar())  // ← Just one line!
    .build()

// Cookies are automatically:
// - Saved to disk (via CookieManager)
// - Synced with WebView
// - Retrieved on subsequent requests
// - Managed for expiry and domain matching
```

**Advantages**:

- Zero boilerplate code
- Automatic persistence across app restarts
- Bidirectional sync with WebView
- Automatic domain matching
- Support for Secure/HttpOnly flags

#### React Native fetch()

```typescript
// Manual cookie management required
// Option 1: AsyncStorage (unencrypted)
import AsyncStorage from '@react-native-async-storage/async-storage';

async function saveCookies(url: string, cookies: string[]) {
  await AsyncStorage.setItem(`cookies_${url}`, JSON.stringify(cookies));
}

async function loadCookies(url: string): Promise<string[]> {
  const cookies = await AsyncStorage.getItem(`cookies_${url}`);
  return cookies ? JSON.parse(cookies) : [];
}

async function makeRequest(url: string, options: RequestInit = {}) {
  const cookies = await loadCookies(url);
  const headers = new Headers(options.headers || {});
  headers.set('Cookie', cookies.join('; '));

  const response = await fetch(url, { ...options, headers });

  // Parse and save cookies from response
  const setCookieHeaders = response.headers.getSetCookie?.() || [];
  await saveCookies(url, setCookieHeaders);

  return response;
}
```

**Disadvantages**:

- Significant boilerplate code
- Manual persistence required
- No automatic WebView sync
- Manual domain matching logic
- No native Secure/HttpOnly flag support
- Unencrypted storage (security risk)

---

### 2. WebView Integration

#### Yokai (OkHttp)

```kotlin
// CloudflareInterceptor.kt - Automatic Cloudflare bypass
class CloudflareInterceptor : WebViewInterceptor {
    override fun intercept(chain: Interceptor.Chain, request: Request, response: Response): Response {
        // 1. Detect Cloudflare challenge
        if (response.code in listOf(403, 503) && response.header("Server") == "cloudflare") {
            // 2. Load URL in WebView (solves challenge)
            val webView = createWebView(request)
            webView.loadUrl(request.url.toString(), headers)

            // 3. Wait for cf_clearance cookie
            waitForCookie("cf_clearance")

            // 4. Retry request with new cookies
            return chain.proceed(request)
        }
    }
}

// Cookies from WebView are automatically available to OkHttp via AndroidCookieJar
```

**Advantages**:

- Transparent to extension developers
- Automatic cookie synchronization
- No manual WebView interaction required
- Handles JavaScript challenges automatically

#### React Native fetch()

```typescript
// Manual WebView integration required
import { WebView } from 'react-native-webview';

class CloudflareBypass {
  private webViewRef: React.RefObject<WebView> | null = null;
  private cookiePromise: Promise<string[]> | null = null;

  async bypassWithWebView(
    url: string,
    headers: Record<string, string>,
  ): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.cookiePromise = new Promise<string[]>(cookieResolve => {
        // Wait for navigation complete
        webViewRef.current?.injectJavaScript(`
          (function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'cookies',
              data: document.cookie
            }));
          })();
        `);
      });

      this.cookiePromise.then(resolve);
    });
  }

  async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const response = await fetch(url, options);

    if ([403, 503].includes(response.status)) {
      // Show WebView for manual Cloudflare solve
      const cookies = await this.bypassWithWebView(url, options.headers);
      // Manual cookie extraction and storage required
      await saveCookies(url, cookies);

      // Retry request
      return fetch(url, {
        ...options,
        headers: { ...options.headers, Cookie: cookies.join('; ') },
      });
    }

    return response;
  }
}
```

**Disadvantages**:

- Complex manual implementation
- Requires UI interaction (user sees WebView)
- No automatic cookie sync
- Manual cookie extraction required
- Poor user experience (blocking WebView)

---

### 3. DNS Configuration

#### Yokai (OkHttp)

```kotlin
// Built-in DoH support with 12 providers
when (preferences.dohProvider().get()) {
    PREF_DOH_CLOUDFLARE -> builder.dohCloudflare()
    PREF_DOH_GOOGLE -> builder.dohGoogle()
    PREF_DOH_ADGUARD -> builder.dohAdGuard()
    // ... 9 more providers
}

fun OkHttpClient.Builder.dohCloudflare() = dns(
    DnsOverHttps.Builder().client(build())
        .url("https://cloudflare-dns.com/dns-query".toHttpUrl())
        .bootstrapDnsHosts(InetAddress.getByName("1.1.1.1"))
        .build()
)
```

**Advantages**:

- Built-in DoH support
- 12 provider options
- Privacy enhancement
- Censorship bypass capability
- Zero configuration required from extensions

#### React Native fetch()

```typescript
// No built-in DoH support
// Requires native module or WebView-based workaround

// Workaround 1: WebView-based DoH (unreliable)
const DoHWorkaround = {
  async resolve(hostname: string): Promise<string[]> {
    // Use WebView to make DoH request
    // This is slow and unreliable
    const script = `
      fetch('https://cloudflare-dns.com/dns-query?name=${hostname}&type=A', {
        headers: { 'accept': 'application/dns-json' }
      })
      .then(r => r.json())
      .then(data => window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'doh_result',
        data: data.Answer?.map(a => a.data)
      })));
    `;

    return new Promise(resolve => {
      const handleMessage = (event: any) => {
        if (event.nativeEvent.data?.type === 'doh_result') {
          resolve(event.nativeEvent.data?.data);
          webView.removeEventListener('message', handleMessage);
        }
      };

      webView.addEventListener('message', handleMessage);
      webView.injectJavaScript(script);
    });
  },
};

// Workaround 2: Native module (recommended)
// Requires writing native Android/iOS code
import { DNSModule } from 'react-native-doh-module';

const ipAddresses = await DNSModule.resolve('example.com');
```

**Disadvantages**:

- No built-in support
- Workarounds are slow and unreliable
- Native module development required
- Complex cross-platform implementation
- WebView-based solution is blocking and slow

---

### 4. Interceptor Chain

#### Yokai (OkHttp)

```kotlin
// Modular interceptor chain
val client = OkHttpClient.Builder()
    .addInterceptor(UncaughtExceptionInterceptor())       // 1. Catch crashes
    .addInterceptor(UserAgentInterceptor { userAgent })    // 2. Add UA
    .addInterceptor(CloudflareInterceptor(...))         // 3. Cloudflare bypass
    .addNetworkInterceptor(IgnoreGzipInterceptor())      // 4. Decompress Gzip
    .addNetworkInterceptor(BrotliInterceptor())           // 5. Decompress Brotli
    .addInterceptor(RateLimitInterceptor())             // 6. Rate limiting
    .build()

// Adding new feature is as simple as:
.addInterceptor(NewFeatureInterceptor())
```

**Advantages**:

- Modular architecture
- Easy to add/remove features
- Reusable interceptors
- Type-safe (Kotlin)
- Compile-time validation

#### React Native fetch()

```typescript
// No built-in interceptors
// Requires manual wrapper function

class HttpClient {
  private interceptors: Interceptor[] = [];

  addInterceptor(interceptor: Interceptor) {
    this.interceptors.push(interceptor);
  }

  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    // Apply request interceptors
    for (const interceptor of this.interceptors) {
      const result = interceptor.request?.(url, options);
      if (result) {
        url = result.url ?? url;
        options = result.options ?? options;
      }
    }

    // Make request
    let response = await fetch(url, options);

    // Apply response interceptors
    for (const interceptor of this.interceptors) {
      const result = await interceptor.response?.(response);
      if (result) {
        response = result;
      }
    }

    return response;
  }
}

interface Interceptor {
  request?: (
    url: string,
    options: RequestInit,
  ) => Partial<{ url: string; options: RequestInit }> | undefined;
  response?: (response: Response) => Response | Promise<Response>;
}

// Usage
const client = new HttpClient();
client.addInterceptor({
  request: (url, options) => {
    options.headers = new Headers(options.headers);
    options.headers.set('User-Agent', 'MyApp/1.0');
    return { options };
  },
});
```

**Disadvantages**:

- Manual wrapper implementation required
- No built-in interceptors
- TypeScript types less type-safe than Kotlin
- No compile-time validation
- Harder to share interceptors across codebase

---

### 5. Progress Tracking

#### Yokai (OkHttp)

```kotlin
// Built-in progress tracking via ProgressResponseBody
interface ProgressListener {
    fun update(bytesRead: Long, contentLength: Long, done: Boolean)
}

fun OkHttpClient.newCachelessCallWithProgress(request: Request, listener: ProgressListener): Call {
    val progressClient = newBuilder()
        .cache(null)
        .addNetworkInterceptor { chain ->
            val originalResponse = chain.proceed(chain.request())
            originalResponse.newBuilder()
                .body(ProgressResponseBody(originalResponse.body, listener))
                .build()
        }
        .build()

    return progressClient.newCall(request)
}

// Usage
client.newCachelessCallWithProgress(request, object : ProgressListener {
    override fun update(bytesRead: Long, contentLength: Long, done: Boolean) {
        val progress = (bytesRead * 100 / contentLength).toInt()
        updateProgressUI(progress)
    }
}).execute()
```

**Advantages**:

- Native support
- Efficient (no JavaScript bridge overhead)
- Works with streaming responses
- Zero boilerplate for consumers

#### React Native fetch()

```typescript
// No built-in progress tracking
// Workaround 1: XMLHttpRequest (limited to upload)
function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', event => {
      if (event.lengthComputable) {
        const progress = (event.loaded / event.total) * 100;
        onProgress(progress);
      }
    });

    xhr.addEventListener('load', () => resolve());
    xhr.addEventListener('error', () => reject(new Error('Upload failed')));

    xhr.open('POST', url);
    xhr.send(file);
  });
}

// Workaround 2: Native module (recommended for downloads)
import { DownloadManager } from 'react-native-download-manager';

DownloadManager.download(url, {
  onProgress: progress => console.log(`Downloaded: ${progress}%`),
  destination: '/path/to/file',
});
```

**Disadvantages**:

- No built-in support for fetch()
- XMLHttpRequest limited to upload progress
- Download progress requires native module
- Requires native module for production use
- Complex cross-platform implementation

---

## Implementation Complexity Assessment

### Cookie Persistence

| Aspect       | Yokai                   | React Native                  | Complexity |
| ------------ | ----------------------- | ----------------------------- | ---------- |
| Code Lines   | ~50 (AndroidCookieJar)  | ~200+ (manual implementation) | 4x         |
| Dependencies | OkHttp (built-in)       | AsyncStorage or native module | High       |
| WebView Sync | Automatic               | Manual bridge implementation  | Very High  |
| Security     | Native (HttpOnly flags) | Manual flag checking          | High       |
| Testing      | Minimal                 | Extensive unit tests required | High       |

### Cloudflare Bypass

| Aspect          | Yokai                        | React Native                  | Complexity |
| --------------- | ---------------------------- | ----------------------------- | ---------- |
| Code Lines      | ~150 (CloudflareInterceptor) | ~500+ (manual implementation) | 3x         |
| UI Impact       | Transparent (background)     | Blocking WebView modal        | Very High  |
| Cookie Sync     | Automatic                    | Manual extraction and storage | Very High  |
| User Experience | Seamless                     | Poor (blocking UI)            | Very High  |
| Reliability     | High (native)                | Low (JavaScript bridge)       | High       |

### DoH Support

| Aspect         | Yokai                  | React Native                 | Complexity |
| -------------- | ---------------------- | ---------------------------- | ---------- |
| Code Lines     | ~200 (DohProviders.kt) | ~1000+ (native module)       | 5x         |
| Dependencies   | okhttp-dnsoverhttps    | Native Android/iOS modules   | Very High  |
| Cross-Platform | Not applicable         | Requires dual implementation | Very High  |
| Performance    | Native                 | WebView-based (slow)         | High       |

**Overall**: Implementing yokai's capabilities in React Native requires **3-5x more code** and significant native module development.

---

## Recommended Approach for LNReader

Given the complexity gaps, the recommended approach is:

### Phase 1: Cookie Persistence (High Priority)

1. **Implement React Native Cookie Manager Module**
   - Native Android module using `CookieManager` API
   - Native iOS module using `HTTPCookieStorage` API
   - JavaScript interface for cookie CRUD operations
   - Automatic persistence and expiry management

2. **Integrate with WebView**
   - Bridge between WebView cookies and native cookie manager
   - Bidirectional synchronization
   - Support for Secure/HttpOnly flags

### Phase 2: Cloudflare Bypass (Medium Priority)

1. **Implement WebView Interceptor Pattern**
   - Background WebView for Cloudflare challenges
   - Automatic cookie extraction and storage
   - Non-blocking UI (background loading indicator)

2. **Cookie Sync Integration**
   - Use cookie manager from Phase 1
   - Automatic request retry with new cookies

### Phase 3: DoH Support (Low Priority)

1. **Native DoH Module**
   - Android: Use OkHttp's DNS module
   - iOS: Use NWConnection or native DNS APIs
   - Expose JavaScript interface for provider selection

2. **Fallback Mechanism**
   - Fallback to system DNS if DoH fails
   - Support for multiple providers (Cloudflare, Google, etc.)

---

## Conclusion

**React Native fetch() is significantly underpowered** compared to yokai's OkHttp-based architecture. Key gaps:

1. **Cookie Persistence**: No automatic persistence; requires significant custom implementation
2. **WebView Integration**: No automatic sync; requires complex bridge implementation
3. **DoH Support**: No built-in support; requires native module development
4. **Interceptors**: No built-in support; requires custom wrapper implementation

**Recommendation**: Implement native modules for cookie persistence and WebView integration to match yokai's capabilities. DoH support can be deferred to Phase 3 as it's less critical for LNReader's use case.

**Effort Estimate**:

- Cookie Persistence Module: 2-3 weeks (including testing)
- Cloudflare Bypass: 1-2 weeks
- DoH Support: 3-4 weeks (cross-platform)
- **Total**: 6-9 weeks for full yokai parity
