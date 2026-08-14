# Follow-up Audit POV-3: EPUB & Native C++ Correctness

**Date**: 2026-08-15 · **Range**: f0e3b4767..HEAD (fix commits) · **Reviewer**: fresh-context subagent (read-only)

I have all the evidence needed. Here is the complete review artifact.

---

# POV-3: EPUB & Native C++ Correctness Review

**Scope:** `shared/Epub.cpp`, `src/services/epub/import.ts`, `src/screens/reader/utils/sanitizeChapterText.ts` on branch `merge/upstream-sync-2026-08-14`.
**Method:** Static inspection of current files + supporting code (`NativeEpub.cpp`, `NativeFile.kt`, `NativeZipArchive.kt`, `useChapter.ts`, `pluginManager.ts`, `pugixml.cpp/hpp`, `pugiconfig.hpp`, all locale strings, `strings/translations.ts`). No shell tool available, so `git diff f0e3b4767..HEAD` and `pnpm run test` could not be executed directly (findings are based on current-file state; changed-code assumptions are cross-checked against callers).

---

## Findings

### Epub.cpp

**MED | NAV landmarks can overwrite TOC labels; `epub:type` filter missing** — `shared/Epub.cpp:303-317` (`parse_nav_xhtml`): the loop parses **every** `//*[local-name()='nav']` element and `nav_type` (line 313) is read but never used. All navs (toc, landmarks, page-list) write into the single shared `path_to_label` map; later navs win for the same href. If `<nav epub:type="landmarks">` follows `<nav epub:type="toc">` (spec-permitted order), a landmark label such as "Start Reading" overwrites the TOC label for a shared chapter href. `nav_type`'s dead store (also a `-Wunused-but-set-variable` warning) signals the intended `epub:type="toc"` filter was dropped. Fix: only parse the nav whose type attr (prefix-tolerant) is `toc`, or prefer toc entries.

**MED | `toc_href.find("ncx")` heuristic misroutes NCX/nav** — `shared/Epub.cpp:450-456` (`parse_opf_from_folder`): branching is on the **filename containing "ncx"**, not on the matched media-type. A valid NCX named e.g. `toc.xml` (media-type `application/x-dtbncx+xml`, matched at `find_toc_href` lines 258-273) → `find("ncx") == npos` → `parse_nav_xhtml` parses an NCX doc → `local-name()='nav'` finds nothing → empty label map → every chapter falls back to filename-derived names (and the `(2), (3)...` heuristic). Inverse: a nav XHTML named `toc.ncx` goes down the NCX path. No crash; label loss only.

**LOW | `childByLocalName` first-match is namespace-agnostic** — `shared/Epub.cpp:248-256`: `getLocalName` (line 365-370) strips any prefix up to the first `:`, so `dc:title`, `title`, `dcterms:title` all match `childByLocalName(metadata,"title")` — and the **first** child in document order wins. A non-DC-namespaced `<title>`/`<creator>` appearing before the DC element would be misread. In practice EPUB metadata blocks contain only one of each (`dc:*` family has no local-name collisions), so real-world impact is rare. This tolerance is the fix's intent (see answer A).

**LOW | Cover membership check on native side does not percent-decode** — `shared/Epub.cpp:496-497` builds `image_paths` from raw manifest `href`; `findCoverImagePath` (`Epub.cpp:417-432`) joins the in-document `src` raw and does `image_paths.count(image_path)` (line 432). If the manifest href is percent-encoded but the cover-doc `src` is not (or vice versa), the paths differ → cover silently not found. TS-side (`import.ts`) decodes consistently, so only the native cover path is exposed.

**LOW | Malformed container.xml fails silently into an empty novel** — `shared/Epub.cpp:560-576`: if no `rootfile` matches, `.attribute("full-path").value()` is safe (pugi returns `""`, verified `pugixml.cpp:5697-5703`, `6067-6070`) but `opf_path=""` → `join` returns `base_dir` → `load_file` on a directory fails → `parse_opf_from_folder` returns with all-empty `EpubMetadata`. `importEpub` then inserts a novel with zero chapters and no name fallback to filename. No throw, no user feedback.

**NOTE | `findImageReference` bare-`#` fix verified correct** — `shared/Epub.cpp:387-409`: for `img`/`image` nodes, all three attributes (`src`, `href`, `xlink:href`) are scanned; a bare `#sprite` reference yields an empty `stripped` (line 396-400) so scanning continues to the next attribute and then to children (line 408). No short-circuit regression. Residual: `xlink:href` is matched by exact name — a non-`xlink` prefix won't match; the first image in document order wins (a logo before the cover would be chosen).

**NOTE | `isSupportedImageMediaType` broadening intentional** — `shared/Epub.cpp:372-374`: `image/*` accepted. SVG covers work (WebView renders SVG); avif/heic may render as broken images on older WebView/API levels (documented). `image/*` false positives (icon/font-ish types) only add harmless moved files.

**NOTE | compile-correctness OK** — forward declaration `getLocalName` at `Epub.cpp:246` precedes `childByLocalName`; includes `<string>`, `<unordered_map>`, `<unordered_set>`, `<regex>`, `<sstream>`, `<vector>` all present (lines 1-9); `getLocalName(child.name()) == name` (`Epub.cpp:251`) is a valid `std::string == const char*` comparison; XPath enabled (`pugiconfig.hpp:24` commented out) and `char_t=char` (line 18 commented). Two unused variables (`nav_type` Epub.cpp:313, `version` Epub.cpp:443) → warnings only. No `if (nav)` construct exists in current code (loop var `nav` is used via `nav.node()`).

**NOTE | No infinite loops** — NCX recursion (`parse_navpoint_recursive` Epub.cpp:321-346) and nav recursion (`parse_navele_recursive` 275-298) descend a finite DOM; `children()` on empty nodes iterates zero times. All empty-node reads verified safe in pugixml (`value()` pugixml.cpp:5697-5703, `as_string()` 5618-5622, `xml_text::as_string()` 7452-7456, `attribute()` on empty node 6067-6070).

---

### import.ts

**LOW/MED | Chapter/CSS lookup base is the referencing file's dir, keys are OPF-dir paths** — keys = `normalizePath(decodePath(rawPath))` from native absolute paths (`import.ts:40`, native paths built as `join(opf_dir, href)`); chapter lookups = `normalizePath(`${chapterDirectory}/${decodePath(ref)}`)` (`import.ts:158-176`); CSS lookups similarly (`import.ts:65-78`). These coincide for all spec-compliant EPUBs (references are relative to the content document and `normalizePath` collapses `..`), including multi-dir layouts (opf in root, content in `OEBPS/`). They diverge only for **rooted refs** (`/Images/x.jpg` → `chapterDirectory` + `/Images/x.jpg` ≠ key → un-rewritten) or broken zips where the same file is reachable at two different paths. Rooted refs then render as relative URLs after flattening → broken images.

**LOW | Chapter insert `path` column ≠ physical layout (rowid vs fakeId)** — DB `path` = `local/{novelId}/{fakeId}` (`import.ts:146`, fakeId = spine index 0..n), files written to `local/{novelId}/{lastInsertRowId}` (`import.ts:180-183`). Content loading is unaffected: `useChapter.ts:112`, `useTTSController.ts:2912`, `WebViewReader.tsx:1086`, `ExportNovelAsEpubButton.tsx:157` all read `${NOVEL_STORAGE}/{pluginId}/{novelId}/{chapter.id}/index.html`, and `chapter.id == lastInsertRowId`. The stale `path` column only surfaces in the "Open in WebView" error fallback (`ReaderScreen.tsx:123`), which points at a nonexistent dir.

**LOW | Missing chapter file aborts the whole import** — `NativeFile.readFile` **throws** on missing files (`NativeFile.kt:42-46`), so the `if (!chapterText) return [];` guard (`import.ts:155-156`) only catches empty files, not missing ones. One missing chapter referenced by the spine aborts `importEpub` entirely (progress stuck, error toast), instead of skipping that chapter.

**LOW | Chapter `<a href>` to other chapters never rewritten** — `assetNames` contains only images/css/cover (`import.ts:225-229`); chapter-to-chapter `href` refs are left relative (chapter HTML is written flat into `novelDir/{rowid}/`), so in-content navigation links break. Reader-level chapter navigation is unaffected (managed via DB). Fragment/query suffixes on rewritten image refs are also dropped (`import.ts:176` vs the CSS path which preserves the suffix at `import.ts:81`).

**LOW | `decodeURI` (not `decodeURIComponent`) + raw zip entry names** — `decodePath` (`import.ts:15-21`) leaves `%2F`, `%23`, `%3F`, `%26` encoded; `NativeZipArchive.kt:24` writes zip entries with **raw** names. Keys and lookups decode identically, so rewrites stay internally consistent; the risk is disk lookups (`exists`/`moveFile`, `import.ts:112,282,293`) when an EPUB stores literal `%XX` filenames in the zip while hrefs are also encoded — Calibre-style archives (real names on disk + encoded hrefs) work correctly via `decodePath`.

**NOTE | Cover flow verified (item d)** — `insertLocalNovel(..., coverName)` where `coverName = assetNames.get(normalizePath(decodePath(novel.cover)))` (`import.ts:240-242`); the native side returns `findCoverImagePath` **only if** the image path is in `imagePaths` (`Epub.cpp:432`), so the cover is always a member of the map input. `newCoverPath = file://novelDir/coverName` (`import.ts:107-108`) is consumed correctly by `moveFile` (`NativeFile.kt` `getFileUri` accepts an existing `file://` scheme). The later images loop re-encounters the (already moved) cover → `exists` false → skipped harmlessly (`import.ts:279-289`).

**NOTE | moveFile key correctness (item e) — no asymmetry** — keys are built from the **very same arrays** (`novel.imagePaths`/`cssPaths`/`cover`) that the move loops iterate (`import.ts:225-229` vs `279-289, 293-309`), and `normalizePath(decodedPath)` reproduces the key exactly. The `|| basename(filePath)` fallback (`import.ts:287,308`) only fires on a genuine key miss (rooted-ref/malformed cases) and can collide for two unrewritten files with the same basename.

**NOTE | CSS write-then-move correct (item f)** — rewritten CSS is written back to the extracted path before `moveFile` (`import.ts:303-309`), so the moved file carries the rewritten `url()`s.

**NOTE | chapter mkdir (item g)** — `novelDir + '/' + insertedChapter.lastInsertRowId` (`import.ts:180`) is consistent with the rowid-based read path (see above); `mkdir` uses `File.mkdirs()` (`NativeFile.kt:88-92`) so nested dirs are created.

**NOTE | protocol/fragment handling (item b) verified** — marker split on first `[?#]` happens before the scheme check but the scheme is at the string start, so `data:`, `http(s):`, `file:` and fragment-only (`#sprite`) and query-only refs are all preserved verbatim; `%`-encoded refs are decoded before key lookup on both sides.

---

### sanitizeChapterText.ts

**PASS | `reportUrl` interpolation verified** — `sanitizeChapterText.ts:29-35` passes `{ pluginId, novelName, chapterName, reportUrl }`. Key `readerScreen.emptyChapterMessage` exists in `en/strings.json:590` and in **all 31 other locales** (grep across `strings/languages/*`), each containing `%{reportUrl}` plus `%{pluginId}`, `%{novelName}`, `%{chapterName}`. `getString` → `i18n.t` (i18n-js) supports `%{name}` interpolation (`strings/translations.ts`); the key is typed in `strings/types/index.ts:501`. `reportUrl` is `https` and thus passes `allowedSchemes: ['data','http','https','file']` (line 20).

---

## Explicit answers

**(A) Can a namespace-prefixed EPUB now parse that previously failed, without breaking unprefixed ones?**
Yes. `getLocalName` (`Epub.cpp:365-370`) strips any prefix up to the first `:`; `dc:title` → `title`, and unprefixed `title` passes through unchanged. Any prefix (`dc`, `dcterms`, `opf:`, arbitrary) now matches the metadata/package/manifest/spine lookups. No regression for unprefixed EPUBs. Residual risk is first-match ambiguity (LOW, above), which in practice does not occur in well-formed OPF metadata.

**(B) Can image/CSS references break?**
- **percent-encoded paths:** internally consistent — both keys and all lookups apply `decodePath` (`import.ts:40,66,77,159,172,241,280,293`). Breaks only at the native cover membership check (LOW) and when the zip physically stores `%XX` names (LOW).
- **duplicate basenames:** handled — `createAssetNameMap` suffixes `-2`, `-3` (`import.ts:47-52`) and rewrites reference the suffixed name; unique per map. Fallback `basename` (key-miss only) can still collide (LOW).
- **data: URLs:** preserved verbatim by the scheme check in both rewriters (`import.ts:73-75, 167-171`).
- **fragment-only refs:** preserved — empty `localReference`/`referenceWithoutFragment` returns `full` unchanged (`import.ts:73, 166-170`); CSS rewriter additionally preserves `?`/`#` suffixes on rewritten refs (`import.ts:72,81`), chapter rewriter drops them (`import.ts:176`).
- **Extra risk:** rooted `/...` refs never match map keys → left relative → broken after flattening (LOW/MED).

**(C) Does assetNames key/lookup asymmetry exist?**
No format asymmetry: every key and every lookup uses the identical `normalizePath(decodePath(x))` idiom. The only structural asymmetry is the **reference base** — keys derive from OPF-dir-relative manifest hrefs; chapter/CSS lookups resolve refs relative to the referencing file's directory. `normalizePath`'s `..` resolution makes these coincide for all well-formed EPUBs (including multi-directory layouts); they diverge only for rooted or malformed references (LOW/MED).

---

## Residual risks (not verified)

1. No unit tests exist for `import.ts` or `Epub.cpp` (grep found none) — the 4 fix commits ship untested at unit level; native C++ has no test harness at all.
2. `git diff f0e3b4767..HEAD` and the full test suite could not be run (no shell tool); findings are grounded in current-file state plus caller verification.
3. `decodeURI` leaves `%2F`/`%23`/`%3F`/`%26` encoded; filenames containing these characters remain a gap.
4. Lookbehind regex `/=(?<= href=| src=)(["'])([^]*?)\1/g` (`import.ts:162`) requires a literal space before `href=`/`src=`; newline-separated or whitespace-less attributes are not rewritten (low probability in practice; Hermes ≥0.12 supports lookbehind, so no runtime SyntaxError on RN 0.82).

---

## Acceptance report
