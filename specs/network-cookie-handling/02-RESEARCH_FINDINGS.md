# Research Findings: Yokai Network & Cookie Handling

**Date**: January 1, 2026
**Research Subject**: yokai (null2264/yokai) codebase

---

## Overview

Yokai is a Kotlin-based Android app (not React Native) that uses **OkHttp 5.0.0-alpha.16** as its primary HTTP client with a sophisticated interceptor-based architecture.

### Technology Stack

- **Language**: Kotlin
- **HTTP Client**: OkHttp 5.0.0-alpha.16
- **Framework**: Compose UI
- **Async**: Coroutines + RxJava (dual support)
- **Architecture**: Dependency injection with Injekt

---

## 1. HTTP Requests & Network Layer

### Primary Network Library

```kotlin
// core/main/build.gradle.kts
api(libs.okhttp)                          // 5.0.0-alpha.16
api(libs.okhttp.logging.interceptor)     // Logging support
api(libs.okhttp.dnsoverhttps)            // DNS over HTTPS
api(libs.okhttp.brotli)                   // Brotli compression
```

### Request Helpers (`Requests.kt`)

```kotlin
// File: core/main/src/androidMain/kotlin/eu/kanade/tachiyomi/network/Requests.kt
private val DEFAULT_CACHE_CONTROL = CacheControl.Builder()
    .maxAge(10, MINUTES).build()
private val DEFAULT_HEADERS = Headers.Builder().build()
private val DEFAULT_BODY: RequestBody = FormBody.Builder().build()

fun GET(url: String, headers: Headers = DEFAULT_HEADERS, cache: CacheControl = DEFAULT_CACHE_CONTROL): Request
fun POST(url: String, headers: Headers = DEFAULT_HEADERS, body: RequestBody = DEFAULT_BODY, cache: CacheControl = DEFAULT_CACHE_CONTROL): Request
fun PUT(url: String, headers: Headers = DEFAULT_HEADERS, body: RequestBody = DEFAULT_BODY, cache: CacheControl = DEFAULT_CACHE_CONTROL): Request
fun DELETE(url: String, headers: Headers = DEFAULT_HEADERS, body: RequestBody = DEFAULT_BODY, cache: CacheControl = DEFAULT_CACHE_CONTROL): Request
```

### Key Features

#### Response Caching

- **Cache Size**: 5 MiB disk cache in `context.cacheDir/network_cache`
- **Default TTL**: 10 minutes
- **Implementation**: OkHttp Cache

```kotlin
// NetworkHelper.kt
.cache(
    Cache(
        directory = File(context.cacheDir, "network_cache"),
        maxSize = 5L * 1024 * 1024, // 5 MiB
    )
)
```

#### Async Support

Dual support for both Coroutines and RxJava:

```kotlin
// Coroutines
suspend fun Call.await(): Response
suspend fun Call.awaitSuccess(): Response  // Throws HttpException on non-2xx

// RxJava
fun Call.asObservable(): Observable<Response>
fun Call.asObservableSuccess(): Observable<Response>  // Emits error on non-2xx
```

#### Progress Tracking

Built-in support for download progress tracking:

```kotlin
// OkHttpExtensions.kt
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
```

#### HTTP Error Handling

Standardized error handling across the application:

```kotlin
class HttpException(val code: Int) : IllegalStateException("HTTP error $code")

suspend fun Call.awaitSuccess(): Response {
    val callStack = Exception().stackTrace.run { copyOfRange(1, size) }
    val response = await(callStack)
    if (!response.isSuccessful) {
        response.close()
        throw HttpException(response.code).apply { stackTrace = callStack }
    }
    return response
}
```

---

## 2. Cookie Handling

### Architecture: AndroidCookieJar

**Location**: `core/main/src/androidMain/kotlin/eu/kanade/tachiyomi/network/AndroidCookieJar.kt`

The `AndroidCookieJar` class bridges OkHttp's CookieJar interface with Android's WebView CookieManager, enabling automatic synchronization between HTTP requests and WebView sessions.

```kotlin
class AndroidCookieJar : CookieJar {
    private val manager = CookieManager.getInstance()  // Android's WebView CookieManager

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

### Integration with OkHttp

**Location**: `core/main/src/androidMain/kotlin/eu/kanade/tachiyomi/network/NetworkHelper.kt`

```kotlin
class NetworkHelper(
    val context: Context,
    private val preferences: NetworkPreferences,
    private val block: (OkHttpClient.Builder) -> Unit,
) {
    val cookieJar = AndroidCookieJar()

    val client: OkHttpClient = run {
        val builder = OkHttpClient.Builder()
            .cookieJar(cookieJar)  // ← Key: Automatic cookie sync
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .callTimeout(2, TimeUnit.MINUTES)
            .cache(Cache(File(context.cacheDir, "network_cache"), 5L * 1024 * 1024))
            .addInterceptor(UncaughtExceptionInterceptor())
            .addInterceptor(UserAgentInterceptor(::defaultUserAgent))
            .addNetworkInterceptor(IgnoreGzipInterceptor())
            .addNetworkInterceptor(BrotliInterceptor)

        block(builder)

        builder.addInterceptor(CloudflareInterceptor(context, cookieJar, ::defaultUserAgent))

        // DNS configuration
        when (preferences.dohProvider().get()) {
            PREF_DOH_CLOUDFLARE -> builder.dohCloudflare()
            PREF_DOH_GOOGLE -> builder.dohGoogle()
            // ... other providers
        }

        builder.build()
    }
}
```

### Cookie Persistence

#### Automatic Persistence

- Android's `CookieManager` handles persistence automatically across app restarts
- Cookies are stored in the app's private data directory
- No manual serialization required

#### WebView Synchronization

- Cookies set via HTTP (OkHttp) are immediately available to WebView
- Cookies set in WebView (e.g., via JavaScript) are available to OkHttp requests
- Synchronization is bidirectional and automatic

#### Per-Source Isolation

- Each source extension shares the same `CookieManager` instance
- Cookie isolation is achieved through URL domain matching
- No explicit per-source cookie jars required

---

## 3. WebView for Cookie Persistence & Challenges

### Cloudflare Bypass (Primary Use Case)

**Location**: `core/main/src/androidMain/kotlin/eu/kanade/tachiyomi/network/interceptor/CloudflareInterceptor.kt`

The `CloudflareInterceptor` extends `WebViewInterceptor` and automatically handles Cloudflare anti-bot challenges by loading the URL in WebView and waiting for the `cf_clearance` cookie.

```kotlin
class CloudflareInterceptor(
    private val context: Context,
    private val cookieManager: AndroidCookieJar,
    defaultUserAgentProvider: () -> String,
) : WebViewInterceptor(context, defaultUserAgentProvider) {

    override fun shouldIntercept(response: Response): Boolean {
        // Check if Cloudflare anti-bot is on
        return response.code in ERROR_CODES && response.header("Server") in SERVER_CHECK
    }

    override fun intercept(
        chain: Interceptor.Chain,
        request: Request,
        response: Response,
    ): Response {
        try {
            response.close()
            // Clear old cf_clearance cookie
            cookieManager.remove(request.url, COOKIE_NAMES, 0)
            val oldCookie = cookieManager.get(request.url)
                .firstOrNull { it.name == "cf_clearance" }

            // Resolve with WebView
            resolveWithWebView(request, oldCookie)

            // Retry request with new cookies
            return chain.proceed(request)
        } catch (e: CloudflareBypassException) {
            throw IOException(context.getString(MR.strings.failed_to_bypass_cloudflare), e)
        } catch (e: Exception) {
            throw IOException(e)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun resolveWithWebView(originalRequest: Request, oldCookie: Cookie?) {
        val latch = CountDownLatch(1)
        var webView: WebView? = null
        var challengeFound = false
        var cloudflareBypassed = false
        var isWebViewOutdated = false

        val origRequestUrl = originalRequest.url.toString()
        val headers = parseHeaders(originalRequest.headers)

        executor.execute {
            webView = createWebView(originalRequest)

            webView?.webViewClient = object : WebViewClientCompat() {
                override fun onPageFinished(view: WebView, url: String) {
                    fun isCloudFlareBypassed(): Boolean {
                        return cookieManager.get(origRequestUrl.toHttpUrl())
                            .firstOrNull { it.name == "cf_clearance" }
                            .let { it != null && it != oldCookie }
                    }

                    if (isCloudFlareBypassed()) {
                        cloudflareBypassed = true
                        latch.countDown()
                    }

                    if (url == origRequestUrl && !challengeFound) {
                        // The first request didn't return the challenge, abort.
                        latch.countDown()
                    }
                }

                override fun onReceivedErrorCompat(
                    view: WebView,
                    errorCode: Int,
                    description: String?,
                    failingUrl: String,
                    isMainFrame: Boolean,
                ) {
                    if (isMainFrame) {
                        if (errorCode in ERROR_CODES) {
                            // Found the Cloudflare challenge page.
                            challengeFound = true
                        } else {
                            // Unlock thread, the challenge wasn't found.
                            latch.countDown()
                        }
                    }
                }
            }

            webView?.loadUrl(origRequestUrl, headers)
        }

        // Wait up to 30 seconds for challenge to be solved
        latch.awaitFor30Seconds()

        executor.execute {
            if (!cloudflareBypassed) {
                isWebViewOutdated = webView?.isOutdated() == true
            }

            webView?.run {
                stopLoading()
                destroy()
            }
        }

        // Throw exception if we failed to bypass Cloudflare
        if (!cloudflareBypassed) {
            if (isWebViewOutdated) {
                context.toast(MR.strings.please_update_webview, Toast.LENGTH_LONG)
            }
            throw CloudflareBypassException()
        }
    }
}

private val ERROR_CODES = listOf(403, 503)
private val SERVER_CHECK = arrayOf("cloudflare-nginx", "cloudflare")
private val COOKIE_NAMES = listOf("cf_clearance")

private class CloudflareBypassException : Exception()
```

### WebView Interceptor Base Class

**Location**: `core/main/src/androidMain/kotlin/eu/kanade/tachiyomi/network/interceptor/WebViewInterceptor.kt`

```kotlin
abstract class WebViewInterceptor(
    private val context: Context,
    private val defaultUserAgentProvider: () -> String,
) : Interceptor {

    private val initWebView by lazy {
        // Early WebView initialization to avoid blocking main thread
        if (DeviceUtil.isMiui || Build.VERSION.SDK_INT == Build.VERSION_CODES.S && DeviceUtil.isSamsung) {
            return@lazy
        }

        try {
            WebSettings.getDefaultUserAgent(context)
        } catch (_: Exception) {
            // Avoid crashes during WebView updates
        }
    }

    abstract fun shouldIntercept(response: Response): Boolean
    abstract fun intercept(chain: Interceptor.Chain, request: Request, response: Response): Response

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val response = chain.proceed(request)
        if (!shouldIntercept(response)) {
            return response
        }

        if (!WebViewUtil.supportsWebView(context)) {
            launchUI {
                context.toast(MR.strings.webview_is_required, Toast.LENGTH_LONG)
            }
            return response
        }
        initWebView

        return intercept(chain, request, response)
    }

    fun parseHeaders(headers: Headers): Map<String, String> {
        return headers
            .filter { (name, value) -> isRequestHeaderSafe(name, value) }
            .groupBy(keySelector = { (name, _) -> name }) { (_, value) -> value }
            .mapValues { it.value.getOrNull(0).orEmpty() }
    }

    fun CountDownLatch.awaitFor30Seconds() {
        await(30, TimeUnit.SECONDS)
    }

    fun createWebView(request: Request): WebView {
        return WebView(context).apply {
            setDefaultSettings()
            // Avoid sending empty User-Agent, Chromium WebView will reset to default if empty
            settings.userAgentString = request.header("User-Agent") ?: defaultUserAgentProvider()
        }
    }
}

// Based on [IsRequestHeaderSafe] in Chromium source code
private fun isRequestHeaderSafe(_name: String, _value: String): Boolean {
    val name = _name.lowercase(Locale.ENGLISH)
    val value = _value.lowercase(Locale.ENGLISH)
    if (name in unsafeHeaderNames || name.startsWith("proxy-")) return false
    if (name == "connection" && value == "upgrade") return false
    return true
}

private val unsafeHeaderNames = listOf(
    "content-length", "host", "trailer", "te", "upgrade",
    "cookie2", "keep-alive", "transfer-encoding", "set-cookie"
)
```

### Key Benefits of WebView Integration

1. **Automatic Cookie Sync**: Cookies set in WebView are available to OkHttp (via AndroidCookieJar)
2. **Cloudflare Bypass**: WebView can solve JavaScript challenges automatically
3. **Anti-Bot Protection**: Headers and behavior mimic real browser
4. **Login Support**: WebViewActivity for manual authentication
5. **Zero Configuration**: Works out-of-the-box without user setup

---

## 4. Authentication for Source Extensions

### Extension API: HttpSource Base Class

**Location**: `source/api/src/commonMain/kotlin/eu/kanade/tachiyomi/source/online/HttpSource.kt`

```kotlin
abstract class HttpSource : CatalogueSource {
    private var delegate: DelegatedHttpSource? = null

    /**
     * Network service (injected via dependency injection)
     */
    protected val network: NetworkHelper by injectLazy()

    /**
     * Base URL of the website without the trailing slash
     */
    abstract val baseUrl: String

    /**
     * Default network client for doing requests.
     * All extensions share the same OkHttpClient instance unless overridden.
     */
    open val client: OkHttpClient
        get() = network.client

    /**
     * Headers used for requests.
     */
    open val headers: Headers by lazy { headersBuilder().build() }

    /**
     * Headers builder for requests. Implementations can override this method for custom headers.
     */
    protected open fun headersBuilder() = Headers.Builder().apply {
        add("User-Agent", network.defaultUserAgent)
    }

    // Example: Make a request
    override fun fetchPopularManga(page: Int): Observable<MangasPage> {
        return client.newCall(popularMangaRequest(page))
            .asObservableSuccess()
            .map { response -> popularMangaParse(response) }
    }
}
```

### Authentication Strategies

#### 1. Automatic (Cookie-Based)

Cookies are automatically managed via `AndroidCookieJar`. Source extensions simply need to:

- Navigate to login page in WebView
- Submit credentials
- Cookies are automatically persisted and available to OkHttp

#### 2. Manual (WebViewActivity)

For sources requiring complex authentication flows:

```kotlin
// WebViewActivity.kt - Opens a WebView for manual login
// Cookies are automatically synced via AndroidCookieJar
```

#### 3. Custom Headers

Sources can override the `headers` property to add authentication tokens:

```kotlin
class MySource : HttpSource() {
    override val headers: Headers by lazy {
        headersBuilder()
            .add("Authorization", "Bearer $token")
            .add("X-API-Key", apiKey)
            .build()
    }
}
```

#### 4. Per-Source Client Configuration

Sources requiring custom network configuration can override the `client` property:

```kotlin
class MySource : HttpSource() {
    override val client: OkHttpClient
        get() = network.client.newBuilder()
            .addInterceptor(AuthInterceptor())
            .addInterceptor(RetryInterceptor(maxRetries = 3))
            .build()
}
```

### Interceptor Chain (Order Matters)

The interceptor chain is applied in the following order:

1. **UncaughtExceptionInterceptor** - Catch crashes and wrap in IOException
2. **UserAgentInterceptor** - Add default User-Agent if missing
3. **CloudflareInterceptor** - Handle Cloudflare challenges (uses WebView)
4. **IgnoreGzipInterceptor** (network) - Decompress Gzip
5. **BrotliInterceptor** (network) - Decompress Brotli
6. **RateLimitInterceptor** - Throttle requests per source
7. **SpecificHostRateLimitInterceptor** - Per-host rate limiting
8. **UserAgentInterceptor** (duplicate? - possible bug in yokai codebase)

**Note**: Network interceptors (4, 5) operate on the raw network stream, while application interceptors (1, 2, 3, 6, 7) operate on the request/response chain.

---

## 5. DNS Configuration

### Extensive DNS over HTTPS (DoH) Support

**Location**: `core/main/src/androidMain/kotlin/eu/kanade/tachiyomi/network/DohProviders.kt`

Yokai provides configurable DoH support via 12 different providers, selectable in app settings.

```kotlin
// NetworkPreferences.kt
fun dohProvider() = preferenceStore.getInt("doh_provider", -1)  // -1 = disabled

// NetworkHelper.kt
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

### Example DoH Provider

```kotlin
// DohProviders.kt
fun OkHttpClient.Builder.dohCloudflare() = dns(
    DnsOverHttps.Builder().client(build())
        .url("https://cloudflare-dns.com/dns-query".toHttpUrl())
        .bootstrapDnsHosts(
            InetAddress.getByName("162.159.36.1"),
            InetAddress.getByName("162.159.46.1"),
            InetAddress.getByName("1.1.1.1"),
            InetAddress.getByName("1.0.0.1"),
            InetAddress.getByName("162.159.132.53"),
            InetAddress.getByName("2606:4700:4700::1111"),
            InetAddress.getByName("2606:4700:4700::1001"),
            InetAddress.getByName("2606:4700:4700::0064"),
            InetAddress.getByName("2606:4700:4700::6400"),
        )
        .build()
)
```

### Supported Providers (12 total)

| #   | Provider   | URL                                            | Region/Focus         |
| --- | ---------- | ---------------------------------------------- | -------------------- |
| 1   | Cloudflare | `https://cloudflare-dns.com/dns-query`         | Global (primary)     |
| 2   | Google     | `https://dns.google/dns-query`                 | Global               |
| 3   | AdGuard    | `https://dns-unfiltered.adguard.com/dns-query` | Global (unfiltered)  |
| 4   | Quad9      | `https://dns.quad9.net/dns-query`              | Global (security)    |
| 5   | AliDNS     | `https://dns.alidns.com/dns-query`             | China                |
| 6   | DNSPod     | `https://doh.pub/dns-query`                    | China                |
| 7   | 360        | `https://doh.360.cn/dns-query`                 | China                |
| 8   | Quad101    | `https://dns.twnic.tw/dns-query`               | Taiwan               |
| 9   | Mullvad    | `https://dns.mullvad.net/dns-query`            | Privacy-focused      |
| 10  | Control D  | `https://freedns.controld.com/p0`              | Global (unfiltered)  |
| 11  | Njalla     | `https://dns.njal.la/dns-query`                | Privacy (no logging) |
| 12  | Shecan     | `https://free.shecan.ir/dns-query`             | Iran                 |

**Bootstrap DNS Fallback**: Each DoH provider includes bootstrap DNS IPs to prevent circular dependencies when the DoH endpoint itself requires DNS resolution.

---

## Additional Network Features

### User-Agent Management

**Location**: `core/main/src/androidMain/kotlin/eu/kanade/tachiyomi/network/interceptor/UserAgentInterceptor.kt`

```kotlin
class UserAgentInterceptor(
    private val defaultUserAgentProvider: () -> String,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()

        return if (originalRequest.header("User-Agent").isNullOrEmpty()) {
            val newRequest = originalRequest
                .newBuilder()
                .removeHeader("User-Agent")
                .addHeader("User-Agent", defaultUserAgentProvider())
                .build()
            chain.proceed(newRequest)
        } else {
            chain.proceed(originalRequest)
        }
    }
}
```

**Default User-Agent**:

```
Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36
```

### Rate Limiting

**Location**: `core/main/src/androidMain/kotlin/eu/kanade/tachiyomi/network/interceptor/RateLimitInterceptor.kt`

Implements per-source rate limiting to prevent IP bans:

- Configurable requests per second
- Automatic delay between requests
- Respects Retry-After headers from servers

### Compression Support

Built-in support for multiple compression formats:

- **Gzip**: Handled by OkHttp automatically (decompressed via `IgnoreGzipInterceptor`)
- **Brotli**: Additional support via `okhttp-brotli` library

---

## Summary of Key Architectural Decisions

1. **Single Shared OkHttpClient**: All extensions share one client instance to maximize cache efficiency and connection pooling
2. **Automatic Cookie Synchronization**: No manual cookie management required via AndroidCookieJar
3. **Interceptor-Based Architecture**: Modular design allows easy addition/removal of features
4. **WebView Integration**: Native API integration for seamless cookie sync and Cloudflare bypass
5. **Dependency Injection**: Network client injected into extensions via Injekt
6. **Comprehensive DoH Support**: 12 providers for privacy and censorship bypass
7. **Built-in Caching**: 5 MiB disk cache with 10-minute default TTL
8. **Progress Tracking**: Native support for download progress callbacks
9. **Dual Async Support**: Coroutines and RxJava compatibility
10. **Standardized Error Handling**: HttpException wrapper for consistent error reporting

This architecture provides a production-grade network layer with minimal manual configuration required from extension developers.
