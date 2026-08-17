package com.rajarsheechatterjee.NativeZipArchive

import org.junit.Assert.*
import org.junit.Test
import java.io.File

class NativeZipArchiveTest {

    @Test
    fun `validateZipEntry rejects empty entry name`() {
        val result = NativeZipArchive.validateZipEntry("/tmp/dist", "")
        assertNull(result)
    }

    @Test
    fun `validateZipEntry rejects absolute unix path`() {
        val result = NativeZipArchive.validateZipEntry("/tmp/dist", "/etc/passwd")
        assertNull(result)
    }

    @Test
    fun `validateZipEntry rejects absolute windows path`() {
        val result = NativeZipArchive.validateZipEntry("/tmp/dist", "\\windows\\system32")
        assertNull(result)
    }

    @Test
    fun `validateZipEntry rejects traversal with double dot`() {
        val result = NativeZipArchive.validateZipEntry("/tmp/dist", "../outside.txt")
        assertNull(result)
    }

    @Test
    fun `validateZipEntry rejects traversal embedded in path`() {
        val result = NativeZipArchive.validateZipEntry("/tmp/dist", "subdir/../../outside.txt")
        assertNull(result)
    }

    @Test
    fun `validateZipEntry rejects traversal with backslash`() {
        val result = NativeZipArchive.validateZipEntry("/tmp/dist", "subdir\\..\\outside.txt")
        assertNull(result)
    }

    @Test
    fun `validateZipEntry rejects null byte in name`() {
        val result = NativeZipArchive.validateZipEntry("/tmp/dist", "file\u0000.txt")
        assertNull(result)
    }

    @Test
    fun `validateZipEntry accepts valid nested entry`() {
        val result = NativeZipArchive.validateZipEntry("/tmp/dist", "subdir/nested/file.txt")
        assertNotNull(result)
        assertTrue(result!!.absolutePath.startsWith(File("/tmp/dist").canonicalPath))
    }

    @Test
    fun `validateZipEntry accepts simple filename`() {
        val result = NativeZipArchive.validateZipEntry("/tmp/dist", "chapter.txt")
        assertNotNull(result)
    }

    @Test
    fun `validateZipEntry accepts directory entry`() {
        val result = NativeZipArchive.validateZipEntry("/tmp/dist", "META-INF/")
        assertNotNull(result)
    }
}
