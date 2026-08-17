package com.rajarsheechatterjee.LNReader

import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.OkHttpClientProvider

/**
 * Integrates the configured DoH DNS resolver into React Native's OkHttp clients.
 *
 * Covers: RN fetch(), Fresco images, NativeFile downloads, and NativeZipArchive remote backups.
 * Does NOT cover: WebView (Chromium DNS).
 *
 * DoHManagerModule.initializeFromNative() must be called before this factory is set,
 * so the DNS instance is already built when createNewNetworkModuleClient() is invoked.
 */
class DoHOkHttpClientFactory : OkHttpClientFactory {
    override fun createNewNetworkModuleClient(): okhttp3.OkHttpClient {
        val builder = OkHttpClientProvider.createClientBuilder()
        val doh = DoHManagerModule.getDnsInstance()
        if (doh != null) {
            builder.dns(doh)
        }
        return builder.build()
    }
}
