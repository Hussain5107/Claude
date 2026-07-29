import pytest

from localsearch import bm25, store
from localsearch.answer import Answer, generate
from localsearch.config import Config
from localsearch.retrieve import Hit, build_context, snippet


@pytest.fixture
def conn(tmp_path):
    connection = store.connect(tmp_path / "index.db")
    docs = {
        "a.md": "bitumen membrane installation over concrete deck",
        "b.md": "warranty terms and conditions for the client",
        "c.md": "bitumen bitumen bitumen supplier pricing",
    }
    for i, (path, text) in enumerate(docs.items()):
        store.upsert_file(connection, path, float(i), len(text), [(0, text, 0, len(text))], 0.0)
    connection.commit()
    yield connection
    connection.close()


def test_tokenizer_drops_stopwords_and_lowercases():
    assert store.tokenize("The Membrane and THE Deck") == ["membrane", "deck"]


def test_bm25_ranks_term_density(conn):
    ranked = bm25.search(conn, "bitumen")
    assert len(ranked) == 2
    top_id = ranked[0][0]
    rows = store.fetch_chunks(conn, [top_id])
    assert rows[top_id].path == "c.md"


def test_bm25_returns_nothing_for_stopword_only_query(conn):
    assert bm25.search(conn, "the and of") == []


def test_bm25_returns_nothing_for_absent_term(conn):
    assert bm25.search(conn, "helicopter") == []


def test_snippet_centres_on_the_query_term():
    text = "prefix " * 40 + "the softening point is 115 C " + "suffix " * 40
    assert "softening" in snippet(text, "softening point")


def test_snippet_falls_back_to_the_head_of_the_text():
    assert snippet("nothing relevant here", "helicopter").startswith("nothing")


def test_build_context_numbers_and_truncates():
    hits = [Hit(i, f"f{i}.md", 0, "x" * 5000, 1.0) for i in range(5)]
    context = build_context(hits, max_chars=6000)
    assert context.startswith("[1] f0.md")
    assert len(context) < 7000


def test_generate_without_hits_explains_itself():
    answer = generate("anything", [], Config(backend="none"))
    assert isinstance(answer, Answer)
    assert "Nothing in the indexed folder" in answer.text


def test_none_backend_returns_excerpts_with_citations():
    hits = [Hit(1, "notes.md", 0, "the warranty is ten years", 1.0)]
    answer = generate("warranty?", hits, Config(backend="none"))
    assert "[1] notes.md#0" in answer.text
    assert answer.sources() == ["notes.md"]
