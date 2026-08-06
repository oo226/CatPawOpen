@echo off
chcp 65001 >nul
setlocal

if "%~1"=="" (
  echo 用法: run_windows.bat ^<pdf或目录路径^>
  echo 示例: run_windows.bat "D:\扫描件\1111.pdf"
  pause
  exit /b 1
)

python -m pip install -r requirements.txt
if errorlevel 1 (
  echo 依赖安装失败
  pause
  exit /b 1
)

python paddle_pdf_to_word.py "%~1" -o output-docx --mode auto

echo.
echo 完成，输出目录: output-docx
pause
