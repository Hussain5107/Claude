import json

import pytest

from localsearch.config import Config, db_path
from localsearch.engine import Engine, IndexMissing
from localsearch.loaders import UnsupportedFile, load_text


@pytest.fixture
def folder(tmp_path):
    (tmp_path / "notes").mkdir()
    (tmp_path / "notes" / "roofing.md").write_text(
        "# Roofing notes\n\n"
        "The SBS membrane was applied at 4 mm thickness over the podium deck.\n"
        "Softening point measured 115 degrees Celsius.\n",
        encoding="utf-8",
    )
    (tmp_path / "invoices.csv").write_text(
        "vendor,amount,date\nAcme Bitumen,4500,2026-01-14\nDelta Filler,900,2026-02-02\n",
        encoding="utf-8",
    )
    (tmp_path / "meeting.txt").write_text(
        "Meeting with the client about warranty terms. Ten year warranty agreed.\n",
        encoding="utf-8",
    )
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "junk.md").write_text("should be ignored", encoding="utf-8")
    return tmp_path


def index(folder, **overrides):
    config = Config(**overrides)
    engine = Engine(folder, config)
    result = engine.index()
    return engine, result


def test_indexing_covers_supported_files_and_skips_excluded_dirs(folder):
    engine, result = index(folder)
    with engine:
        assert result.added == 3
        assert result.chunks >= 3
        paths = {row["path"] for row in engine.conn.execute("SELECT path FROM files")}
        assert paths == {"notes/roofing.md", "invoices.csv", "meeting.txt"}


def test_search_finds_the_right_file(folder):
    engine, _ = index(folder)
    with engine:
        hits = engine.search("softening point of the membrane")
        assert hits
        assert hits[0].path == "notes/roofing.md"

        hits = engine.search("warranty")
        assert hits[0].path == "meeting.txt"


def test_csv_rows_are_searchable_by_column_value(folder):
    engine, _ = index(folder)
    with engine:
        hits = engine.search("Delta Filler")
        assert hits and hits[0].path == "invoices.csv"


def test_reindex_is_incremental(folder):
    engine, _ = index(folder)
    engine.close()
    engine2 = Engine(folder, Config())
    result = engine2.index()
    engine2.close()
    assert result.unchanged == 3
    assert result.added == 0


def test_edited_file_is_updated_and_deleted_file_is_removed(folder):
    engine, _ = index(folder)
    engine.close()

    (folder / "meeting.txt").write_text(
        "Meeting rescheduled. Warranty extended to fifteen years.\n", encoding="utf-8"
    )
    (folder / "invoices.csv").unlink()

    engine = Engine(folder, Config())
    result = engine.index()
    with engine:
        assert result.updated == 1
        assert result.removed == 1
        hits = engine.search("fifteen years warranty")
        assert hits[0].path == "meeting.txt"
        assert not engine.search("Delta Filler")


def test_rebuild_starts_from_scratch(folder):
    engine, _ = index(folder)
    engine.close()
    engine = Engine(folder, Config())
    result = engine.index(rebuild=True)
    engine.close()
    assert result.added == 3
    assert result.unchanged == 0


def test_unindexed_folder_raises(tmp_path):
    with pytest.raises(IndexMissing):
        Engine(tmp_path).search("anything")


def test_index_lives_inside_the_folder(folder):
    engine, _ = index(folder)
    engine.close()
    assert db_path(folder).exists()
    assert db_path(folder).parent.name == ".localsearch"


def test_binary_file_is_skipped_not_fatal(folder):
    (folder / "blob.txt").write_bytes(b"\x00\x01\x02binary")
    engine, result = index(folder)
    with engine:
        assert any(path == "blob.txt" for path, _ in result.skipped)
        assert result.added == 3


def test_exclude_globs_are_honoured(folder):
    engine, result = index(folder, exclude_globs=["notes/*"])
    with engine:
        paths = {row["path"] for row in engine.conn.execute("SELECT path FROM files")}
        assert "notes/roofing.md" not in paths


def test_stats_reports_content(folder):
    engine, _ = index(folder)
    with engine:
        stats = engine.stats()
        assert stats["files"] == 3
        assert stats["chunks"] >= 3
        assert stats["terms"] > 10
        assert stats["vectors"] == 0


def test_loader_rejects_pdf_without_library(tmp_path):
    pytest.importorskip  # noqa: B018 - keep import cost low
    fake = tmp_path / "x.pdf"
    fake.write_bytes(b"%PDF-1.4 not really a pdf")
    with pytest.raises(UnsupportedFile):
        load_text(fake)


def test_json_is_pretty_printed_for_indexing(tmp_path):
    path = tmp_path / "data.json"
    path.write_text(json.dumps({"client": "Acme", "status": "signed"}), encoding="utf-8")
    text = load_text(path)
    assert "client" in text and "Acme" in text
