package com.rajarsheechatterjee.NativeZipArchive

import org.junit.Assert.*
import org.junit.Test
import java.io.File

class NativeZipArchiveTest {

    private val tempDir: File = File(System.getProperty("java.io.tmpdir"), "NativeZipArchiveTest-${System.nanoTime()}")
        .also { it.mkdirs() }

    @Test
    fun `validateZipEntry rejects empty entry name`() {
        val result = NativeZipArchive.validateZipEntry(tempDir.absolutePath, "")
        assertNull(result)
    }

    @Test
    fun `validateZipEntry rejects absolute unix path`() {
        val result = NativeZipArchive.validateZipEntry(tempDir.absolutePath, "/etc/passwd")
        assertNull(result)
    }

    @Test
    fun `validateZipEntry rejects absolute windows path`() {
        val result = NativeZipArchive.validateZipEntry(tempDir.absolutePath, "\\windows\\system32")
        assertNull(result)
    }

    @Test
    fun `validateZipEntry rejects traversal with double dot`() {
        val result = NativeZipArchive.validateZipEntry(tempDir.absolutePath, "../outside.txt")
        assertNull(result)
    }

    @Test
    fun `validateZipEntry rejects traversal embedded in path`() {
        val result = NativeZipArchive.validateZipEntry(tempDir.absolutePath, "subdir/../../outside.txt")
        assertNull(result)
    }

    @Test
    fun `validateZipEntry rejects traversal with backslash`() {
        val result = NativeZipArchive.validateZipEntry(tempDir.absolutePath, "subdir\\..\\outside.txt")
        assertNull(result)
    }

    @Test
    fun `validateZipEntry rejects null byte in name`() {
        val result = NativeZipArchive.validateZipEntry(tempDir.absolutePath, "file\u0000.txt")
        assertNull(result)
    }

    @Test
    fun `validateZipEntry accepts valid nested entry`() {
        val result = NativeZipArchive.validateZipEntry(tempDir.absolutePath, "subdir/nested/file.txt")
        assertNotNull(result)
        assertTrue(result!!.canonicalPath.startsWith(tempDir.canonicalPath))
    }

    @Test
    fun `validateZipEntry accepts simple filename`() {
        val result = NativeZipArchive.validateZipEntry(tempDir.absolutePath, "chapter.txt")
        assertNotNull(result)
    }

    @Test
    fun `validateZipEntry accepts directory entry`() {
        val result = NativeZipArchive.validateZipEntry(tempDir.absolutePath, "META-INF/")
        assertNotNull(result)
    }
}
