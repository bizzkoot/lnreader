# Architecture: Yokai Network & Cookie Handling

**Date**: January 1, 2026
**Architecture**: Native Android (Kotlin + OkHttp)

---

## System Architecture Diagram

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        LNReader App                              │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Source Extensions                         │   │
│  │                                                           │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │  Source A    │  │  Source B    │  │  Source C    │  │   │
│  │  │  (HttpSource) │  │  (HttpSource) │  │  (HttpSource) │  │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │   │
│  └─────────┼──────────────────┼──────────────────┼───────────┘   │
│            │                  │                  │                      │
│            └──────────────────┼──────────────────┘                      │
│                               │                                     │
│                               ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   NetworkHelper (Singleton)                │   │
│  │                                                           │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │              OkHttpClient.Builder                     │   │   │
│  │  │                                                       │   │   │
│  │  │  ┌─────────────────────────────────────────────────┐  │   │   │
│  │  │  │         Configuration                          │  │   │   │
│  │  │  │  • CookieJar: AndroidCookieJar               │  │   │   │
│  │  │  │  • Cache: 5 MiB disk cache                  │  │   │   │
│  │  │  │  • Timeouts: 30s connect/read, 2m call      │  │   │   │
│  │  │  │  • DNS: DoH (12 providers, configurable)     │  │   │   │
│  │  │  └─────────────────────────────────────────────────┘  │   │   │
│  │  │                                                       │   │   │
│  │  │  ┌─────────────────────────────────────────────────┐  │   │   │
│  │  │  │         Interceptor Chain                     │  │   │   │
│  │  │  │                                               │  │   │   │
│  │  │  │  1. UncaughtExceptionInterceptor               │  │   │   │
│  │  │  │  2. UserAgentInterceptor                      │  │   │   │
│  │  │  │  3. CloudflareInterceptor (uses WebView)    │  │   │   │
│  │  │  │  4. IgnoreGzipInterceptor (network)          │  │   │   │
│  │  │  │  5. BrotliInterceptor (network)              │  │   │   │
│  │  │  │  6. RateLimitInterceptor                      │  │   │   │
│  │  │  │  7. SpecificHostRateLimitInterceptor          │  │   │   │
│  │  │  └─────────────────────────────────────────────────┘  │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                   │
│            ┌────────────────────────────────────┐                   │
│            │         OkHttp Client Pool        │                   │
│            │  • Connection pooling            │                   │
│            │  • Keep-alive connections       │                   │
│            │  • Response caching             │                   │
│            └────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Cookie Persistence Flow

### Automatic Cookie Synchronization

```
┌─────────────────────────────────────────────────────────────────────┐
│                  Cookie Synchronization Flow                       │
│                                                                   │
│  ┌─────────────────────────┐         ┌─────────────────────────┐  │
│  │     OkHttp Client       │         │   Android CookieManager  │  │
│  │   (Network Layer)       │         │   (System Cookie Store)  │  │
│  │                         │         │                         │  │
│  │  Request →  Client     │────────▶│   loadForRequest()     │  │
│  │           ↑            │         │   get(url)             │  │
│  │           │            │         │   Retrieve cookies      │  │
│  │           │            │         │   Match domain/path     │  │
│  │           │            │         │   Return to OkHttp     │  │
│  │           │            │◀────────│                         │  │
│  │           │            │         │                         │  │
│  │  Response ◀─ Server   │         │                         │  │
│  │           │            │         │                         │  │
│  │           │            │────────▶│   saveFromResponse()   │  │
│  │           │            │         │   setCookie(url, c)     │  │
│  │           │            │         │   Persist to disk       │  │
│  │           │            │         │   Handle expiry         │  │
│  │           └────────────│◀────────│                         │  │
│  └─────────────────────────┘         └─────────────────────────┘  │
│                                                                   │
│  ┌─────────────────────────┐         ┌─────────────────────────┐  │
│  │       WebView           │         │   Android CookieManager  │  │
│  │   (User Interface)      │         │   (System Cookie Store)  │  │
│  │                         │         │                         │  │
│  │  loadUrl(url)          │────────▶│   getCookie(url)       │  │
│  │  (includes cookies)     │         │   Return Set-Cookie     │  │
│  │           │            │         │   from OkHttp requests  │  │
│  │           ◀────────────│         │                         │  │
│  │                         │         │                         │  │
│  │  JS: document.cookie    │────────▶│   setCookie(url, c)     │  │
│  │     = "session=xyz"     │         │   Available to OkHttp   │  │
│  │           │            │         │   on next request       │  │
│  │           └────────────│         │                         │  │
│  └─────────────────────────┘         └─────────────────────────┘  │
│                                                                   │
│  Key: Automatic bidirectional sync via AndroidCookieJar               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Cloudflare Bypass Flow

### Transparent Cloudflare Challenge Resolution

```
┌─────────────────────────────────────────────────────────────────────┐
│              Cloudflare Bypass Interceptor Flow                   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Source makes HTTP request                                │   │
│  │  client.newCall(request).execute()                         │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  OkHttp Interceptor Chain                                │   │
│  │  (passes through UncaughtException, UserAgent, etc.)        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  CloudflareInterceptor.shouldIntercept(response)          │   │
│  │                                                           │   │
│  │  Is response code 403 or 503?                          │   │
│  │  Is Server header "cloudflare-nginx" or "cloudflare"?      │   │
│  │                                                           │   │
│  │  ┌──────────────┐    ┌──────────────┐                   │   │
│  │  │   Yes        │    │   No        │                   │   │
│  │  │ (challenge)  │    │ (normal)    │                   │   │
│  │  └──────┬───────┘    └──────┬───────┘                   │   │
│  │         │                     │                             │   │
│  │         ▼                     ▼                             │   │
│  │    [Bypass Flow]          [Return Response]                   │   │
│  │                             │                             │   │
│  │  ┌─────────────────────────────────────────────────────┐  │   │
│  │  │  1. Remove old cf_clearance cookie               │  │   │
│  │  │     cookieManager.remove(url, ["cf_clearance"], 0)  │  │   │
│  │  │                                                     │  │   │
│  │  │  2. Create WebView with same headers               │  │   │
│  │  │     webView = createWebView(request)                │  │   │
│  │  │                                                     │  │   │
│  │  │  3. Load URL in WebView (background)              │  │   │
│  │  │     webView.loadUrl(url, headers)                 │  │   │
│  │  │                                                     │  │   │
│  │  │  4. Monitor WebViewClient events                   │  │   │
│  │  │     - onPageFinished(url)                         │  │   │
│  │  │     - onReceivedError(errorCode, url)             │  │   │
│  │  │                                                     │  │   │
│  │  │  5. Check for cf_clearance cookie                │  │   │
│  │  │     cookieManager.get(url)                        │  │   │
│  │  │       .firstOrNull { it.name == "cf_clearance" }  │  │   │
│  │  │       .let { it != oldCookie }                   │  │   │
│  │  │                                                     │  │   │
│  │  │  6. If cookie found:                              │  │   │
│  │  │     - cloudflareBypassed = true                   │  │   │
│  │  │     - CountDownLatch.countDown()                   │  │   │
│  │  │                                                     │  │   │
│  │  │  7. Wait up to 30 seconds                       │  │   │
│  │  │     latch.awaitFor30Seconds()                     │  │   │
│  │  │                                                     │  │   │
│  │  │  8. Cleanup WebView                              │  │   │
│  │  │     webView.stopLoading()                         │  │   │
│  │  │     webView.destroy()                             │  │   │
│  │  │                                                     │  │   │
│  │  │  9. Retry original request with new cookies      │  │   │
│  │  │     return chain.proceed(request)                 │  │   │
│  │  └─────────────────────────────────────────────────────┘  │   │
│  │                             │                             │   │
│  └─────────────────────────────┬─┴─────────────────────────┘   │
│                                │                                │
│                                ▼                                │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Source receives final response (with Cloudflare bypassed) │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Key: Transparent to extension developers (no code changes needed)    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## DNS Resolution Flow

### DNS over HTTPS (DoH) Configuration

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DNS Resolution Flow                          │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  OkHttp Client makes HTTP request                       │   │
│  │  GET https://example.com/api/data                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  DNS Resolution Phase                                   │   │
│  │                                                           │   │
│  │  Is DoH enabled?                                         │   │
│  │  preferences.dohProvider().get() != -1                     │   │
│  │                                                           │   │
│  │  ┌──────────────┐    ┌──────────────┐                   │   │
│  │  │   Yes        │    │   No        │                   │   │
│  │  │ (DoH)       │    │ (System)    │                   │   │
│  │  └──────┬───────┘    └──────┬───────┘                   │   │
│  │         │                     │                             │   │
│  │         ▼                     ▼                             │   │
│  │    [DoH Resolution]      [System DNS]                      │   │
│  │                             │                             │   │
│  │  ┌─────────────────────────────────────────────────────┐  │   │
│  │  │  1. Select DoH provider (e.g., Cloudflare)     │  │   │
│  │  │     builder.dohCloudflare()                      │  │   │
│  │  │                                                     │  │   │
│  │  │  2. Make DoH request to provider                  │  │   │
│  │  │     GET https://cloudflare-dns.com/dns-query     │  │   │
│  │  │         ?name=example.com&type=A                   │  │   │
│  │  │         Accept: application/dns-json               │  │   │
│  │  │                                                     │  │   │
│  │  │  3. Use bootstrap DNS if DoH endpoint blocked    │  │   │
│  │  │     bootstrapDnsHosts(                           │  │   │
│  │  │       InetAddress.getByName("1.1.1.1"),          │  │   │
│  │  │       InetAddress.getByName("162.159.36.1")       │  │   │
│  │  │     )                                             │  │   │
│  │  │                                                     │  │   │
│  │  │  4. Parse DoH response (JSON)                     │  │   │
│  │  │     {                                            │  │   │
│  │  │       "Answer": [                                 │  │   │
│  │  │         {"name": "example.com",                     │  │   │
│  │  │          "type": 1,                               │  │   │
│  │  │          "data": "93.184.216.34"}                  │  │   │
│  │  │       ]                                            │  │   │
│  │  │     }                                              │  │   │
│  │  │                                                     │  │   │
│  │  │  5. Return IP address to OkHttp                     │  │   │
│  │  │     93.184.216.34                                  │  │   │
│  │  └─────────────────────────────────────────────────────┘  │   │
│  │                             │                             │   │
│  └─────────────────────────────┬─┴─────────────────────────┘   │
│                                │                                │
│                                ▼                                │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  TCP Connection Established                             │   │
│  │  (using resolved IP address)                             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  TLS Handshake (HTTPS)                                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  HTTP Request Sent with SNI                             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Supported DoH Providers (12):                                   │
│  1. Cloudflare    5. AliDNS       9. Mullvad                      │
│  2. Google        6. DNSPod       10. Control D                    │
│  3. AdGuard       7. 360          11. Njalla                       │
│  4. Quad9         8. Quad101      12. Shecan                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Request Flow (Complete)

### End-to-End Request Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                  Complete Request Flow                          │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 1. Source Extension Initiates Request                  │   │
│  │                                                           │   │
│  │  class MySource : HttpSource() {                        │   │
│  │    fun fetchPopularManga(page: Int) {                     │   │
│  │      val request = popularMangaRequest(page)                │   │
│  │      val response = client.newCall(request).execute()       │   │
│  │      return popularMangaParse(response)                     │   │
│  │    }                                                     │   │
│  │  }                                                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 2. OkHttp Client Prepares Request                     │   │
│  │                                                           │   │
│  │  ┌───────────────────────────────────────────────────┐    │   │
│  │  │ Load cookies via AndroidCookieJar               │    │   │
│  │  │ cookieJar.loadForRequest(url)                   │    │   │
│  │  │ → Returns List<Cookie> from CookieManager      │    │   │
│  │  └───────────────────────────────────────────────────┘    │   │
│  │                                                           │   │
│  │  ┌───────────────────────────────────────────────────┐    │   │
│  │  │ Apply application interceptors                  │    │   │
│  │  │                                                 │    │   │
│  │  │  1. UncaughtExceptionInterceptor               │    │   │
│  │  │     Wrap exceptions in IOException            │    │   │
│  │  │                                                 │    │   │
│  │  │  2. UserAgentInterceptor                      │    │   │
│  │  │     Add default User-Agent if missing          │    │   │
│  │  │                                                 │    │   │
│  │  │  3. CloudflareInterceptor                    │    │   │
│  │  │     Check for Cloudflare challenge            │    │   │
│  │  │     → If 403/503 + Server=cloudflare:       │    │   │
│  │  │       - Load in WebView                       │    │   │
│  │  │       - Wait for cf_clearance cookie           │    │   │
│  │  │       - Retry request                         │    │   │
│  │  │                                                 │    │   │
│  │  │  4. RateLimitInterceptor                      │    │   │
│  │  │     Enforce rate limits                      │    │   │
│  │  └───────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 3. DNS Resolution                                      │   │
│  │                                                           │   │
│  │  ┌───────────────────────────────────────────────────┐    │   │
│  │  │ If DoH enabled:                                  │    │   │
│  │  │  - Resolve via DoH provider (e.g., Cloudflare)  │    │   │
│  │  │  - Use bootstrap DNS if DoH blocked             │    │   │
│  │  │                                                 │    │   │
│  │  │ If DoH disabled:                                 │    │   │
│  │  │  - Use system DNS resolver                     │    │   │
│  │  └───────────────────────────────────────────────────┘    │   │
│  │                                                           │   │
│  │  Result: IP address (e.g., 93.184.216.34)               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 4. TCP Connection + TLS Handshake                      │   │
│  │                                                           │   │
│  │  ┌───────────────────────────────────────────────────┐    │   │
│  │  │ TCP Connection (3-way handshake)               │    │   │
│  │  │  → Client connects to resolved IP              │    │   │
│  │  │                                                 │    │   │
│  │  │ TLS Handshake                                    │    │   │
│  │  │  → ClientHello (SNI=example.com)              │    │   │
│  │  │  → ServerHello (certificate)                 │    │   │
│  │  │  → Certificate validation                   │    │   │
│  │  │  → Key exchange + session establishment        │    │   │
│  │  └───────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 5. Apply Network Interceptors                           │   │
│  │                                                           │   │
│  │  ┌───────────────────────────────────────────────────┐    │   │
│  │  │ 1. IgnoreGzipInterceptor                      │    │   │
│  │  │     Decompress Gzip response                  │    │   │
│  │  │                                                 │    │   │
│  │  │ 2. BrotliInterceptor                          │    │   │
│  │  │     Decompress Brotli response                 │    │   │
│  │  └───────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 6. Server Responds                                    │   │
│  │                                                           │   │
│  │  HTTP/1.1 200 OK                                        │   │
│  │  Content-Type: text/html                                   │   │
│  │  Content-Encoding: gzip                                     │   │
│  │  Set-Cookie: session=abc123; Path=/; HttpOnly             │   │
│  │  Cache-Control: max-age=600                                │   │
│  │                                                           │   │
│  │  <html>...</html>                                          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 7. Cookie Persistence                                  │   │
│  │                                                           │   │
│  │  ┌───────────────────────────────────────────────────┐    │   │
│  │  │ AndroidCookieJar.saveFromResponse()            │    │   │
│  │  │  → Parse Set-Cookie header                  │    │   │
│  │  │  → Save to CookieManager                    │    │   │
│  │  │  → Persist to disk automatically            │    │   │
│  │  │  → Handle expiry automatically             │    │   │
│  │  └───────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 8. Cache Check                                         │   │
│  │                                                           │   │
│  │  ┌───────────────────────────────────────────────────┐    │   │
│  │  │ Response is cached (5 MiB disk cache)          │    │   │
│  │  │  • Key: request URL + method                  │    │   │
│  │  │  • TTL: Cache-Control header (default 10m)    │    │   │
│  │  │  • Next request with same URL uses cache      │    │   │
│  │  └───────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 9. Return Response to Source                          │   │
│  │                                                           │   │
│  │  Source receives parsed response body:                       │   │
│  │  <html>...</html>                                          │   │
│  │                                                           │   │
│  │  Source parses HTML to extract manga/chapter data            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Key: All steps are transparent to extension developers               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Extension API Flow

### HttpSource Implementation Pattern

```
┌─────────────────────────────────────────────────────────────────────┐
│               HttpSource Extension Implementation                  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Extension Base Class                                    │   │
│  │                                                           │   │
│  │  abstract class HttpSource : CatalogueSource {           │   │
│  │                                                           │   │
│  │    // Injected via dependency injection                    │   │
│  │    protected val network: NetworkHelper by injectLazy()    │   │
│  │                                                           │   │
│  │    // Default: All extensions share same client          │   │
│  │    open val client: OkHttpClient                        │   │
│  │      get() = network.client                            │   │
│  │                                                           │   │
│  │    // Default headers with User-Agent                   │   │
│  │    open val headers: Headers                           │   │
│  │      get() = headersBuilder().build()                  │   │
│  │  }                                                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Concrete Source Implementation                        │   │
│  │                                                           │   │
│  │  class MySource : HttpSource() {                      │   │
│  │                                                           │   │
│  │    override val name = "My Source"                     │   │
│  │    override val baseUrl = "https://example.com"          │   │
│  │    override val lang = "en"                           │   │
│  │                                                           │   │
│  │    // Use default network client                        │   │
│  │    // (includes cookie persistence, Cloudflare bypass, etc.)│   │
│  │                                                           │   │
│  │    override fun popularMangaRequest(page: Int): Request {  │   │
│  │      return GET("$baseUrl/popular?page=$page", headers)   │   │
│  │    }                                                     │   │
│  │                                                           │   │
│  │    override fun popularMangaParse(response: Response) {    │   │
│  │      // Parse HTML response                              │   │
│  │      val document = Jsoup.parse(response.body?.string())   │   │
│  │      // Extract manga data...                            │   │
│  │      return MangasPage(mangas, hasNextPage)            │   │
│  │    }                                                     │   │
│  │  }                                                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Network Layer (Handled by NetworkHelper)               │   │
│  │                                                           │   │
│  │  • Cookie persistence (automatic)                        │   │
│  │  • Cloudflare bypass (automatic)                         │   │
│  │  • DNS resolution (automatic, DoH support)              │   │
│  │  • Rate limiting (automatic)                           │   │
│  │  • Compression (automatic: Gzip, Brotli)              │   │
│  │  • Caching (automatic: 5 MiB, 10-min TTL)            │   │
│  │                                                           │   │
│  │  Extension developers don't need to implement any of this!   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Result: Simple, maintainable extension API with zero boilerplate  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Interactions

### Component Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────┐
│                  Component Interaction Graph                      │
│                                                                   │
│  ┌──────────────┐                                                │
│  │   Source     │                                                │
│  │ Extensions   │                                                │
│  │  (HttpSource)│                                                │
│  └──────┬───────┘                                                │
│         │                                                        │
│         │ client, headers                                         │
│         ▼                                                        │
│  ┌──────────────────────────────┐                                  │
│  │     NetworkHelper          │                                  │
│  │  (Singleton, Injekt)       │                                  │
│  │                            │                                  │
│  │  • cookieJar: CookieJar      │                                  │
│  │  • client: OkHttpClient     │                                  │
│  │  • preferences: NetworkPref│                                  │
│  └────┬───────────────────────┘                                  │
│         │                                                        │
│         │ cookieJar, client, preferences                            │
│         ├──────────────────────────────┐                             │
│         │                              │                             │
│         ▼                              ▼                             │
│  ┌─────────────────┐        ┌─────────────────┐                     │
│  │AndroidCookieJar │        │   DoH Providers  │                     │
│  │                │        │                 │                     │
│  │ - CookieManager │        │ - Cloudflare     │                     │
│  │ - saveFromResp │        │ - Google         │                     │
│  │ - loadForReq   │        │ - AdGuard        │                     │
│  │ - remove()      │        │ - Quad9          │                     │
│  │ - removeAll()    │        │ - (12 total)     │                     │
│  └──────┬─────────┘        └─────────────────┘                     │
│         │                                                        │
│         │ manager (CookieManager.getInstance())                        │
│         ▼                                                        │
│  ┌──────────────────────────────┐                                  │
│  │  Android CookieManager     │                                  │
│  │  (System Cookie Store)    │                                  │
│  │                            │                                  │
│  │  - Persistent storage     │                                  │
│  │  - Domain matching        │                                  │
│  │  - Expiry handling       │                                  │
│  │  - Secure/HttpOnly       │                                  │
│  └──────────────────────────────┘                                  │
│         │                                                        │
│         │ cookies (bidirectional sync)                              │
│         ├──────────────────────────────┐                             │
│         │                              │                             │
│         ▼                              ▼                             │
│  ┌─────────────────┐        ┌─────────────────┐                     │
│  │  OkHttp Client │        │     WebView     │                     │
│  │                │        │                 │                     │
│  │ - Interceptors │        │ - loadUrl()     │                     │
│  │ - Cache        │        │ - evaluateJS() │                     │
│  │ - Connection   │        │ - document.cookie                    │
│  │   pooling     │        │                 │                     │
│  │ - DoH DNS      │        │                 │                     │
│  └─────────────────┘        └─────────────────┘                     │
│         │                              │                             │
│         │                              │ cookies                     │
│         ▼                              │                             │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                Network Stack                              │   │
│  │                                                           │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │  Interceptor Chain                        │    │   │
│  │  │  1. UncaughtExceptionInterceptor           │    │   │
│  │  │  2. UserAgentInterceptor                  │    │   │
│  │  │  3. CloudflareInterceptor                │    │   │
│  │  │  4. IgnoreGzipInterceptor               │    │   │
│  │  │  5. BrotliInterceptor                   │    │   │
│  │  │  6. RateLimitInterceptor                │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  │                                                           │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │  Network Interceptors                     │    │   │
│  │  │  - Gzip decompression                     │    │   │
│  │  │  - Brotli decompression                  │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Key: All components are automatically integrated via dependency injection│
└─────────────────────────────────────────────────────────────────────┘
```

---

## Summary

Yokai's architecture demonstrates a production-grade network layer with:

1. **Automatic Cookie Persistence**: Zero-code integration via AndroidCookieJar
2. **Transparent Cloudflare Bypass**: WebView-based solution, invisible to extensions
3. **Modular Interceptor Chain**: Easy to add/remove features
4. **Comprehensive DoH Support**: 12 providers with bootstrap DNS fallback
5. **Efficient Caching**: 5 MiB disk cache with configurable TTL
6. **Native Performance**: No JavaScript bridge overhead

For LNReader (React Native), adapting this architecture requires native module development for cookie persistence and WebView integration.
