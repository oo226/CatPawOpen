#!/usr/bin/env python3
"""Convert PDF/images to editable DOCX via PaddleOCR PP-Structure.

Usage:
  python paddle_pdf_to_word.py "input.pdf" -o output_dir
  python paddle_pdf_to_word.py "input_dir" --glob "*.pdf"
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path



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


def build_paddleocr_cmd(input_path: Path, output_dir: Path, lang: str, scanned: bool) -> list[str]:
    cmd = [
        sys.executable,
        "-m",
        "paddleocr",
        "--image_dir",
        str(input_path),
        "--type",
        "structure",
        "--recovery",
        "true",
        "--lang",
        lang,
        "--output",
        str(output_dir),
    ]

    if not scanned and input_path.suffix.lower() == ".pdf":
        # For standard PDF: faster and usually better style recovery
        cmd.extend(["--use_pdf2docx_api", "true"])

    return cmd


def collect_inputs(input_path: Path, glob_pattern: str) -> list[Path]:
    if input_path.is_file():
        return [input_path]
    if not input_path.is_dir():
        raise FileNotFoundError(f"输入不存在: {input_path}")

    files = sorted(input_path.glob(glob_pattern))
    return [p for p in files if p.is_file()]


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

    job_output = output_dir / file_path.stem
    job_output.mkdir(parents=True, exist_ok=True)

    cmd = build_paddleocr_cmd(file_path, job_output, lang, scanned)
    proc = subprocess.run(cmd, capture_output=True, text=True)

    if proc.returncode != 0:
        return {
            "file": str(file_path),
            "status": "error",
            "mode": "scanned" if scanned else "standard",
            "reason": proc.stderr[-2000:] if proc.stderr else proc.stdout[-2000:],
        }

    docx_candidates = sorted(job_output.rglob("*.docx"))
    if not docx_candidates:
        return {
            "file": str(file_path),
            "status": "error",
            "mode": "scanned" if scanned else "standard",
            "reason": "转换完成但未发现 docx 输出",
        }

    best_docx = max(docx_candidates, key=lambda p: p.stat().st_size)
    final_docx = output_dir / f"{file_path.stem}_ocr.docx"
    shutil.copy2(best_docx, final_docx)

    return {
        "file": str(file_path),
        "status": "ok",
        "mode": "scanned" if scanned else "standard",
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
