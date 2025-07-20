@echo off
chcp 65001 >nul

echo ========================================
echo    Avellaneda 做市策略 - 快速启动
echo ========================================
echo.

:: 切换到项目目录
cd /d "%~dp0"

:: 检查必要文件
if not exist "index.js" (
    echo ❌ 错误: 未找到主程序文件 index.js
    pause
    exit /b 1
)

if not exist ".env" (
    echo ❌ 错误: 未找到环境配置文件 .env
    echo 💡 请先运行 start.bat 进行完整配置
    pause
    exit /b 1
)

:: 创建日志目录
if not exist "logs" mkdir logs

echo 🚀 启动策略中...
echo 💡 按 Ctrl+C 停止策略
echo.

:: 启动策略
node index.js

echo.
echo ✅ 策略已停止
pause 