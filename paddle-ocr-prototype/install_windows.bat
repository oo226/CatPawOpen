@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ========================================
echo   首次安装（只需运行一次）
echo ========================================
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 Python
  echo 请先安装 Python 3.10+ 并勾选 Add Python to PATH
  echo https://www.python.org/downloads/
  pause
  exit /b 1
)

echo [1/3] 创建虚拟环境 venv ...
if not exist venv (
  python -m venv venv
)
call venv\Scripts\activate.bat

echo.
echo [2/3] 安装依赖（首次较慢，请耐心等待）...
python -m pip install -U pip -i https://pypi.tuna.tsinghua.edu.cn/simple
python -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
if errorlevel 1 (
  echo 镜像失败，尝试官方源...
  python -m pip install -r requirements.txt
)
if errorlevel 1 (
  echo [错误] 依赖安装失败
  pause
  exit /b 1
)

echo.
echo [3/3] 验证安装...
python -c "import fitz; print('PyMuPDF OK')"
python -m paddleocr --help >nul 2>nul
if errorlevel 1 (
  echo PaddleOCR 命令行未就绪，但 pip 包可能已安装，可先试 run_windows.bat
) else (
  echo PaddleOCR OK
)

echo.
echo ========================================
echo   安装完成！
echo   下一步：run_windows.bat "你的文件.pdf"
echo   扫描件推荐：run_scanned.bat "你的文件.pdf"
echo ========================================
pause
