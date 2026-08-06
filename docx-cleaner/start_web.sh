#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "========================================"
echo "  Word 文档一键整理 - 网页测试版"
echo "========================================"

python3 -m pip install -q -r requirements.txt
echo ""
echo "启动网页服务: http://127.0.0.1:8765"
echo "按 Ctrl+C 停止"
echo ""

python3 web_app.py
