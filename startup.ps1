# Script khoi dong toan bo he thong Smart Healthcare Platform

Write-Host ""
Write-Host "============================================================"
Write-Host "      SMART HEALTHCARE PLATFORM - STARTUP SCRIPT            "
Write-Host "      Nen tang Y te Tich hop cho Nguoi cao tuoi             "
Write-Host "============================================================"
Write-Host ""

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "[+] Thu muc project: $scriptPath"
Write-Host ""

# Menu chon
Write-Host "-----------------------------------------------------------"
Write-Host "Chon tuy chon khoi dong:"
Write-Host "-----------------------------------------------------------"
Write-Host ""
Write-Host "1. Khoi dong Backend (http://localhost:8000)"
Write-Host "2. Khoi dong Frontend (http://localhost:5173)"
Write-Host "3. Khoi dong CA BACKEND + FRONTEND (Khuyen nghi)"
Write-Host "4. Thoat"
Write-Host ""

$choice = Read-Host "Nhap lua chon (1-4)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "[*] Khoi dong Backend..."
        Write-Host ""
        & "$scriptPath\start_backend.ps1"
    }
    "2" {
        Write-Host ""
        Write-Host "[*] Khoi dong Frontend..."
        Write-Host ""
        & "$scriptPath\start_frontend.ps1"
    }
    "3" {
        Write-Host ""
        Write-Host "[*] Khoi dong ca Backend lan Frontend..."
        Write-Host ""
        Write-Host "Cua so 1: Backend se mo trong tab moi"
        Write-Host "Cua so 2: Frontend se mo trong tab khac"
        Write-Host ""
        
        # Khoi dong Backend trong tab moi
        Write-Host "[*] Khoi dong Backend..."
        Start-Process powershell -ArgumentList "-NoExit -ExecutionPolicy Bypass -Command `"cd '$scriptPath'; & '.\start_backend.ps1'`""
        
        # Cho 5 giay de Backend khoi dong
        Start-Sleep -Seconds 5
        
        # Khoi dong Frontend trong tab moi
        Write-Host "[*] Khoi dong Frontend..."
        Start-Process powershell -ArgumentList "-NoExit -ExecutionPolicy Bypass -Command `"cd '$scriptPath'; & '.\start_frontend.ps1'`""
        
        Write-Host ""
        Write-Host "[+] He thong dang khoi dong..."
        Write-Host ""
        Write-Host "Cho 10-15 giay cho cac server khoi dong hoan toan"
        Write-Host ""
        Write-Host "Sau do, truy cap:"
        Write-Host "   Frontend: http://localhost:5173"
        Write-Host "   Backend API Docs: http://localhost:8000/docs"
        Write-Host ""
        Write-Host "Dang nhap:"
        Write-Host "   Email: test@test.com"
        Write-Host "   Password: 123456"
        Write-Host ""
    }
    "4" {
        Write-Host ""
        Write-Host "[*] Tam biet!"
        exit 0
    }
    default {
        Write-Host ""
        Write-Host "[!] Lua chon khong hop le!"
        exit 1
    }
}
