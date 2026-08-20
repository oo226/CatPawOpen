#!/usr/bin/env python3
"""Convert PDF/images to editable DOCX via PaddleOCR or pdf2docx.

Usage:
  python paddle_pdf_to_word.py "input.pdf" -o output_dir
  python paddle_pdf_to_word.py "input_dir" --glob "*.pdf"
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# Avoid oneDNN issues on some CPU environments.
os.environ.setdefault("FLAGS_use_mkldnn", "0")
os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")


def is_image_pdf(pdf_path: Path, min_text_chars_per_page: int = 30) -> bool:
    """Heuristic: if most pages have little extractable text, treat as image PDF."""
    import fitz  # PyMuPDF

    doc = fitz.open(pdf_path)
    try:
        if doc.page_count == 0:
            return True
        low_text_pages = 0
        for page in doc:
            text = page.get_text("text") or ""
            if len(text.strip()) < min_text_chars_per_page:
                low_text_pages += 1
        return (low_text_pages / doc.page_count) >= 0.6
    finally:
        doc.close()


def collect_inputs(input_path: Path, glob_pattern: str) -> list[Path]:
    if input_path.is_file():
        return [input_path]
    if not input_path.is_dir():
        raise FileNotFoundError(f"输入不存在: {input_path}")

    files = sorted(input_path.glob(glob_pattern))
    return [p for p in files if p.is_file()]


def convert_standard_pdf(file_path: Path, output_dir: Path) -> Path:
    from pdf2docx import Converter

    final_docx = output_dir / f"{file_path.stem}_ocr.docx"
    converter = Converter(str(file_path))
    try:
        converter.convert(str(final_docx))
    finally:
        converter.close()
    return final_docx


def _box_top_left(box) -> tuple[float, float]:
    if hasattr(box, "tolist"):
        coords = box.tolist()
    else:
        coords = box

    if coords is None or len(coords) == 0:
        return 0.0, 0.0

    # [x1, y1, x2, y2]
    if len(coords) == 4 and all(isinstance(v, (int, float)) for v in coords):
        return float(coords[1]), float(coords[0])

    xs = [p[0] for p in coords]
    ys = [p[1] for p in coords]
    return float(min(ys)), float(min(xs))


def _sorted_ocr_lines(page_result: dict) -> list[str]:
    texts = page_result.get("rec_texts") or []
    boxes = page_result.get("rec_polys") or page_result.get("rec_boxes") or []
    if not texts:
        return []

    if len(boxes) != len(texts):
        return [t for t in texts if t and str(t).strip()]

    lines: list[tuple[float, float, str]] = []
    for text, box in zip(texts, boxes, strict=False):
        if not text or not str(text).strip():
            continue
        top, left = _box_top_left(box)
        lines.append((top, left, str(text)))

    lines.sort(key=lambda item: (item[0], item[1]))
    return [line[2] for line in lines]


def _build_docx_from_ocr_pages(pages: list[dict], output_path: Path) -> None:
    from docx import Document

    doc = Document()
    for page_idx, page_result in enumerate(pages):
        if page_idx > 0:
            doc.add_page_break()
        for line in _sorted_ocr_lines(page_result):
            doc.add_paragraph(line)
    doc.save(str(output_path))


def convert_scanned(file_path: Path, output_dir: Path, lang: str) -> Path:
    from paddleocr import PaddleOCR

    ocr = PaddleOCR(
        lang=lang,
        enable_mkldnn=False,
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
    )
    pages = list(ocr.predict(str(file_path)))
    if not pages:
        raise RuntimeError("OCR 未返回任何页面结果")

    final_docx = output_dir / f"{file_path.stem}_ocr.docx"
    _build_docx_from_ocr_pages(pages, final_docx)
    return final_docx


def convert_one(file_path: Path, output_dir: Path, lang: str, force_mode: str) -> dict:
    ext = file_path.suffix.lower()
    if ext not in {".pdf", ".png", ".jpg", ".jpeg", ".bmp", ".webp"}:
        return {
            "file": str(file_path),
            "status": "skip",
            "reason": f"不支持格式: {ext}",
        }

    if force_mode == "scanned":
        scanned = True
    elif force_mode == "standard":
        scanned = False
    else:
        scanned = is_image_pdf(file_path) if ext == ".pdf" else True

    try:
        if scanned:
            final_docx = convert_scanned(file_path, output_dir, lang)
            mode = "scanned"
        else:
            final_docx = convert_standard_pdf(file_path, output_dir)
            mode = "standard"
    except Exception as exc:  # noqa: BLE001 - surface conversion errors in report.json
        return {
            "file": str(file_path),
            "status": "error",
            "mode": "scanned" if scanned else "standard",
            "reason": str(exc)[-2000:],
        }

    return {
        "file": str(file_path),
        "status": "ok",
        "mode": mode,
        "docx": str(final_docx),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="PaddleOCR 扫描件/文档 转 Word 原型")
    parser.add_argument("input", help="输入文件或目录")
    parser.add_argument("-o", "--output-dir", default="output-docx", help="输出目录")
    parser.add_argument("--glob", default="*.pdf", help="目录模式下的文件匹配，例如 *.pdf")
    parser.add_argument("--lang", default="ch", help="OCR 语言，默认 ch")
    parser.add_argument(
        "--mode",
        choices=["auto", "scanned", "standard"],
        default="auto",
        help="auto=自动判断，scanned=强制扫描件模式，standard=强制标准PDF模式",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    files = collect_inputs(input_path, args.glob)
    if not files:
        print("没有找到可处理文件")
        return 2

    print(f"待处理: {len(files)} 个文件")
    results = []
    for i, file_path in enumerate(files, 1):
        print(f"[{i}/{len(files)}] 处理: {file_path.name}")
        res = convert_one(file_path, output_dir, args.lang, args.mode)
        results.append(res)
        if res["status"] == "ok":
            print(f"  ✅ 完成 -> {res['docx']} (mode={res['mode']})")
        elif res["status"] == "skip":
            print(f"  ⏭️ 跳过: {res['reason']}")
        else:
            print(f"  ❌ 失败: {res['reason']}")

    report_path = output_dir / "report.json"
    report_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n报告: {report_path}")

    errors = sum(1 for r in results if r["status"] == "error")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
