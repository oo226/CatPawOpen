@echo off
chcp 65001 >nul
echo ========================================
echo   Word 文档一键整理 - 网页测试版
echo ========================================
echo.

where python >nul 2>nul
if errorlevel 1 (
    echo [错误] 未找到 Python，请先安装 Python 3.10+
    pause
    exit /b 1
)

echo [1/2] 检查依赖...
python -m pip install -q -r requirements.txt
if errorlevel 1 (
    echo [错误] 依赖安装失败
    pause
    exit /b 1
)

echo.
echo [2/2] 启动网页服务...
echo 浏览器会自动打开 http://127.0.0.1:8765
echo 按 Ctrl+C 可停止
echo.

start http://127.0.0.1:8765
python web_app.py

pause
