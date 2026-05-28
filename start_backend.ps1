# Script khởi động Backend Smart Healthcare Platform

Write-Host "======================================"
Write-Host "🚀 Khởi Động Backend Server"
Write-Host "======================================"
Write-Host ""

# Đi vào thư mục backend
Set-Location "$PSScriptRoot\backend"

Write-Host "📁 Thư mục hiện tại: $(Get-Location)"
Write-Host ""

# Kiểm tra Python
Write-Host "🔍 Kiểm tra Python..."
$pythonCheck = python --version 2>&1
Write-Host "✓ $pythonCheck"
Write-Host ""

# Kích hoạt Virtual Environment
Write-Host "🔧 Kích hoạt Virtual Environment..."
if (Test-Path "venv\Scripts\Activate.ps1") {
    & "venv\Scripts\Activate.ps1"
    Write-Host "✓ Virtual Environment đã kích hoạt"
} else {
    Write-Host "⚠️  Virtual Environment không tìm thấy"
    Write-Host "   Tạo venv: python -m venv venv"
    exit 1
}
Write-Host ""

# Kiểm tra requirements
Write-Host "📦 Kiểm tra dependencies..."
if (-not (Test-Path "requirements.txt")) {
    Write-Host "❌ Không tìm thấy requirements.txt"
    exit 1
}
Write-Host "✓ requirements.txt tìm thấy"
Write-Host ""

# Kiểm tra database
Write-Host "🗄️  Kiểm tra database..."
if ((Get-Content ".env" -ErrorAction SilentlyContinue) -match "DB_HOST") {
    Write-Host "✓ File .env đã được cấu hình"
} else {
    Write-Host "⚠️  File .env chưa được cấu hình"
    Write-Host "   Vui lòng cấu hình DB_HOST, DB_USER, DB_PASSWORD, DB_NAME"
}
Write-Host ""

# Kiểm tra model
Write-Host "🤖 Kiểm tra ML Model..."
if (Test-Path "heart_risk_model.pkl") {
    Write-Host "✓ Model heart_risk_model.pkl tìm thấy"
} else {
    Write-Host "⚠️  Model chưa huấn luyện"
    Write-Host "   Chạy: python train_model.py"
    Write-Host ""
    Write-Host "Bạn có muốn huấn luyện model ngay không? (y/n)"
    $response = Read-Host
    if ($response -eq "y" -or $response -eq "Y") {
        Write-Host "⏳ Đang huấn luyện model..."
        python train_model.py
    }
}
Write-Host ""

# Khởi động server
Write-Host "======================================"
Write-Host "✅ Khởi động Uvicorn Server"
Write-Host "======================================"
Write-Host ""
Write-Host "🌐 Backend URL: http://localhost:8000"
Write-Host "📖 API Docs:    http://localhost:8000/docs"
Write-Host ""
Write-Host "Nhấn Ctrl+C để dừng server"
Write-Host ""

uvicorn main:app --reload
