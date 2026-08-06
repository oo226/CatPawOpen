@echo off
chcp 65001 >nul
echo ========================================
echo   Word 文档一键整理工具 - 打包脚本
echo ========================================
echo.

where python >nul 2>nul
if errorlevel 1 (
    echo [错误] 未找到 Python，请先安装 Python 3.10+
    echo 下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [1/3] 安装依赖...
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo [错误] 依赖安装失败
    pause
    exit /b 1
)

echo.
echo [2/3] 打包 EXE（可能需要 1-2 分钟）...
python -m PyInstaller ^
    --onefile ^
    --windowed ^
    --name "Word文档一键整理" ^
    gui.py

if errorlevel 1 (
    echo [错误] 打包失败
    pause
    exit /b 1
)

echo.
echo [3/3] 完成！
echo.
echo EXE 文件位置:
echo   dist\Word文档一键整理.exe
echo.
echo 双击 dist\Word文档一键整理.exe 即可使用
echo.
pause
