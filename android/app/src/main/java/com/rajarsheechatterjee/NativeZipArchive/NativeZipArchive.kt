package com.rajarsheechatterjee.NativeZipArchive

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.lnreader.spec.NativeZipArchiveSpec
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
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
            try {
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
                        val newFile = validateZipEntry(distDirPath, zipEntry.name)
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
                promise.resolve(null)
            } catch (e: Exception) {
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
        val connection = URL(urlString).openConnection() as HttpURLConnection
        Thread {
            try {
                connection.requestMethod = "GET"
                connection.connectTimeout = CONNECT_TIMEOUT_MS
                connection.readTimeout = READ_TIMEOUT_MS
                val it = headers.entryIterator
                while (it.hasNext()) {
                    val (key, value) = it.next()
                    connection.setRequestProperty(key, value.toString())
                }
                // Check HTTP status BEFORE reading the zip stream
                val responseCode = connection.responseCode
                if (responseCode != 200) {
                    throw Exception("HTTP $responseCode for $urlString")
                }
                ZipInputStream(connection.inputStream).use { zis ->
                    var entryCount = 0
                    var totalSize = 0L
                    generateSequence { zis.nextEntry }
                        .filterNot { it.isDirectory }
                        .forEach { zipEntry ->
                            entryCount++
                            if (entryCount > MAX_ENTRIES) {
                                throw SecurityException("Archive exceeds maximum entry count ($MAX_ENTRIES)")
                            }
                            val newFile = validateZipEntry(distDirPath, zipEntry.name)
                                ?: throw SecurityException("Unsafe zip entry: ${zipEntry.name}")
                            newFile.parentFile?.mkdirs()
                            FileOutputStream(newFile).use { fos ->
                                totalSize += copyEntry(zis, fos, totalSize, zipEntry.name)
                            }
                            Thread.yield()
                        }
                }
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject(e)
            } finally {
                connection.disconnect()
            }
        }.start()
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
            val connection = URL(urlString).openConnection() as HttpURLConnection
            try {
                connection.requestMethod = "POST"
                connection.connectTimeout = CONNECT_TIMEOUT_MS
                connection.readTimeout = READ_TIMEOUT_MS
                val it = headers.entryIterator
                while (it.hasNext()) {
                    val (key, value) = it.next()
                    connection.setRequestProperty(key, value.toString())
                }
                ZipOutputStream(connection.outputStream).use { zipProcess(sourceDirPath, it) }
                if (connection.responseCode == 200) {
                    promise.resolve(
                        connection.inputStream.bufferedReader().use { it.readText() })
                } else {
                    throw Exception("HTTP ${connection.responseCode}")
                }
            } catch (e: Exception) {
                promise.reject(e)
            } finally {
                connection.disconnect()
            }
        }.start()
    }
}
