# EPUB Device Smoke Test — Upstream Sync 2026-08-14 Fix Pass

**Status**: ⏳ PENDING — requires a physical device or emulator (native EPUB parsing cannot be exercised by Jest).

**Branch**: `merge/upstream-sync-2026-08-14`
**Fixtures**: `specs/upstream-merge-analysis-2026-08-14/audit/epub-smoke-fixtures/` (regenerate with `generate_fixtures.py`)

## Why this exists

The audit of the fix commits (`f0e3b4767..HEAD`) verified the EPUB changes statically
(namespace-tolerant `Epub.cpp`, collision-safe asset mapping, CSS `url()` rewriting,
percent-decoding) and via a `g++ -fsyntax-only` compile check, but **no automated harness
exercises the native parser or the import pipeline**. These four fixtures target exactly the
risk areas the reviewers flagged as needing device-level validation.

## Prerequisites

- Debug APK built from this branch: `pnpm run build:release:android` (or a debug build)
- Device/emulator with the APK installed
- `adb` available (or a way to push files to the device)
- Each fixture must be reachable from the device (e.g. `adb push <fixture> /sdcard/Download/`)

## How to import

1. Open **Library** → ⋮ (extra menu) → **Import EPUB**.
2. Pick the fixture file from Downloads (or the file picker location).
3. Wait for the import progress overlay to complete; note any error toast.

## Per-fixture checklist

### 1. `namespace-prefixed.epub`

| Check | Expected | Pass? |
|---|---|---|
| Import completes without error | Yes | |
| Novel appears in library | Name **"Prefixed Book"** | |
| Author shown | "Fork Test" | |
| Summary populated | "A fixture with prefixed OPF elements." | |
| Chapter list | 2 chapters named **"One"**, **"Two"** (from TOC, not filename fallback) | |
| Chapter 1 renders image | cover renders | |
| Cover art on novel card | shows cover | |

**Validates**: `childByLocalName`/`getLocalName` namespace tolerance across container,
OPF metadata/manifest/spine, and prefixed XHTML nav.

### 2. `css-relative-images.epub`

| Check | Expected | Pass? |
|---|---|---|
| Import completes without error | Yes | |
| Chapter 1 shows inline `<img src="images/photo.jpg">` | photo renders | |
| CSS background banner (`../images/banner.png` via `styles/style.css`) | banner renders | |
| CSS `data:image/png;base64` logo | renders **and is not rewritten/corrupted** | |

**Validates**: `rewriteAssetReferences` (relative `url()` rewrite to flattened
`file://…/novelDir/<name>`), query/fragment preservation, `data:` URI skipping.

### 3. `percent-encoded.epub`

| Check | Expected | Pass? |
|---|---|---|
| Import completes without error | Yes | |
| Chapter list | 2 chapters ("One", "Two") | |
| Both chapters open and render text | Yes | |
| Chapter 1 `<img src="images/My%20Image.png">` | image renders | |

**Validates**: `decodePath` (`%20` → space) on OPF manifest hrefs, nav hrefs, and in-content
`src` attributes; zip entries with literal spaces.

### 4. `duplicate-basenames.epub`

| Check | Expected | Pass? |
|---|---|---|
| Import completes without error | Yes | |
| Cover art on novel card | shows `images/a/cover.png` (cover-image) | |
| Chapter 1 renders image `images/a/cover.png` | renders | |
| Chapter 2 renders image `images/b/cover.png` | renders (**not** a duplicate of A's file) | |
| Chapter 1 CSS (`styles/a/style.css`) vs Chapter 2 CSS (`styles/b/style.css`) | distinct colors (red vs blue) — each chapter styled correctly | |

**Validates**: `createAssetNameMap` collision suffixing (`cover.png` / `cover-2.png`,
`style.css` / `style-2.css`) and that each chapter's rewrite maps to its **own** asset.

## Not covered by these fixtures

- NCX (`toc.ncx`) navigation documents and the `toc_href.find("ncx")` filename heuristic
  (tracked deferred item).
- `<nav epub:type="landmarks">` label overwrite (tracked deferred item).
- avif/heic images (`image/*` broadening is intentional but may not render on old WebView).
- Cover **documents** (cover as an XHTML page) — covered by the wave-3 port but not here.

## Sign-off

| Fixture | Result (date) | Tester |
|---|---|---|
| namespace-prefixed | | |
| css-relative-images | | |
| percent-encoded | | |
| duplicate-basenames | | |
