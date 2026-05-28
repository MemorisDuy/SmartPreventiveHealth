# Script khởi động Frontend Smart Healthcare Platform

Write-Host "======================================"
Write-Host "🚀 Khởi Động Frontend Server"
Write-Host "======================================"
Write-Host ""

# Đi vào thư mục frontend
Set-Location "$PSScriptRoot\frontend"

Write-Host "📁 Thư mục hiện tại: $(Get-Location)"
Write-Host ""

# Kiểm tra Node.js
Write-Host "🔍 Kiểm tra Node.js..."
$nodeCheck = node --version 2>&1
$npmCheck = npm --version 2>&1
Write-Host "✓ Node.js: $nodeCheck"
Write-Host "✓ npm: $npmCheck"
Write-Host ""

# Kiểm tra node_modules
Write-Host "📦 Kiểm tra dependencies..."
if (Test-Path "node_modules") {
    Write-Host "✓ node_modules tìm thấy"
} else {
    Write-Host "⚠️  node_modules không tìm thấy"
    Write-Host "   Cài đặt: npm install"
    Write-Host ""
    Write-Host "⏳ Đang cài đặt dependencies..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Lỗi cài đặt dependencies"
        exit 1
    }
}
Write-Host ""

# Khởi động dev server
Write-Host "======================================"
Write-Host "✅ Khởi động Vite Dev Server"
Write-Host "======================================"
Write-Host ""
Write-Host "🌐 Frontend URL: http://localhost:5173"
Write-Host "📝 Đăng nhập:"
Write-Host "   - Email:    test@test.com"
Write-Host "   - Password: 123456"
Write-Host ""
Write-Host "Nhấn Ctrl+C để dừng server"
Write-Host ""

npm run dev
