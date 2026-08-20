# PaddleOCR PDF/扫描件 转 Word 原型

这是一个可快速试用的原型：
- 自动判断 **标准PDF** vs **图片扫描PDF**
- 调用 PaddleOCR 的 PP-Structure 恢复版面到 `.docx`
- 支持单文件或目录批量

> 目标：先验证“能不能比直接 Word 打开 PDF 更稳”。

## 1. 准备

- Python 3.10+
- 建议网络可访问模型下载源（首次运行会下载模型）

## 2. Windows 在家电脑（推荐）

**聊天记录看不到？** 直接打开同目录下的 **`在家怎么用.txt`**。

1. 双击 **`install_windows.bat`**（首次，只需一次）
2. 扫描件 PDF 用：**`run_scanned.bat "你的文件.pdf"`**
3. 其他 PDF 用：**`run_windows.bat "你的文件.pdf"`**
4. 结果在 **`output-docx\`**

## 3. Linux/Mac

```bash
cd paddle-ocr-prototype
./run_linux.sh ./1111.pdf
```

## 4. 命令行高级用法

```bash
python paddle_pdf_to_word.py "./1111.pdf" -o output-docx --mode auto
python paddle_pdf_to_word.py "./pdf-dir" -o output-docx --glob "*.pdf" --mode auto
```

参数说明：
- `--mode auto`：自动判断扫描件/标准PDF（默认）
- `--mode scanned`：强制按扫描件OCR路径
- `--mode standard`：强制按标准PDF解析路径

## 5. 结果怎么看

- 成功：`*_ocr.docx`
- 报告：`output-docx/report.json`

## 6. 你这个场景建议

你现在是打印机输出图片PDF，建议：

1. 先用 `--mode scanned` 跑一次
2. 再用 `--mode auto` 跑一次
3. 对比两个 docx，选排版更好的那个

## 7. 常见问题

### Q1: 跑得慢
首次会下载模型，后续会快很多。

### Q2: 还是有错字
OCR一定会有错字，重点检查：数字、日期、人名、条款编号。

### Q3: 转换报错
看 `report.json` 里的 `reason` 字段，贴给我可以继续帮你调参数。

### Q4: 安装后提示 paddleocr 命令参数不对
本项目已适配 PaddleOCR 3.x，请重新运行 `install_windows.bat` 更新依赖。
