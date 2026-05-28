@echo off
REM Script khởi động toàn bộ hệ thống Smart Healthcare Platform (Batch)
REM Dùng cho Command Prompt (cmd.exe)

chcp 65001 > nul
cls

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║     ❤️  SMART HEALTHCARE PLATFORM - STARTUP              ║
echo ║     Nền Tảng Y Tế Tích Hợp cho Người Cao Tuổi           ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

set "scriptPath=%~dp0"

echo 📍 Thư mục project: %scriptPath%
echo.
echo ═══════════════════════════════════════════════════════════
echo Chọn tùy chọn khởi động:
echo ═══════════════════════════════════════════════════════════
echo.
echo 1️⃣  Khởi động Backend (http://localhost:8000)
echo 2️⃣  Khởi động Frontend (http://localhost:5173)
echo 3️⃣  Khởi động CẢ BACKEND + FRONTEND (Khuyến nghị)
echo 4️⃣  Thoát
echo.

set /p choice="Nhập lựa chọn (1-4): "

if "%choice%"=="1" (
    cls
    echo.
    echo 🔵 Khởi động Backend...
    echo.
    cd /d "%scriptPath%backend"
    
    if not exist "venv\Scripts\activate.bat" (
        echo ⚠️ Virtual Environment không tìm thấy
        echo Tạo venv: python -m venv venv
        pause
        exit /b 1
    )
    
    call venv\Scripts\activate.bat
    
    echo ✅ Virtual Environment đã kích hoạt
    echo 🌐 Backend URL: http://localhost:8000
    echo 📖 API Docs:    http://localhost:8000/docs
    echo.
    echo Nhấn Ctrl+C để dừng server
    echo.
    
    uvicorn main:app --reload
)

if "%choice%"=="2" (
    cls
    echo.
    echo 🔵 Khởi động Frontend...
    echo.
    cd /d "%scriptPath%frontend"
    
    if not exist "node_modules" (
        echo ⚠️ node_modules không tìm thấy
        echo ⏳ Cài đặt dependencies...
        call npm install
        if errorlevel 1 (
            echo ❌ Lỗi cài đặt dependencies
            pause
            exit /b 1
        )
    )
    
    echo ✅ Khởi động Vite Dev Server
    echo 🌐 Frontend URL: http://localhost:5173
    echo 👤 Đăng nhập: test@test.com / 123456
    echo.
    echo Nhấn Ctrl+C để dừng server
    echo.
    
    call npm run dev
)

if "%choice%"=="3" (
    cls
    echo.
    echo 🔵 Khởi động cả Backend lẫn Frontend...
    echo.
    
    echo ⏳ Khởi động Backend (Tab mới)...
    start "Backend Server" cmd /k "cd /d %scriptPath%backend && call venv\Scripts\activate.bat && uvicorn main:app --reload"
    
    timeout /t 3 /nobreak
    
    echo ⏳ Khởi động Frontend (Tab mới)...
    start "Frontend Server" cmd /k "cd /d %scriptPath%frontend && npm run dev"
    
    cls
    echo.
    echo ✅ Hệ thống đang khởi động...
    echo.
    echo Chờ 10-15 giây cho các server khởi động hoàn toàn
    echo.
    echo 📱 Sau đó, truy cập:
    echo    🌐 Frontend: http://localhost:5173
    echo    📖 Backend API Docs: http://localhost:8000/docs
    echo.
    echo 👤 Đăng nhập:
    echo    Email: test@test.com
    echo    Password: 123456
    echo.
    pause
)

if "%choice%"=="4" (
    echo.
    echo 👋 Tạm biệt!
    exit /b 0
)

if not "%choice%"=="1" if not "%choice%"=="2" if not "%choice%"=="3" if not "%choice%"=="4" (
    echo.
    echo ❌ Lựa chọn không hợp lệ!
    pause
    exit /b 1
)
