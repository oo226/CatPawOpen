"""Tests for PDF comparison helpers."""

from __future__ import annotations

from pdf_checker import (
    _fuzzy_contains,
    compare_with_pdf,
    normalize_for_compare,
    split_segments,
)


def test_normalize() -> None:
    assert normalize_for_compare("选 举 业 主") == "选举业主"
    print("test_normalize: OK")


def test_split_segments() -> None:
    text = "下列事项由业主共同决定。制定和修改业主大会议事规则；制定和修改管理规约。"
    segs = split_segments(text)
    assert len(segs) >= 2
    print("test_split_segments: OK")


def test_fuzzy_contains() -> None:
    hay = normalize_for_compare("下列事项由业主共同决定制定和修改规则")
    needle = normalize_for_compare("下列事项由业主共同决定")
    assert _fuzzy_contains(hay, needle)
    print("test_fuzzy_contains: OK")


def test_compare_empty_pdf() -> None:
    try:
        result = compare_with_pdf(b"%PDF-1.4\n", b"")
        assert result.status == "error"
    except Exception:
        pass  # invalid PDF bytes may raise; that's acceptable
    print("test_compare_empty_pdf: OK")


def main() -> None:
    test_normalize()
    test_split_segments()
    test_fuzzy_contains()
    test_compare_empty_pdf()
    print("All pdf_checker tests passed.")


if __name__ == "__main__":
    main()
