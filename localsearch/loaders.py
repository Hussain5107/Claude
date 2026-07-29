"""Turn files on disk into plain text.

Plain-text formats need no dependencies. PDF/DOCX/PPTX/XLSX/EPUB work if the
matching optional library is installed; otherwise the file is skipped with a
readable reason instead of crashing the whole index run.
"""

from __future__ import annotations

import csv
import html.parser
import io
import json
import zipfile
from pathlib import Path

from .config import BINARY_EXTENSIONS, TEXT_EXTENSIONS


class UnsupportedFile(Exception):
    """Raised when a file cannot be read (missing library, corrupt, binary)."""


def is_supported(path: Path) -> bool:
    return path.suffix.lower() in (TEXT_EXTENSIONS | BINARY_EXTENSIONS)


def load_text(path: Path) -> str:
    """Extract text from *path*, or raise UnsupportedFile."""
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return _load_pdf(path)
    if suffix == ".docx":
        return _load_docx(path)
    if suffix == ".pptx":
        return _load_pptx(path)
    if suffix == ".xlsx":
        return _load_xlsx(path)
    if suffix == ".epub":
        return _load_epub(path)
    if suffix in {".html", ".htm", ".xml"}:
        return _strip_html(_read_plain(path))
    if suffix in {".csv", ".tsv"}:
        return _load_delimited(path)
    if suffix in {".json", ".jsonl"}:
        return _load_json(path)
    return _read_plain(path)


# --- plain text -------------------------------------------------------------

def _read_plain(path: Path) -> str:
    raw = path.read_bytes()
    if b"\x00" in raw[:8192]:
        raise UnsupportedFile("looks like a binary file")
    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise UnsupportedFile("could not decode text")


def _load_delimited(path: Path) -> str:
    """Render tabular data as `column: value` lines so rows stay searchable."""
    delimiter = "\t" if path.suffix.lower() == ".tsv" else ","
    text = _read_plain(path)
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    try:
        header = next(reader)
    except StopIteration:
        return ""
    lines = [delimiter.join(header)]
    for row in reader:
        pairs = [f"{h}: {v}" for h, v in zip(header, row) if v.strip()]
        if pairs:
            lines.append(" | ".join(pairs))
    return "\n".join(lines)


def _load_json(path: Path) -> str:
    text = _read_plain(path)
    if path.suffix.lower() == ".jsonl":
        return text
    try:
        return json.dumps(json.loads(text), indent=2, ensure_ascii=False)
    except json.JSONDecodeError:
        return text


class _HTMLText(html.parser.HTMLParser):
    SKIP = {"script", "style", "head", "meta", "link"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self._skip_depth += 1

    def handle_endtag(self, tag):
        if tag in self.SKIP and self._skip_depth:
            self._skip_depth -= 1

    def handle_data(self, data):
        if not self._skip_depth and data.strip():
            self.parts.append(data.strip())


def _strip_html(text: str) -> str:
    parser = _HTMLText()
    parser.feed(text)
    return "\n".join(parser.parts)


# --- office / pdf formats ---------------------------------------------------

def _load_pdf(path: Path) -> str:
    try:
        from pypdf import PdfReader  # type: ignore
    except ImportError:
        try:
            from PyPDF2 import PdfReader  # type: ignore
        except ImportError as exc:
            raise UnsupportedFile("install `pypdf` to index PDF files") from exc
    try:
        reader = PdfReader(str(path))
        pages = [(page.extract_text() or "") for page in reader.pages]
    except Exception as exc:  # corrupt or encrypted
        raise UnsupportedFile(f"could not read PDF: {exc}") from exc
    text = "\n\n".join(p.strip() for p in pages if p.strip())
    if not text.strip():
        raise UnsupportedFile("PDF has no extractable text (likely a scan; OCR it first)")
    return text


def _load_docx(path: Path) -> str:
    """Read a .docx without external libraries by parsing its XML."""
    try:
        with zipfile.ZipFile(path) as zf:
            xml = zf.read("word/document.xml").decode("utf-8", "ignore")
    except (zipfile.BadZipFile, KeyError) as exc:
        raise UnsupportedFile(f"could not read DOCX: {exc}") from exc
    # Paragraph and line breaks become newlines, then drop remaining tags.
    xml = xml.replace("</w:p>", "\n").replace("<w:br/>", "\n").replace("<w:tab/>", "\t")
    return _strip_html(xml)


def _load_pptx(path: Path) -> str:
    try:
        with zipfile.ZipFile(path) as zf:
            slides = sorted(
                n for n in zf.namelist()
                if n.startswith("ppt/slides/slide") and n.endswith(".xml")
            )
            chunks = []
            for name in slides:
                xml = zf.read(name).decode("utf-8", "ignore").replace("</a:p>", "\n")
                text = _strip_html(xml).strip()
                if text:
                    chunks.append(f"[{Path(name).stem}]\n{text}")
    except (zipfile.BadZipFile, KeyError) as exc:
        raise UnsupportedFile(f"could not read PPTX: {exc}") from exc
    return "\n\n".join(chunks)


def _load_xlsx(path: Path) -> str:
    try:
        from openpyxl import load_workbook  # type: ignore
    except ImportError as exc:
        raise UnsupportedFile("install `openpyxl` to index XLSX files") from exc
    try:
        wb = load_workbook(str(path), read_only=True, data_only=True)
    except Exception as exc:
        raise UnsupportedFile(f"could not read XLSX: {exc}") from exc
    out: list[str] = []
    for sheet in wb.worksheets:
        out.append(f"[sheet: {sheet.title}]")
        for row in sheet.iter_rows(values_only=True):
            cells = [str(c) for c in row if c is not None and str(c).strip()]
            if cells:
                out.append(" | ".join(cells))
    wb.close()
    return "\n".join(out)


def _load_epub(path: Path) -> str:
    try:
        with zipfile.ZipFile(path) as zf:
            names = [n for n in zf.namelist() if n.lower().endswith((".xhtml", ".html", ".htm"))]
            parts = [_strip_html(zf.read(n).decode("utf-8", "ignore")) for n in sorted(names)]
    except zipfile.BadZipFile as exc:
        raise UnsupportedFile(f"could not read EPUB: {exc}") from exc
    return "\n\n".join(p for p in parts if p.strip())
