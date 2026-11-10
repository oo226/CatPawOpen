@echo off
chcp 65001 >nul
title 扫描PDF转Word - 一键安装并转换
cd /d "%~dp0"

echo.
echo  ============================================
echo    扫描 PDF 转 Word（PaddleOCR）
echo  ============================================
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo [X] 没检测到 Python
  echo.
  echo 请先安装 Python 3.10 或 3.11
  echo 下载: https://www.python.org/downloads/
  echo 安装时务必勾选: Add Python to PATH
  echo.
  pause
  exit /b 1
)

if not exist venv\Scripts\activate.bat (
  echo [*] 首次运行，正在安装依赖（约 5~15 分钟，请别关窗口）...
  python -m venv venv
  call venv\Scripts\activate.bat
  python -m pip install -U pip -i https://pypi.tuna.tsinghua.edu.cn/simple
  python -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
  if errorlevel 1 python -m pip install -r requirements.txt
  if errorlevel 1 (
    echo [X] 安装失败，检查网络后重试
    pause
    exit /b 1
  )
  echo [OK] 安装完成
) else (
  call venv\Scripts\activate.bat
)

echo.
set "PDF=%~1"
if "%PDF%"=="" (
  echo 请把 PDF 文件拖到这个 bat 图标上，或输入完整路径：
  set /p PDF="PDF路径: "
)

if not exist "%PDF%" (
  echo [X] 找不到文件: %PDF%
  pause
  exit /b 1
)

echo.
echo [*] 正在转换（扫描件模式）: %PDF%
echo     页数多会较慢，请耐心等待...
echo.

python paddle_pdf_to_word.py "%PDF%" -o output-docx --mode scanned

if errorlevel 1 (
  echo.
  echo [X] 转换失败，查看 output-docx\report.json
) else (
  echo.
  echo [OK] 完成！输出文件夹: %~dp0output-docx
  explorer "%~dp0output-docx"
)

pause
