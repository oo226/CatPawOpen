#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "用法: ./run_linux.sh <pdf或目录路径>"
  echo "示例: ./run_linux.sh ./samples/1111.pdf"
  exit 1
fi

python3 -m pip install -r requirements.txt
python3 paddle_pdf_to_word.py "$1" -o output-docx --mode auto

echo "完成，输出目录: output-docx"
