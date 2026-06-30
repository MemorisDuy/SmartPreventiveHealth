# Script khoi dong Frontend Smart Healthcare Platform

Write-Host "======================================"
Write-Host "[*] Khoi Dong Frontend Server"
Write-Host "======================================"
Write-Host ""

# Di vao thu muc frontend
Set-Location "$PSScriptRoot\frontend"

Write-Host "[+] Thu muc hien tai: $(Get-Location)"
Write-Host ""

# Kiem tra Node.js
Write-Host "[*] Kiem tra Node.js..."
$nodeCheck = node --version 2>&1
$npmCheck = npm.cmd --version 2>&1
Write-Host "[v] Node.js: $nodeCheck"
Write-Host "[v] npm: $npmCheck"
Write-Host ""

# Kiem tra node_modules
Write-Host "[*] Kiem tra dependencies..."
if (Test-Path "node_modules") {
    Write-Host "[v] node_modules tim thay"
} else {
    Write-Host "[!] node_modules khong tim thay"
    Write-Host "   Cai dat: npm install"
    Write-Host ""
    Write-Host "[*] Dang cai dat dependencies..."
    npm.cmd install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[x] Loi cai dat dependencies"
        exit 1
    }
}
Write-Host ""

# Khoi dong dev server
Write-Host "======================================"
Write-Host "[+] Khoi dong Vite Dev Server"
Write-Host "======================================"
Write-Host ""
Write-Host "Frontend URL: http://localhost:5173"
Write-Host "Dang nhap:"
Write-Host "   - Email:    test@test.com"
Write-Host "   - Password: 123456"
Write-Host ""
Write-Host "Nhan Ctrl+C de dung server"
Write-Host ""

npm.cmd run dev -- --host 127.0.0.1 --port 5173
