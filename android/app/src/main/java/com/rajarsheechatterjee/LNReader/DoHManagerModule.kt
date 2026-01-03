package com.rajarsheechatterjee.LNReader

import com.facebook.react.bridge.*
import okhttp3.OkHttpClient
import okhttp3.dnsoverhttps.DnsOverHttps
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.CertificatePinner
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
         * Get current DoH DNS instance for OkHttpClient configuration
         * This is called by network layer to apply DoH if enabled
         */
        fun getDnsInstance(): DnsOverHttps? = dohInstance

        /**
         * Get current provider ID
         */
        fun getCurrentProvider(): Int = currentProvider
    }

    private var prefs: SharedPreferences? = null

    // Initialize SharedPreferences on first access
    private fun initPrefs() {
        if (prefs == null) {
            prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        }
    }

    // Save provider to SharedPreferences
    private fun saveProvider(providerId: Int) {
        initPrefs()
        prefs?.edit()?.putInt(KEY_PROVIDER, providerId)?.commit()
    }

    // Load provider from SharedPreferences
    private fun loadProvider(): Int {
        initPrefs()
        return prefs?.getInt(KEY_PROVIDER, DOH_DISABLED) ?: DOH_DISABLED
    }

    // Clear SharedPreferences
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
            // Initialize from SharedPreferences on first call
            if (!isInitialized) {
                currentProvider = loadProvider()
                dohInstance = buildDnsOverHttps(currentProvider)
                isInitialized = true
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
            // Force flush SharedPreferences to prevent data loss
            initPrefs()
            prefs?.edit()?.commit() // Synchronous write
            
            // Graceful exit
            reactApplicationContext.currentActivity?.finish()
        } catch (e: Exception) {
            reactApplicationContext.currentActivity?.finish()
        } finally {
            // Final attempt to exit
            System.exit(0)
        }
    }

    private fun buildDnsOverHttps(providerId: Int): DnsOverHttps? {
        if (providerId == DOH_DISABLED) {
            return null
        }

        // Certificate pinner for MITM protection
        // Pins are public key SHA256 hashes extracted from current certificates
        val certificatePinner = CertificatePinner.Builder()
            .add("cloudflare-dns.com", "sha256/SPfg6FluPIlUc6a5h313BDCxQYNGX+THTy7ig5X3+VA=")
            .add("dns.google", "sha256/6KWWYvlnr74SW1bk3bxciLCcYjTzPN4I4kI8PkirZMA=")
            .add("dns-unfiltered.adguard.com", "sha256/Xvjeq711KsTubsR62ojbrmJ6qcBCbfFuoy4TSyiu3f4=")
            .build()

        // Bootstrap client uses system DNS to resolve DoH endpoints
        val bootstrapClient = OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(5, TimeUnit.SECONDS)
            .writeTimeout(5, TimeUnit.SECONDS)
            .certificatePinner(certificatePinner)
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
