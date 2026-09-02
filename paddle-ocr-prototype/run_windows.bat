@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

if "%~1"=="" (
  echo 用法: run_windows.bat ^<pdf或目录路径^>
  echo 示例: run_windows.bat "D:\扫描件\1111.pdf"
  echo.
  echo 扫描件请用: run_scanned.bat "文件.pdf"
  pause
  exit /b 1
)

if not exist venv\Scripts\activate.bat (
  echo 首次使用请先运行 install_windows.bat
  pause
  exit /b 1
)

call venv\Scripts\activate.bat
python paddle_pdf_to_word.py "%~1" -o output-docx --mode auto

echo.
echo 完成，输出目录: output-docx
pause
