# Script khởi động toàn bộ hệ thống Smart Healthcare Platform

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗"
Write-Host "║     ❤️  SMART HEALTHCARE PLATFORM - STARTUP SCRIPT      ║"
Write-Host "║     Nền Tảng Y Tế Tích Hợp cho Người Cao Tuổi           ║"
Write-Host "╚════════════════════════════════════════════════════════════╝"
Write-Host ""

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "📍 Thư mục project: $scriptPath"
Write-Host ""

# Menu chọn
Write-Host "═══════════════════════════════════════════════════════════"
Write-Host "Chọn tùy chọn khởi động:"
Write-Host "═══════════════════════════════════════════════════════════"
Write-Host ""
Write-Host "1️⃣  Khởi động Backend (http://localhost:8000)"
Write-Host "2️⃣  Khởi động Frontend (http://localhost:5173)"
Write-Host "3️⃣  Khởi động CÁCH BACKEND + FRONTEND (Khuyến nghị)"
Write-Host "4️⃣  Thoát"
Write-Host ""

$choice = Read-Host "Nhập lựa chọn (1-4)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "🔵 Khởi động Backend..."
        Write-Host ""
        & "$scriptPath\start_backend.ps1"
    }
    "2" {
        Write-Host ""
        Write-Host "🔵 Khởi động Frontend..."
        Write-Host ""
        & "$scriptPath\start_frontend.ps1"
    }
    "3" {
        Write-Host ""
        Write-Host "🔵 Khởi động cả Backend lẫn Frontend..."
        Write-Host ""
        Write-Host "Cửa sổ 1: Backend sẽ mở trong tab mới"
        Write-Host "Cửa sổ 2: Frontend sẽ mở trong tab khác"
        Write-Host ""
        
        # Khởi động Backend trong tab mới
        Write-Host "⏳ Khởi động Backend..."
        Start-Process pwsh -ArgumentList "-NoExit -Command `"cd '$scriptPath'; & '.\start_backend.ps1'`""
        
        # Chờ 5 giây để Backend khởi động
        Start-Sleep -Seconds 5
        
        # Khởi động Frontend trong tab mới
        Write-Host "⏳ Khởi động Frontend..."
        Start-Process pwsh -ArgumentList "-NoExit -Command `"cd '$scriptPath'; & '.\start_frontend.ps1'`""
        
        Write-Host ""
        Write-Host "✅ Hệ thống đang khởi động..."
        Write-Host ""
        Write-Host "Chờ 10-15 giây cho các server khởi động hoàn toàn"
        Write-Host ""
        Write-Host "📱 Sau đó, truy cập:"
        Write-Host "   🌐 Frontend: http://localhost:5173"
        Write-Host "   📖 Backend API Docs: http://localhost:8000/docs"
        Write-Host ""
        Write-Host "👤 Đăng nhập:"
        Write-Host "   Email: test@test.com"
        Write-Host "   Password: 123456"
        Write-Host ""
    }
    "4" {
        Write-Host ""
        Write-Host "👋 Tạm biệt!"
        exit 0
    }
    default {
        Write-Host ""
        Write-Host "❌ Lựa chọn không hợp lệ!"
        exit 1
    }
}
