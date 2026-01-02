package com.rajarsheechatterjee.LNReader

import com.facebook.react.bridge.*
import okhttp3.OkHttpClient
import okhttp3.dnsoverhttps.DnsOverHttps
import okhttp3.HttpUrl.Companion.toHttpUrl
import java.net.InetAddress

class DoHManagerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val DOH_DISABLED = -1
        const val DOH_CLOUDFLARE = 1
        const val DOH_GOOGLE = 2
        const val DOH_ADGUARD = 3

        @Volatile
        private var currentProvider: Int = DOH_DISABLED

        @Volatile
        private var dohInstance: DnsOverHttps? = null

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

    override fun getName(): String = "DoHManager"

    @ReactMethod
    fun setProvider(providerId: Int, promise: Promise) {
        try {
            currentProvider = providerId
            dohInstance = buildDnsOverHttps(providerId)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DOH_ERROR", "Failed to set DoH provider: ${e.message}", e)
        }
    }

    @ReactMethod
    fun getProvider(promise: Promise) {
        try {
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
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DOH_ERROR", "Failed to clear DoH provider: ${e.message}", e)
        }
    }

    private fun buildDnsOverHttps(providerId: Int): DnsOverHttps? {
        if (providerId == DOH_DISABLED) {
            return null
        }

        // Bootstrap client uses system DNS to resolve DoH endpoints
        val bootstrapClient = OkHttpClient.Builder().build()

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
