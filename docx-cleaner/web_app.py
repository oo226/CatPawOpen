"""Web test version with drag-and-drop and PDF comparison."""

from __future__ import annotations

import atexit
import shutil
import tempfile
import uuid
from dataclasses import asdict
from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_file
from werkzeug.utils import secure_filename

from cleaner import clean_docx_bytes
from pdf_checker import compare_with_pdf

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50 MB

TEMP_ROOT = Path(tempfile.mkdtemp(prefix="docx-cleaner-"))
DOWNLOADS: dict[str, Path] = {}


def _cleanup() -> None:
    shutil.rmtree(TEMP_ROOT, ignore_errors=True)


atexit.register(_cleanup)


@app.get("/")
def index():
    return render_template("index.html")


@app.post("/api/clean")
def api_clean():
    docx_file = request.files.get("docx")
    if not docx_file or not docx_file.filename:
        return jsonify({"ok": False, "error": "请上传 .docx 文件"}), 400

    filename = secure_filename(docx_file.filename) or "document.docx"
    if not filename.lower().endswith(".docx"):
        return jsonify({"ok": False, "error": "只支持 .docx 格式"}), 400

    keep_page_numbers = request.form.get("keep_page_numbers", "false").lower() == "true"

    try:
        docx_bytes = docx_file.read()
        cleaned_bytes, stats = clean_docx_bytes(
            docx_bytes, keep_page_numbers=keep_page_numbers
        )
    except Exception as exc:
        return jsonify({"ok": False, "error": f"整理失败：{exc}"}), 400

    pdf_check = None
    pdf_file = request.files.get("pdf")
    if pdf_file and pdf_file.filename:
        pdf_name = secure_filename(pdf_file.filename) or ""
        if pdf_name.lower().endswith(".pdf"):
            try:
                pdf_check = compare_with_pdf(pdf_file.read(), cleaned_bytes).to_dict()
            except Exception as exc:
                pdf_check = {
                    "status": "error",
                    "message": f"PDF 对照失败：{exc}",
                    "coverage_percent": 0,
                    "missing_segments": [],
                }

    file_id = str(uuid.uuid4())
    stem = Path(filename).stem
    out_name = f"{stem}_已整理.docx"
    out_path = TEMP_ROOT / f"{file_id}.docx"
    out_path.write_bytes(cleaned_bytes)
    DOWNLOADS[file_id] = out_path

    return jsonify(
        {
            "ok": True,
            "file_id": file_id,
            "filename": out_name,
            "stats": asdict(stats),
            "pdf_check": pdf_check,
        }
    )


@app.get("/api/download/<file_id>")
def api_download(file_id: str):
    path = DOWNLOADS.get(file_id)
    if not path or not path.exists():
        return jsonify({"ok": False, "error": "文件不存在或已过期，请重新整理"}), 404

    download_name = request.args.get("name", "已整理.docx")
    return send_file(
        path,
        as_attachment=True,
        download_name=download_name,
        mimetype=(
            "application/vnd.openxmlformats-officedocument"
            ".wordprocessingml.document"
        ),
    )


def main() -> None:
    import os

    host = os.environ.get("DOCX_CLEANER_HOST", "127.0.0.1")
    port = int(os.environ.get("DOCX_CLEANER_PORT", "8765"))
    debug = os.environ.get("DOCX_CLEANER_DEBUG", "0") == "1"

    print("=" * 48)
    print("  Word 文档一键整理 - 网页测试版")
    print(f"  打开浏览器访问: http://{host}:{port}")
    print("  按 Ctrl+C 停止服务")
    print("=" * 48)

    app.run(host=host, port=port, debug=debug)


if __name__ == "__main__":
    main()
