"""Word 扫描/OCR 文档一键整理工具 - 图形界面"""

from __future__ import annotations

import os
import sys
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from cleaner import clean_docx


APP_TITLE = "Word 文档一键整理工具"
APP_VERSION = "1.0.0"


class DocxCleanerApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title(f"{APP_TITLE} v{APP_VERSION}")
        self.geometry("680x520")
        self.minsize(560, 420)
        self.configure(padx=16, pady=16)

        self.input_paths: list[Path] = []
        self.output_dir = tk.StringVar(value="")
        self.keep_page_numbers = tk.BooleanVar(value=False)
        self.status_text = tk.StringVar(value="请选择要整理的 Word 文档（.docx）")

        self._build_ui()

    def _build_ui(self) -> None:
        intro = (
            "适用于扫描/OCR 转 Word 后出现的乱版问题：\n"
            "文本框错位、文字竖排、段落断裂、页码乱飞等。\n"
            "整理后会生成新的 Word 文件，原文件不会被修改。"
        )
        ttk.Label(self, text=intro, justify="left").pack(anchor="w")

        btn_frame = ttk.Frame(self)
        btn_frame.pack(fill="x", pady=(12, 8))

        ttk.Button(btn_frame, text="选择 Word 文件", command=self._pick_files).pack(
            side="left", padx=(0, 8)
        )
        ttk.Button(btn_frame, text="选择文件夹（批量）", command=self._pick_folder).pack(
            side="left", padx=(0, 8)
        )
        ttk.Button(btn_frame, text="开始整理", command=self._start_clean).pack(side="left")

        ttk.Checkbutton(
            self,
            text="保留单独页码（如 15）",
            variable=self.keep_page_numbers,
        ).pack(anchor="w", pady=(0, 8))

        out_frame = ttk.Frame(self)
        out_frame.pack(fill="x", pady=(0, 8))
        ttk.Label(out_frame, text="输出目录：").pack(side="left")
        ttk.Entry(out_frame, textvariable=self.output_dir).pack(
            side="left", fill="x", expand=True, padx=(4, 8)
        )
        ttk.Button(out_frame, text="浏览", command=self._pick_output_dir).pack(side="left")

        self.file_list = tk.Listbox(self, height=8)
        self.file_list.pack(fill="both", expand=False, pady=(0, 8))

        log_frame = ttk.LabelFrame(self, text="处理日志")
        log_frame.pack(fill="both", expand=True)

        self.log_box = tk.Text(log_frame, height=12, state="disabled", wrap="word")
        self.log_box.pack(fill="both", expand=True, padx=8, pady=8)

        status_bar = ttk.Label(self, textvariable=self.status_text, relief="sunken")
        status_bar.pack(fill="x", pady=(8, 0))

    def _pick_files(self) -> None:
        files = filedialog.askopenfilenames(
            title="选择 Word 文档",
            filetypes=[("Word 文档", "*.docx"), ("所有文件", "*.*")],
        )
        if files:
            self.input_paths = [Path(f) for f in files]
            self._refresh_file_list()
            self.status_text.set(f"已选择 {len(self.input_paths)} 个文件")

    def _pick_folder(self) -> None:
        folder = filedialog.askdirectory(title="选择包含 Word 文档的文件夹")
        if not folder:
            return
        paths = sorted(Path(folder).glob("*.docx"))
        paths = [p for p in paths if not p.name.endswith("_已整理.docx")]
        if not paths:
            messagebox.showwarning("提示", "该文件夹里没有找到 .docx 文件")
            return
        self.input_paths = paths
        self._refresh_file_list()
        self.status_text.set(f"已选择 {len(self.input_paths)} 个文件")

    def _pick_output_dir(self) -> None:
        folder = filedialog.askdirectory(title="选择输出目录")
        if folder:
            self.output_dir.set(folder)

    def _refresh_file_list(self) -> None:
        self.file_list.delete(0, tk.END)
        for path in self.input_paths:
            self.file_list.insert(tk.END, str(path))

    def _append_log(self, message: str) -> None:
        self.log_box.configure(state="normal")
        self.log_box.insert(tk.END, message + "\n")
        self.log_box.see(tk.END)
        self.log_box.configure(state="disabled")

    def _start_clean(self) -> None:
        if not self.input_paths:
            messagebox.showinfo("提示", "请先选择至少一个 .docx 文件")
            return

        thread = threading.Thread(target=self._run_clean, daemon=True)
        thread.start()

    def _run_clean(self) -> None:
        total = len(self.input_paths)
        success = 0
        output_root = Path(self.output_dir.get()) if self.output_dir.get() else None

        self._append_log("=" * 40)
        self._append_log(f"开始处理 {total} 个文件...")

        for index, input_path in enumerate(self.input_paths, start=1):
            try:
                if output_root:
                    output_path = output_root / f"{input_path.stem}_已整理.docx"
                else:
                    output_path = input_path.with_name(f"{input_path.stem}_已整理.docx")

                stats = clean_docx(
                    input_path,
                    output_path,
                    keep_page_numbers=self.keep_page_numbers.get(),
                )
                success += 1
                self._append_log(
                    f"[{index}/{total}] 完成: {input_path.name}\n"
                    f"  → {output_path}\n"
                    f"  提取 {stats.input_blocks} 段，输出 {stats.output_paragraphs} 段，"
                    f"修正旋转 {stats.unrotated_blocks} 处，文本框 {stats.textbox_blocks} 个"
                )
                self.status_text.set(f"正在处理 {index}/{total}...")
            except Exception as exc:
                self._append_log(f"[{index}/{total}] 失败: {input_path.name}\n  原因: {exc}")

        self.status_text.set(f"处理完成：成功 {success}/{total}")
        if success == total:
            messagebox.showinfo("完成", f"全部 {total} 个文件整理完成！")
        else:
            messagebox.showwarning("完成", f"成功 {success} 个，失败 {total - success} 个，请查看日志。")


def main() -> None:
    if getattr(sys, "frozen", False):
        os.chdir(Path(sys.executable).parent)
    app = DocxCleanerApp()
    app.mainloop()


if __name__ == "__main__":
    main()
