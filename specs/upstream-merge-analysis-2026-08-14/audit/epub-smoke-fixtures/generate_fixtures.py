#!/usr/bin/env python3
"""Generate EPUB smoke-test fixtures for the LNReader fork's EPUB import path.

Each fixture targets one risk area from the 2026-08-15 audit:
  1. namespace-prefixed   - prefixed OPF elements + prefixed XHTML nav/chapters
  2. css-relative-images  - <img> + CSS url() background references to images
  3. percent-encoded      - zip entries with spaces, hrefs percent-encoded
  4. duplicate-basenames  - same image/CSS basename in different directories
"""
import base64
import os
import zipfile

OUT = os.path.dirname(os.path.abspath(__file__))

# 1x1 transparent PNG
PNG_1PX = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk"
    "+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)

CONTAINER = """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
"""


def write_epub(name, entries):
    """entries: list of (path, bytes|str, compress: bool) — mimetype must come first, stored."""
    path = os.path.join(OUT, name)
    with zipfile.ZipFile(path, "w") as zf:
        # EPUB spec: mimetype first, uncompressed
        zf.writestr("mimetype", "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        for entry_path, data, compress in entries:
            if isinstance(data, str):
                data = data.encode("utf-8")
            zf.writestr(
                entry_path,
                data,
                compress_type=zipfile.ZIP_DEFLATED if compress else zipfile.ZIP_STORED,
            )
    print(f"wrote {path} ({os.path.getsize(path)} bytes)")


# ---------------------------------------------------------------------------
# 1. Namespace-prefixed EPUB: every OPF element carries the opf: prefix;
#    XHTML uses a custom prefix bound to the XHTML namespace.
# ---------------------------------------------------------------------------
opf_prefixed = """<?xml version="1.0" encoding="UTF-8"?>
<opf:package xmlns:opf="http://www.idpf.org/2007/opf" version="3.0"
             xmlns:dc="http://purl.org/dc/elements/1.1/">
  <opf:metadata>
    <dc:title>Prefixed Book</dc:title>
    <dc:creator>Fork Test</dc:creator>
    <dc:contributor>Editor</dc:contributor>
    <dc:description>A fixture with prefixed OPF elements.</dc:description>
    <opf:meta name="cover" content="cover-image"/>
  </opf:metadata>
  <opf:manifest>
    <opf:item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <opf:item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <opf:item id="c2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
    <opf:item id="cover-image" href="images/cover.png" media-type="image/png" properties="cover-image"/>
    <opf:item id="css" href="styles/style.css" media-type="text/css"/>
  </opf:manifest>
  <opf:spine>
    <opf:itemref idref="c1"/>
    <opf:itemref idref="c2"/>
  </opf:spine>
</opf:package>
"""
nav_prefixed = """<?xml version="1.0" encoding="UTF-8"?>
<x:html xmlns:x="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <x:head><x:title>Contents</x:title></x:head>
  <x:body>
    <x:nav epub:type="toc">
      <x:ol>
        <x:li><x:a href="chapter1.xhtml">One</x:a></x:li>
        <x:li><x:a href="chapter2.xhtml">Two</x:a></x:li>
      </x:ol>
    </x:nav>
  </x:body>
</x:html>
"""
chapter_prefixed = """<?xml version="1.0" encoding="UTF-8"?>
<x:html xmlns:x="http://www.w3.org/1999/xhtml">
  <x:head>
    <x:title>Chapter {n}</x:title>
    <x:link rel="stylesheet" type="text/css" href="styles/style.css"/>
  </x:head>
  <x:body>
    <x:h1>Chapter {n}</x:h1>
    <x:p>Body text of chapter {n}.</x:p>
    <x:img src="images/cover.png" alt="cover"/>
  </x:body>
</x:html>
"""

write_epub(
    "namespace-prefixed.epub",
    [
        ("META-INF/container.xml", CONTAINER, False),
        ("OEBPS/content.opf", opf_prefixed, True),
        ("OEBPS/nav.xhtml", nav_prefixed, True),
        ("OEBPS/chapter1.xhtml", chapter_prefixed.format(n=1), True),
        ("OEBPS/chapter2.xhtml", chapter_prefixed.format(n=2), True),
        ("OEBPS/styles/style.css", "body { color: #333; }", True),
        ("OEBPS/images/cover.png", PNG_1PX, True),
    ],
)

# ---------------------------------------------------------------------------
# 2. CSS-relative images: chapter <img> + CSS url() background, plus a data:
#    URI that must be left untouched.
# ---------------------------------------------------------------------------
css_rel = """body { color: #333; }
.banner { background: url('../images/banner.png'); }
.logo   { background: url(data:image/png;base64,AAAA); }
"""
write_epub(
    "css-relative-images.epub",
    [
        ("META-INF/container.xml", CONTAINER, False),
        (
            "OEBPS/content.opf",
            """<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">css-relative</dc:identifier>
    <dc:title>CSS Relative Images</dc:title>
    <dc:creator>Fork Test</dc:creator>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="banner" href="images/banner.png" media-type="image/png"/>
    <item id="photo" href="images/photo.jpg" media-type="image/jpeg"/>
    <item id="css" href="styles/style.css" media-type="text/css"/>
  </manifest>
  <spine>
    <itemref idref="c1"/>
  </spine>
</package>
""",
            True,
        ),
        (
            "OEBPS/nav.xhtml",
            """<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head><title>Contents</title></head>
  <body><nav epub:type="toc"><ol><li><a href="chapter1.xhtml">One</a></li></ol></nav></body>
</html>
""",
            True,
        ),
        (
            "OEBPS/chapter1.xhtml",
            """<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>Chapter 1</title>
    <link rel="stylesheet" type="text/css" href="styles/style.css"/>
  </head>
  <body>
    <h1>Chapter 1</h1>
    <p>Inline image below (must render):</p>
    <img src="images/photo.jpg" alt="photo"/>
    <p class="banner">CSS background banner (must render):</p>
    <p class="logo">CSS data: URI logo (must NOT be rewritten):</p>
  </body>
</html>
""",
            True,
        ),
        ("OEBPS/styles/style.css", css_rel, True),
        ("OEBPS/images/banner.png", PNG_1PX, True),
        ("OEBPS/images/photo.jpg", PNG_1PX, True),
    ],
)

# ---------------------------------------------------------------------------
# 3. Percent-encoded paths: zip entries contain spaces; hrefs are encoded.
# ---------------------------------------------------------------------------
write_epub(
    "percent-encoded.epub",
    [
        ("META-INF/container.xml", CONTAINER, False),
        (
            "OEBPS/content.opf",
            """<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">percent-encoded</dc:identifier>
    <dc:title>Percent Encoded</dc:title>
    <dc:creator>Fork Test</dc:creator>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="c1" href="Chapter%201.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="Chapter%202.xhtml" media-type="application/xhtml+xml"/>
    <item id="img" href="images/My%20Image.png" media-type="image/png"/>
  </manifest>
  <spine>
    <itemref idref="c1"/>
    <itemref idref="c2"/>
  </spine>
</package>
""",
            True,
        ),
        (
            "OEBPS/nav.xhtml",
            """<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head><title>Contents</title></head>
  <body><nav epub:type="toc">
    <ol>
      <li><a href="Chapter%201.xhtml">One</a></li>
      <li><a href="Chapter%202.xhtml">Two</a></li>
    </ol>
  </nav></body>
</html>
""",
            True,
        ),
        (
            "OEBPS/Chapter 1.xhtml",
            """<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head><title>Chapter 1</title></head>
  <body><h1>Chapter 1</h1><p>File name has a space.</p>
    <img src="images/My%20Image.png" alt="spaced image"/>
  </body>
</html>
""",
            True,
        ),
        (
            "OEBPS/Chapter 2.xhtml",
            """<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head><title>Chapter 2</title></head>
  <body><h1>Chapter 2</h1><p>Second chapter.</p></body>
</html>
""",
            True,
        ),
        ("OEBPS/images/My Image.png", PNG_1PX, True),
    ],
)

# ---------------------------------------------------------------------------
# 4. Duplicate basenames: same cover.png / style.css in two directories.
# ---------------------------------------------------------------------------
write_epub(
    "duplicate-basenames.epub",
    [
        ("META-INF/container.xml", CONTAINER, False),
        (
            "OEBPS/content.opf",
            """<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">duplicate-basenames</dc:identifier>
    <dc:title>Duplicate Basenames</dc:title>
    <dc:creator>Fork Test</dc:creator>
    <meta name="cover" content="cover-a"/>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="c1" href="chapters/a/chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="chapters/b/chapter2.xhtml" media-type="application/xhtml+xml"/>
    <item id="cover-a" href="images/a/cover.png" media-type="image/png" properties="cover-image"/>
    <item id="cover-b" href="images/b/cover.png" media-type="image/png"/>
    <item id="css-a" href="styles/a/style.css" media-type="text/css"/>
    <item id="css-b" href="styles/b/style.css" media-type="text/css"/>
  </manifest>
  <spine>
    <itemref idref="c1"/>
    <itemref idref="c2"/>
  </spine>
</package>
""",
            True,
        ),
        (
            "OEBPS/nav.xhtml",
            """<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head><title>Contents</title></head>
  <body><nav epub:type="toc">
    <ol>
      <li><a href="chapters/a/chapter1.xhtml">One</a></li>
      <li><a href="chapters/b/chapter2.xhtml">Two</a></li>
    </ol>
  </nav></body>
</html>
""",
            True,
        ),
        (
            "OEBPS/chapters/a/chapter1.xhtml",
            """<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head><title>Chapter 1</title>
    <link rel="stylesheet" type="text/css" href="../../styles/a/style.css"/>
  </head>
  <body><h1>Chapter 1</h1>
    <img src="../../images/a/cover.png" alt="A cover"/>
  </body>
</html>
""",
            True,
        ),
        (
            "OEBPS/chapters/b/chapter2.xhtml",
            """<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head><title>Chapter 2</title>
    <link rel="stylesheet" type="text/css" href="../../styles/b/style.css"/>
  </head>
  <body><h1>Chapter 2</h1>
    <img src="../../images/b/cover.png" alt="B cover"/>
  </body>
</html>
""",
            True,
        ),
        ("OEBPS/styles/a/style.css", "body { color: red; }", True),
        ("OEBPS/styles/b/style.css", "body { color: blue; }", True),
        ("OEBPS/images/a/cover.png", PNG_1PX, True),
        ("OEBPS/images/b/cover.png", PNG_1PX, True),
    ],
)
