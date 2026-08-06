"""Command-line entry point for Word document cleanup."""

from __future__ import annotations

import argparse
from pathlib import Path

from cleaner import clean_docx


def main() -> None:
    parser = argparse.ArgumentParser(
        description="整理扫描/OCR 转 Word 后乱版的 .docx 文档"
    )
    parser.add_argument("inputs", nargs="+", help="输入的 .docx 文件路径")
    parser.add_argument(
        "-o",
        "--output-dir",
        help="输出目录（默认与源文件同目录）",
    )
    parser.add_argument(
        "--keep-page-numbers",
        action="store_true",
        help="保留单独成段的页码",
    )
    args = parser.parse_args()

    output_root = Path(args.output_dir) if args.output_dir else None

    for raw in args.inputs:
        input_path = Path(raw)
        if not input_path.exists():
            print(f"跳过（文件不存在）: {input_path}")
            continue
        if input_path.suffix.lower() != ".docx":
            print(f"跳过（不是 .docx）: {input_path}")
            continue

        if output_root:
            output_path = output_root / f"{input_path.stem}_已整理.docx"
        else:
            output_path = input_path.with_name(f"{input_path.stem}_已整理.docx")

        stats = clean_docx(
            input_path,
            output_path,
            keep_page_numbers=args.keep_page_numbers,
        )
        print(
            f"完成: {input_path.name} -> {output_path}\n"
            f"  提取 {stats.input_blocks} 段，输出 {stats.output_paragraphs} 段"
        )


if __name__ == "__main__":
    main()
