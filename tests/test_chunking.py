from localsearch.chunking import chunk_text, normalize


def test_normalize_collapses_whitespace_but_keeps_paragraphs():
    assert normalize("a   b\r\n\r\n\r\n\r\nc  ") == "a b\n\nc"


def test_chunks_stay_within_size():
    text = "\n\n".join(f"Paragraph {i}. " + "word " * 60 for i in range(20))
    chunks = chunk_text(text, size=500, overlap=50)
    assert chunks
    assert all(len(c.text) <= 700 for c in chunks)  # size + overlap slack


def test_chunks_overlap_so_context_is_not_cut_mid_thought():
    text = " ".join(f"sentence{i}." for i in range(400))
    chunks = chunk_text(text, size=400, overlap=100)
    assert len(chunks) > 1
    tail = chunks[0].text[-40:]
    assert any(word in chunks[1].text for word in tail.split())


def test_ordinals_are_sequential():
    chunks = chunk_text("word " * 2000, size=300, overlap=30)
    assert [c.ordinal for c in chunks] == list(range(len(chunks)))


def test_empty_input_yields_no_chunks():
    assert chunk_text("   \n\n  ") == []


def test_single_huge_word_is_hard_split():
    chunks = chunk_text("x" * 1000, size=200, overlap=0)
    assert len(chunks) == 5
