# Key Code Snippets: Yokai Network & Cookie Handling

**Date**: January 1, 2026
**Purpose**: Reference implementation examples from yokai codebase

---

## Table of Contents

1. [NetworkHelper Setup](#1-networkhelper-setup-complete)
2. [Cookie Management Examples](#2-cookie-management-examples)
3. [Cloudflare Bypass Implementation](#3-cloudflare-bypass-implementation)
4. [Custom Source with Authentication](#4-custom-source-with-authentication)
5. [Interceptor Implementation](#5-interceptor-implementation)
6. [DoH Configuration](#6-doh-configuration)
7. [Request/Response Handling](#7-requestresponse-handling)

---

## 1. NetworkHelper Setup (Complete)

**Location**: `core/main/src/androidMain/kotlin/eu/kanade/tachiyomi/network/NetworkHelper.kt`

```kotlin
package eu.kanade.tachiyomi.network

import android.content.Context
import eu.kanade.tachiyomi.network.interceptor.CloudflareInterceptor
import eu.kanade.tachiyomi.network.interceptor.IgnoreGzipInterceptor
import eu.kanade.tachiyomi.network.interceptor.UncaughtExceptionInterceptor
import eu.kanade.tachiyomi.network.interceptor.UserAgentInterceptor
import java.io.File
import java.util.concurrent.TimeUnit
import okhttp3.Cache
import okhttp3.OkHttpClient
import okhttp3.brotli.BrotliInterceptor

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
            .cache(
                Cache(
                    directory = File(context.cacheDir, "network_cache"),
                    maxSize = 5L * 1024 * 1024, // 5 MiB
                )
            )
            .addInterceptor(UncaughtExceptionInterceptor())
            .addInterceptor(UserAgentInterceptor(::defaultUserAgent))
            .addNetworkInterceptor(IgnoreGzipInterceptor())
            .addNetworkInterceptor(BrotliInterceptor)

        // Allow custom interceptor configuration (e.g., for testing)
        block(builder)

        // Cloudflare interceptor (must be after custom interceptors)
        builder.addInterceptor(
            CloudflareInterceptor(context, cookieJar, ::defaultUserAgent),
        )

        // DNS over HTTPS configuration
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

        builder.build()
    }

    @Deprecated("The regular client handles Cloudflare by default")
    @Suppress("UNUSED")
    val cloudflareClient: OkHttpClient = client

    val defaultUserAgent
        get() = preferences.defaultUserAgent().get().replace("\n", " ").trim()
}
```

**Key Points**:

- Single shared OkHttpClient for all extensions
- Automatic cookie persistence via AndroidCookieJar
- Modular interceptor chain for easy feature addition
- Configurable via preferences (DoH provider, User-Agent)

---

## 2. Cookie Management Examples

### AndroidCookieJar Implementation

**Location**: `core/main/src/androidMain/kotlin/eu/kanade/tachiyomi/network/AndroidCookieJar.kt`

```kotlin
package eu.kanade.tachiyomi.network

import android.webkit.CookieManager
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl

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

### Cookie Removal Examples

```kotlin
// Example 1: Remove specific cookie (e.g., cf_clearance)
cookieManager.remove(
    url = "https://example.com".toHttpUrl(),
    cookieNames = listOf("cf_clearance"),
    maxAge = 0  // maxAge=0 = expire immediately
)

// Example 2: Remove all cookies for a domain
cookieManager.remove(
    url = "https://example.com".toHttpUrl(),
    cookieNames = null,  // null = all cookies
    maxAge = -1  // -1 = remove all
)

// Example 3: Remove all cookies globally
cookieManager.removeAll()

// Example 4: Get cookies for a specific URL
val cookies = cookieManager.get("https://example.com".toHttpUrl())
cookies.forEach { cookie ->
    println("Cookie: ${cookie.name}=${cookie.value}")
}
```

### Cookie Sync with WebView

```kotlin
// AndroidCookieJar automatically syncs cookies between OkHttp and WebView
// No manual sync required!

// Step 1: OkHttp makes request → cookies saved to CookieManager
val response = client.newCall(request).execute()
// Cookies are automatically saved via AndroidCookieJar.saveFromResponse()

// Step 2: WebView loads URL → cookies automatically available
webView.loadUrl(url)  // Cookies from OkHttp requests are included

// Step 3: WebView sets cookies (e.g., via login) → available to OkHttp
webView.evaluateJavaScript("document.cookie = 'session=abc123; path=/'", null)
// Cookie is automatically available to subsequent OkHttp requests via loadForRequest()
```

---

## 3. Cloudflare Bypass Implementation

### CloudflareInterceptor

**Location**: `core/main/src/androidMain/kotlin/eu/kanade/tachiyomi/network/interceptor/CloudflareInterceptor.kt`

```kotlin
package eu.kanade.tachiyomi.network.interceptor

import android.annotation.SuppressLint
import android.content.Context
import android.webkit.WebView
import android.widget.Toast
import androidx.core.content.ContextCompat
import eu.kanade.tachiyomi.network.AndroidCookieJar
import eu.kanade.tachiyomi.util.system.WebViewClientCompat
import eu.kanade.tachiyomi.util.system.isOutdated
import eu.kanade.tachiyomi.util.system.toast
import java.io.IOException
import java.util.concurrent.CountDownLatch
import okhttp3.Cookie
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Interceptor
import okhttp3.Request
import okhttp3.Response
import yokai.i18n.MR
import yokai.util.lang.getString

class CloudflareInterceptor(
    private val context: Context,
    private val cookieManager: AndroidCookieJar,
    defaultUserAgentProvider: () -> String,
) : WebViewInterceptor(context, defaultUserAgentProvider) {

    private val executor = ContextCompat.getMainExecutor(context)

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
            // Remove old cf_clearance cookie before bypass
            cookieManager.remove(request.url, COOKIE_NAMES, 0)
            val oldCookie = cookieManager.get(request.url)
                .firstOrNull { it.name == "cf_clearance" }

            // Resolve with WebView
            resolveWithWebView(request, oldCookie)

            // Retry request with new cookies
            return chain.proceed(request)
        }
        // Because OkHttp's enqueue only handles IOExceptions, wrap the exception so that
        // we don't crash the entire app
        catch (e: CloudflareBypassException) {
            throw IOException(context.getString(MR.strings.failed_to_bypass_cloudflare), e)
        } catch (e: Exception) {
            throw IOException(e)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun resolveWithWebView(originalRequest: Request, oldCookie: Cookie?) {
        // We need to lock this thread until the WebView finds the challenge solution url, because
        // OkHttp doesn't support asynchronous interceptors.
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
            // Prompt user to update WebView if it seems too outdated
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

**Key Points**:

- Transparent to extension developers (automatic interception)
- Uses background WebView (no UI blocking)
- Waits for `cf_clearance` cookie before proceeding
- 30-second timeout with cleanup
- Automatic retry with new cookies

---

## 4. Custom Source with Authentication

### Basic Source Implementation

```kotlin
package eu.kanade.tachiyomi.source.online

import eu.kanade.tachiyomi.network.GET
import eu.kanade.tachiyomi.source.model.SChapter
import eu.kanade.tachiyomi.source.model.SManga
import okhttp3.Headers
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response

class MyCustomSource : HttpSource() {

    override val name = "My Source"
    override val baseUrl = "https://example.com"
    override val lang = "en"

    // Use default headers with User-Agent
    override fun headersBuilder() = Headers.Builder().apply {
        add("User-Agent", network.defaultUserAgent)
    }

    // Example: Fetch popular manga
    override fun popularMangaRequest(page: Int): Request {
        return GET("$baseUrl/popular?page=$page", headers)
    }

    override fun popularMangaParse(response: Response): MangasPage {
        // Parse HTML response
        // ...
    }

    // Other required methods: searchManga, mangaDetails, chapterList, pageList, etc.
}
```

### Source with Custom Authentication Headers

```kotlin
class AuthenticatedSource : HttpSource() {

    override val name = "Authenticated Source"
    override val baseUrl = "https://api.example.com"
    override val lang = "en"

    // Add authentication headers
    override val headers: Headers by lazy {
        headersBuilder()
            .add("Authorization", "Bearer $authToken")
            .add("X-API-Key", apiKey)
            .add("X-Client-Version", "1.0.0")
            .build()
    }

    // Or compute headers dynamically
    override fun headersBuilder() = Headers.Builder().apply {
        add("User-Agent", network.defaultUserAgent)
        add("Authorization", "Bearer ${getAuthToken()}")
    }

    private fun getAuthToken(): String {
        // Retrieve token from secure storage
        return preferences.authToken().get()
    }
}
```

### Source with Custom Client Configuration

```kotlin
class CustomClientSource : HttpSource() {

    override val name = "Custom Client Source"
    override val baseUrl = "https://example.com"
    override val lang = "en"

    // Override client for custom configuration
    override val client: OkHttpClient
        get() = network.client.newBuilder()
            .addInterceptor(AuthInterceptor())
            .addInterceptor(RetryInterceptor(maxRetries = 3))
            .connectTimeout(60, TimeUnit.SECONDS)  // Custom timeout
            .readTimeout(60, TimeUnit.SECONDS)
            .build()

    // Custom interceptor for authentication
    inner class AuthInterceptor : Interceptor {
        override fun intercept(chain: Interceptor.Chain): Response {
            val request = chain.request().newBuilder()
                .addHeader("Authorization", "Bearer $token")
                .build()
            return chain.proceed(request)
        }
    }

    // Custom retry interceptor
    inner class RetryInterceptor(private val maxRetries: Int) : Interceptor {
        override fun intercept(chain: Interceptor.Chain): Response {
            var response = chain.proceed(chain.request())
            var retryCount = 0

            while (!response.isSuccessful && retryCount < maxRetries) {
                retryCount++
                response.close()
                response = chain.proceed(chain.request())
            }

            return response
        }
    }
}
```

---

## 5. Interceptor Implementation

### Basic Interceptor Template

```kotlin
package eu.kanade.tachiyomi.network.interceptor

import okhttp3.Interceptor
import okhttp3.Response

class BasicInterceptor : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()

        // Modify request before proceeding
        val modifiedRequest = request.newBuilder()
            .addHeader("X-Custom-Header", "value")
            .build()

        // Proceed with modified request
        val response = chain.proceed(modifiedRequest)

        // Modify response if needed
        return response
    }
}
```

### Request Logging Interceptor

```kotlin
class LoggingInterceptor : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()

        val startTime = System.nanoTime()

        Log.d("HTTP", "Request: ${request.method} ${request.url}")
        Log.d("HTTP", "Headers: ${request.headers}")

        val response = chain.proceed(request)

        val endTime = System.nanoTime()
        val duration = (endTime - startTime) / 1e6

        Log.d("HTTP", "Response: ${response.code} (${duration}ms)")
        Log.d("HTTP", "Headers: ${response.headers}")

        return response
    }
}
```

### Retry Interceptor

```kotlin
class RetryInterceptor(
    private val maxRetries: Int = 3,
    private val retryableCodes: Set<Int> = setOf(408, 429, 500, 502, 503, 504),
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        var response = chain.proceed(chain.request())
        var retryCount = 0

        while (!response.isSuccessful && response.code in retryableCodes && retryCount < maxRetries) {
            retryCount++

            // Extract Retry-After header if present
            val retryAfter = response.header("Retry-After")?.toIntOrNull() ?: 1

            Thread.sleep(retryAfter * 1000L)

            response.close()
            response = chain.proceed(chain.request())
        }

        return response
    }
}
```

### Cache Bypass Interceptor

```kotlin
class CacheBypassInterceptor : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()

        return if (shouldBypassCache(request)) {
            val noCacheRequest = request.newBuilder()
                .cacheControl(CacheControl.FORCE_NETWORK)
                .build()
            chain.proceed(noCacheRequest)
        } else {
            chain.proceed(request)
        }
    }

    private fun shouldBypassCache(request: Request): Boolean {
        // Bypass cache for certain endpoints
        return request.url.encodedPath.contains("/api/live/") ||
               request.url.encodedPath.contains("/api/stream/")
    }
}
```

---

## 6. DoH Configuration

### DoH Provider Implementation

**Location**: `core/main/src/androidMain/kotlin/eu/kanade/tachiyomi/network/DohProviders.kt`

```kotlin
package eu.kanade.tachiyomi.network

import java.net.InetAddress
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.dnsoverhttps.DnsOverHttps

const val PREF_DOH_CLOUDFLARE = 1
const val PREF_DOH_GOOGLE = 2
const val PREF_DOH_ADGUARD = 3
const val PREF_DOH_QUAD9 = 4
const val PREF_DOH_ALIDNS = 5
const val PREF_DOH_DNSPOD = 6
const val PREF_DOH_360 = 7
const val PREF_DOH_QUAD101 = 8
const val PREF_DOH_MULLVAD = 9
const val PREF_DOH_CONTROLD = 10
const val PREF_DOH_NJALLA = 11
const val PREF_DOH_SHECAN = 12

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

fun OkHttpClient.Builder.dohGoogle() = dns(
    DnsOverHttps.Builder().client(build())
        .url("https://dns.google/dns-query".toHttpUrl())
        .bootstrapDnsHosts(
            InetAddress.getByName("8.8.4.4"),
            InetAddress.getByName("8.8.8.8"),
            InetAddress.getByName("2001:4860:4860::8888"),
            InetAddress.getByName("2001:4860:4860::8844"),
        )
        .build()
)

// Additional providers: AdGuard, Quad9, AliDNS, DNSPod, 360, Quad101,
// Mullvad, Control D, Njalla, Shecan
```

### Custom DoH Provider

```kotlin
// Add custom DoH provider
fun OkHttpClient.Builder.dohCustom(
    url: String,
    bootstrapDns: List<String> = emptyList(),
) = dns(
    DnsOverHttps.Builder().client(build())
        .url(url.toHttpUrl())
        .apply {
            if (bootstrapDns.isNotEmpty()) {
                bootstrapDnsHosts(
                    *bootstrapDns.map { InetAddress.getByName(it) }.toTypedArray()
                )
            }
        }
        .build()
)

// Usage
client.newBuilder()
    .dohCustom(
        url = "https://custom-dns.com/dns-query",
        bootstrapDns = listOf("1.2.3.4", "5.6.7.8")
    )
    .build()
```

---

## 7. Request/Response Handling

### Making Requests

```kotlin
// Simple GET request
val response = client.newCall(
    GET("https://example.com/data")
).execute()

// GET request with custom headers
val headers = Headers.Builder()
    .add("Accept", "application/json")
    .add("X-API-Key", "12345")
    .build()

val response = client.newCall(
    GET("https://example.com/data", headers)
).execute()

// POST request with form data
val formBody = FormBody.Builder()
    .add("username", "user")
    .add("password", "pass")
    .build()

val response = client.newCall(
    POST("https://example.com/login", body = formBody)
).execute()

// POST request with JSON
val jsonBody = "{\"name\":\"value\"}".toRequestBody("application/json".toMediaType())

val response = client.newCall(
    POST("https://example.com/api", body = jsonBody)
).execute()
```

### Coroutines Support

```kotlin
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

suspend fun fetchData(): String = withContext(Dispatchers.IO) {
    val response = client.newCall(GET("https://example.com/data"))
        .await()  // Kotlin coroutine support

    if (!response.isSuccessful) {
        throw Exception("HTTP ${response.code}")
    }

    response.body?.string() ?: ""
}

suspend fun fetchDataSuccess(): String = withContext(Dispatchers.IO) {
    val response = client.newCall(GET("https://example.com/data"))
        .awaitSuccess()  // Throws HttpException automatically

    response.body?.string() ?: ""
}
```

### RxJava Support

```kotlin
import rx.Observable
import rx.Single

fun fetchDataObservable(): Single<String> {
    return client.newCall(GET("https://example.com/data"))
        .asObservableSuccess()
        .map { response ->
            response.body?.string() ?: ""
        }
        .toSingle()
}

// Usage in source
override fun fetchPopularManga(page: Int): Observable<MangasPage> {
    return client.newCall(popularMangaRequest(page))
        .asObservableSuccess()
        .map { popularMangaParse(it) }
}
```

### Error Handling

```kotlin
try {
    val response = client.newCall(request).execute()

    if (!response.isSuccessful) {
        // Handle HTTP error
        when (response.code) {
            401 -> throw UnauthorizedException()
            403 -> throw ForbiddenException()
            404 -> throw NotFoundException()
            429 -> throw RateLimitException(response.header("Retry-After")?.toIntOrNull())
            in 500..599 -> throw ServerErrorException(response.code)
            else -> throw HttpException(response.code)
        }
    }

    val body = response.body?.string() ?: ""
    // Process response...

} catch (e: IOException) {
    // Network error (timeout, connection refused, etc.)
    throw NetworkException("Network error", e)
} catch (e: HttpException) {
    // HTTP error from awaitSuccess()
    throw NetworkException("HTTP ${e.code}", e)
}
```

---

## Summary

These code snippets demonstrate yokai's production-grade network architecture:

1. **Automatic cookie persistence** via AndroidCookieJar
2. **Transparent Cloudflare bypass** via WebViewInterceptor
3. **Modular interceptor chain** for easy feature addition
4. **Extensible source API** for custom authentication
5. **Comprehensive DoH support** with 12 providers
6. **Dual async support** (Coroutines + RxJava)
7. **Type-safe error handling** with standardized exceptions

For React Native adaptation, consider creating native modules for cookie persistence and WebView integration to match yokai's capabilities.
