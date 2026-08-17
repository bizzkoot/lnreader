package com.rajarsheechatterjee.LNReader

import com.facebook.react.bridge.*
import okhttp3.OkHttpClient
import okhttp3.dnsoverhttps.DnsOverHttps
import okhttp3.HttpUrl.Companion.toHttpUrl
import java.net.InetAddress
import android.content.Context
import android.content.SharedPreferences
import java.util.concurrent.TimeUnit

class DoHManagerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val DOH_DISABLED = -1
        const val DOH_CLOUDFLARE = 1
        const val DOH_GOOGLE = 2
        const val DOH_ADGUARD = 3
        const val PREFS_NAME = "DoHManagerPrefs"
        const val KEY_PROVIDER = "current_provider"

        @Volatile
        private var currentProvider: Int = DOH_DISABLED

        @Volatile
        private var dohInstance: DnsOverHttps? = null

        @Volatile
        private var isInitialized: Boolean = false

        /**
         * Initialize DoH from persisted SharedPreferences using native context.
         * Called from MainApplication.onCreate() BEFORE OkHttp clients are created,
         * so the DNS instance is available when OkHttpClientProvider builds its client.
         */
        fun initializeFromNative(context: Context) {
            if (isInitialized) return
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            currentProvider = prefs.getInt(KEY_PROVIDER, DOH_DISABLED)
            dohInstance = buildDnsOverHttps(currentProvider)
            isInitialized = true
        }

        /**
         * Get current DoH DNS instance for OkHttpClient configuration.
         * Returns null if DoH is disabled or not yet initialized.
         */
        fun getDnsInstance(): DnsOverHttps? = dohInstance

        /**
         * Get current provider ID
         */
        fun getCurrentProvider(): Int = currentProvider

        /**
         * Build a DnsOverHttps resolver for the given provider.
         * Uses a bootstrap OkHttpClient with system DNS to resolve the DoH endpoint.
         */
        private fun buildDnsOverHttps(providerId: Int): DnsOverHttps? {
            if (providerId == DOH_DISABLED) {
                return null
            }

            // Bootstrap client uses system DNS to resolve DoH endpoints
            // Note: Certificate pinning removed to prevent outages when DoH providers
            // rotate certificates. Android's platform trust store + Certificate
            // Transparency provides sufficient security for third-party DoH services.
            // See: OWASP Pinning Cheat Sheet (2025) - pinning discouraged for external services
            val bootstrapClient = OkHttpClient.Builder()
                .connectTimeout(5, TimeUnit.SECONDS)
                .readTimeout(5, TimeUnit.SECONDS)
                .writeTimeout(5, TimeUnit.SECONDS)
                .build()

            return when (providerId) {
                DOH_CLOUDFLARE -> {
                    DnsOverHttps.Builder()
                        .client(bootstrapClient)
                        .url("https://cloudflare-dns.com/dns-query".toHttpUrl())
                        .bootstrapDnsHosts(
                            InetAddress.getByName("1.1.1.1"),
                            InetAddress.getByName("1.0.0.1"),
                            InetAddress.getByName("162.159.36.1"),
                            InetAddress.getByName("162.159.46.1")
                        )
                        .build()
                }

                DOH_GOOGLE -> {
                    DnsOverHttps.Builder()
                        .client(bootstrapClient)
                        .url("https://dns.google/dns-query".toHttpUrl())
                        .bootstrapDnsHosts(
                            InetAddress.getByName("8.8.8.8"),
                            InetAddress.getByName("8.8.4.4")
                        )
                        .build()
                }

                DOH_ADGUARD -> {
                    DnsOverHttps.Builder()
                        .client(bootstrapClient)
                        .url("https://dns-unfiltered.adguard.com/dns-query".toHttpUrl())
                        .bootstrapDnsHosts(
                            InetAddress.getByName("94.140.14.140"),
                            InetAddress.getByName("94.140.14.141")
                        )
                        .build()
                }

                else -> null
            }
        }
    }

    private var prefs: SharedPreferences? = null

    private fun initPrefs() {
        if (prefs == null) {
            prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        }
    }

    private fun saveProvider(providerId: Int) {
        initPrefs()
        prefs?.edit()?.putInt(KEY_PROVIDER, providerId)?.commit()
    }

    private fun clearPrefs() {
        initPrefs()
        prefs?.edit()?.clear()?.commit()
    }

    override fun getName(): String = "DoHManager"

    @ReactMethod
    fun setProvider(providerId: Int, promise: Promise) {
        try {
            currentProvider = providerId
            dohInstance = buildDnsOverHttps(providerId)
            saveProvider(providerId)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DOH_ERROR", "Failed to set DoH provider: ${e.message}", e)
        }
    }

    @ReactMethod
    fun getProvider(promise: Promise) {
        try {
            // Initialize from SharedPreferences on first call (fallback if native init missed)
            if (!isInitialized) {
                initializeFromNative(reactApplicationContext)
            }
            promise.resolve(currentProvider)
        } catch (e: Exception) {
            promise.reject("DOH_ERROR", "Failed to get DoH provider: ${e.message}", e)
        }
    }

    @ReactMethod
    fun clearProvider(promise: Promise) {
        try {
            currentProvider = DOH_DISABLED
            dohInstance = null
            clearPrefs()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DOH_ERROR", "Failed to clear DoH provider: ${e.message}", e)
        }
    }

    @ReactMethod
    fun exitApp() {
        try {
            initPrefs()
            prefs?.edit()?.commit()
            reactApplicationContext.currentActivity?.finish()
        } catch (e: Exception) {
            reactApplicationContext.currentActivity?.finish()
        }
    }
}
