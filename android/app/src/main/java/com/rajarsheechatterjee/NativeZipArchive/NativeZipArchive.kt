package com.rajarsheechatterjee.NativeZipArchive

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.lnreader.spec.NativeZipArchiveSpec
import com.rajarsheechatterjee.LNReader.DoHManagerModule
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import java.util.concurrent.TimeUnit
import java.util.zip.ZipEntry
import java.util.zip.ZipFile
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

class NativeZipArchive(context: ReactApplicationContext) : NativeZipArchiveSpec(context) {

    companion object {
        private const val MAX_ENTRIES = 10000
        private const val MAX_ENTRY_SIZE = 100L * 1024 * 1024 // 100 MB per entry
        private const val MAX_TOTAL_SIZE = 500L * 1024 * 1024 // 500 MB total uncompressed
        private const val CONNECT_TIMEOUT_MS = 15_000
        private const val READ_TIMEOUT_MS = 30_000

        /**
         * Shared OkHttpClient used by remote backup operations.
         * Picks up DoH DNS when configured via DoHManagerModule.initializeFromNative().
         * Falls back to system DNS when DoH is disabled.
         */
        private val httpClient: OkHttpClient by lazy {
            val builder = OkHttpClient.Builder()
                .connectTimeout(CONNECT_TIMEOUT_MS.toLong(), TimeUnit.MILLISECONDS)
                .readTimeout(READ_TIMEOUT_MS.toLong(), TimeUnit.MILLISECONDS)
            val doh = DoHManagerModule.getDnsInstance()
            if (doh != null) {
                builder.dns(doh)
            }
            builder.build()
        }

        /**
         * Validate a zip entry name to prevent path traversal (Zip Slip).
         * Returns the resolved destination file, or null if the entry is unsafe.
         */
        fun validateZipEntry(distDirPath: String, entryName: String): File? {
            if (entryName.isEmpty()) return null
            // Reject null bytes
            if (entryName.indexOf('\u0000') >= 0) return null
            // Reject absolute paths
            if (entryName.startsWith("/") || entryName.startsWith("\\")) return null
            // Reject any .. segment
            val parts = entryName.replace('\\', '/').split('/')
            for (part in parts) {
                if (part == "..") return null
            }
            val destFile = File(distDirPath, entryName)
            // Canonicalize and verify the resolved path stays under the destination root
            val canonicalDist = File(distDirPath).canonicalPath
            val canonicalDest = destFile.canonicalPath
            if (!canonicalDest.startsWith(canonicalDist + File.separator) && canonicalDest != canonicalDist) {
                return null
            }
            return destFile
        }
    }

    @ReactMethod
    override fun unzip(sourceFilePath: String, distDirPath: String, promise: Promise) {
        Thread {
            val stagingDir = File(
                File(distDirPath).absoluteFile.parentFile,
                ".staging-${UUID.randomUUID()}",
            )
            try {
                stagingDir.mkdirs()
                ZipFile(sourceFilePath).use { zf ->
                    var entryCount = 0
                    var totalSize = 0L
                    zf.entries().asSequence().filterNot { it.isDirectory }.forEach { zipEntry ->
                        entryCount++
                        if (entryCount > MAX_ENTRIES) {
                            throw SecurityException("Archive exceeds maximum entry count ($MAX_ENTRIES)")
                        }
                        if (zipEntry.size > MAX_ENTRY_SIZE) {
                            throw SecurityException("Entry '${zipEntry.name}' exceeds maximum size (${zipEntry.size} > $MAX_ENTRY_SIZE)")
                        }
                        val newFile = validateZipEntry(stagingDir.absolutePath, zipEntry.name)
                            ?: throw SecurityException("Unsafe zip entry: ${zipEntry.name}")
                        newFile.parentFile?.mkdirs()
                        zf.getInputStream(zipEntry).use { inputStream ->
                            FileOutputStream(newFile).use { fos ->
                                totalSize += copyEntry(inputStream, fos, totalSize, zipEntry.name)
                            }
                        }
                        Thread.yield()
                    }
                }
                // Extraction succeeded — atomically swap staging into destination
                swapStagingToDestination(stagingDir, File(distDirPath))
                promise.resolve(null)
            } catch (e: Exception) {
                deleteRecursive(stagingDir)
                promise.reject(e)
            }
        }.start()
    }

    @ReactMethod
    override fun zip(sourceDirPath: String, zipFilePath: String, promise: Promise) {
        Thread {
            try {
                FileOutputStream(zipFilePath).use { fos ->
                    ZipOutputStream(fos).use { zos -> zipProcess(sourceDirPath, zos) }
                }
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject(e)
            }
        }.start()
    }

    @ReactMethod
    override fun remoteUnzip(
        distDirPath: String,
        urlString: String,
        headers: ReadableMap,
        promise: Promise
    ) {
        Thread {
            val stagingDir = File(
                File(distDirPath).absoluteFile.parentFile,
                ".staging-${UUID.randomUUID()}",
            )
            var response: Response? = null
            try {
                stagingDir.mkdirs()
                val requestBuilder = Request.Builder().url(urlString).get()
                buildOkHeaders(headers, requestBuilder)
                val request = requestBuilder.build()
                response = httpClient.newCall(request).execute()
                if (!response.isSuccessful) {
                    throw Exception("HTTP ${response.code} for $urlString")
                }
                response.body?.byteStream()?.use { bodyStream ->
                    ZipInputStream(bodyStream).use { zis ->
                        var entryCount = 0
                        var totalSize = 0L
                        generateSequence { zis.nextEntry }
                            .filterNot { it.isDirectory }
                            .forEach { zipEntry ->
                                entryCount++
                                if (entryCount > MAX_ENTRIES) {
                                    throw SecurityException("Archive exceeds maximum entry count ($MAX_ENTRIES)")
                                }
                                val newFile = validateZipEntry(stagingDir.absolutePath, zipEntry.name)
                                    ?: throw SecurityException("Unsafe zip entry: ${zipEntry.name}")
                                newFile.parentFile?.mkdirs()
                                FileOutputStream(newFile).use { fos ->
                                    totalSize += copyEntry(zis, fos, totalSize, zipEntry.name)
                                }
                                Thread.yield()
                            }
                    }
                }
                // Extraction succeeded — atomically swap staging into destination
                swapStagingToDestination(stagingDir, File(distDirPath))
                promise.resolve(null)
            } catch (e: Exception) {
                deleteRecursive(stagingDir)
                promise.reject(e)
            } finally {
                response?.close()
            }
        }.start()
    }

    /**
     * Atomically swap a staging directory into the destination.
     * Preserves the existing destination on failure; rolls back if swap fails.
     *
     * Strategy:
     * 1. If dest doesn't exist: staging → dest (clean)
     * 2. If dest is empty dir: delete it, staging → dest (clean)
     * 3. If dest has content: dest → displaced, staging → dest, cleanup displaced
     * On failure: restore displaced, cleanup staging.
     */
    private fun swapStagingToDestination(stagingDir: File, destDir: File) {
        var displaced: File? = null
        try {
            if (!destDir.exists()) {
                // Case 1: destination doesn't exist — clean rename
                if (!stagingDir.renameTo(destDir)) {
                    throw IllegalStateException("Failed to move staging to destination")
                }
            } else if (destDir.isDirectory && destDir.listFiles()?.isEmpty() == true) {
                // Case 2: empty directory — remove it, then rename
                destDir.delete()
                if (!stagingDir.renameTo(destDir)) {
                    throw IllegalStateException("Failed to move staging to destination")
                }
            } else {
                // Case 3: existing content — move aside, then rename staging into place
                displaced = File(destDir.parentFile, ".displaced-${UUID.randomUUID()}")
                if (!destDir.renameTo(displaced)) {
                    throw IllegalStateException("Failed to back up existing destination")
                }
                if (!stagingDir.renameTo(destDir)) {
                    // Swap failed — restore original
                    displaced.renameTo(destDir)
                    throw IllegalStateException("Failed to swap staging into destination")
                }
                // Success — remove backed-up original
                deleteRecursive(displaced)
                displaced = null
            }
        } catch (e: Exception) {
            // Rollback: if we moved the original aside, put it back
            displaced?.let { orig ->
                if (!destDir.exists()) {
                    orig.renameTo(destDir)
                } else {
                    deleteRecursive(orig)
                }
            }
            throw e
        }
    }

    private fun copyEntry(
        input: java.io.InputStream,
        output: java.io.OutputStream,
        totalBefore: Long,
        entryName: String,
    ): Long {
        val buffer = ByteArray(4096)
        var entrySize = 0L
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            entrySize += read
            if (entrySize > MAX_ENTRY_SIZE || totalBefore + entrySize > MAX_TOTAL_SIZE) {
                throw SecurityException("Archive exceeds extraction size limit at entry '$entryName'")
            }
            output.write(buffer, 0, read)
        }
        return entrySize
    }

    private fun deleteRecursive(file: File) {
        if (file.isDirectory) {
            file.listFiles()?.forEach { deleteRecursive(it) }
        }
        file.delete()
    }

    private fun zipProcess(sourceDirPath: String, zos: ZipOutputStream) {
        val sourceDir = File(sourceDirPath)
        sourceDir.walkBottomUp().filter { it.isFile }.forEach { file ->
            val zipFileName =
                file.absolutePath.removePrefix(sourceDir.absolutePath).removePrefix("/")
            val entry = ZipEntry("$zipFileName${(if (file.isDirectory) "/" else "")}")
            zos.putNextEntry(entry)
            file.inputStream().use { fis ->
                fis.copyTo(zos, 4096)
                fis.close()
            }
            Thread.yield()
        }
    }

    @ReactMethod
    override fun remoteZip(
        sourceDirPath: String,
        urlString: String,
        headers: ReadableMap,
        promise: Promise
    ) {
        Thread {
            var response: Response? = null
            try {
                // Build a streaming request body that zips sourceDirPath on the fly.
                // OkHttp's .toRequestBody() streams data lazily, so this is memory-efficient.
                val requestBody = object : okhttp3.RequestBody() {
                    override fun contentType() = "application/octet-stream".toMediaType()

                    override fun writeTo(sink: okio.BufferedSink) {
                        sink.buffer.use { bufferedSink ->
                            val zos = ZipOutputStream(bufferedSink.outputStream())
                            zipProcess(sourceDirPath, zos)
                        }
                    }
                }
                val requestBuilder = Request.Builder()
                    .url(urlString)
                    .post(requestBody)
                buildOkHeaders(headers, requestBuilder)
                val request = requestBuilder.build()
                response = httpClient.newCall(request).execute()
                if (response!!.isSuccessful) {
                    val responseBody = response!!.body?.string() ?: ""
                    promise.resolve(responseBody)
                } else {
                    throw Exception("HTTP ${response!!.code}")
                }
            } catch (e: Exception) {
                promise.reject(e)
            } finally {
                response?.close()
            }
        }.start()
    }

    /**
     * Convert a ReadableMap of headers into OkHttp Request.Builder headers.
     */
    private fun buildOkHeaders(headers: ReadableMap, builder: Request.Builder) {
        val it = headers.entryIterator
        while (it.hasNext()) {
            val (key, value) = it.next()
            builder.addHeader(key, value.toString())
        }
    }
}
