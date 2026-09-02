@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

if "%~1"=="" (
  echo 用法: run_scanned.bat ^<PDF路径^>
  echo 示例: run_scanned.bat "1111.pdf"
  echo.
  echo 扫描件/图片PDF 请用这个（强制 OCR 模式）
  pause
  exit /b 1
)

if not exist venv\Scripts\activate.bat (
  echo 请先双击运行 install_windows.bat
  pause
  exit /b 1
)

call venv\Scripts\activate.bat
python paddle_pdf_to_word.py "%~1" -o output-docx --mode scanned

echo.
echo 完成！查看 output-docx 文件夹
pause
