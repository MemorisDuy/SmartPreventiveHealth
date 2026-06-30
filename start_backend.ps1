# Script khoi dong Backend Smart Healthcare Platform

Write-Host "======================================"
Write-Host "[*] Khoi Dong Backend Server"
Write-Host "======================================"
Write-Host ""

# Di vao thu muc backend
Set-Location "$PSScriptRoot\backend"

Write-Host "[+] Thu muc hien tai: $(Get-Location)"
Write-Host ""

# Kiem tra Python
Write-Host "[*] Kiem tra Python..."
$venvPython = Join-Path (Get-Location) "venv\Scripts\python.exe"
if (Test-Path $venvPython) {
    $pythonCheck = & $venvPython --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[x] Python trong backend\venv dang bi loi:"
        Write-Host "    $pythonCheck"
        Write-Host ""
        Write-Host "Cach sua backend:"
        Write-Host "  1. Cai Python tu https://www.python.org/downloads/"
        Write-Host "  2. Xoa backend\venv cu"
        Write-Host "  3. Chay: python -m venv backend\venv"
        Write-Host "  4. Chay: backend\venv\Scripts\python.exe -m pip install -r backend\requirements.txt"
        Write-Host ""
        Write-Host "Frontend van co the chay rieng bang lua chon 2 trong startup.ps1."
        exit 1
    }
    Write-Host "[v] $pythonCheck"
} else {
    Write-Host "[!] Virtual Environment khong tim thay"
    Write-Host "   Tao venv: python -m venv venv"
    exit 1
}
Write-Host ""

# Kiem tra requirements
Write-Host "[*] Kiem tra dependencies..."
if (-not (Test-Path "requirements.txt")) {
    Write-Host "[x] Khong tim thay requirements.txt"
    exit 1
}
Write-Host "[v] requirements.txt tim thay"
Write-Host ""

# Kiem tra database
Write-Host "[*] Kiem tra database..."
if ((Get-Content ".env" -ErrorAction SilentlyContinue) -match "DB_HOST") {
    Write-Host "[v] File .env da duoc cau hinh"
} else {
    Write-Host "[!] File .env chua duoc cau hinh"
    Write-Host "   Vui long cau hinh DB_HOST, DB_USER, DB_PASSWORD, DB_NAME"
}
Write-Host ""

# Kiem tra model
Write-Host "[*] Kiem tra ML Model..."
if (Test-Path "heart_risk_model.pkl") {
    Write-Host "[v] Model heart_risk_model.pkl tim thay"
} else {
    Write-Host "[!] Model chua huan luyen"
    Write-Host "   Chay: python train_model.py"
    Write-Host ""
    Write-Host "Ban co muon huan luyen model ngay khong? (y/n)"
    $response = Read-Host
    if ($response -eq "y" -or $response -eq "Y") {
        Write-Host "[*] Dang huan luyen model..."
        & $venvPython train_model.py
    }
}
Write-Host ""

# Khoi dong server
Write-Host "======================================"
Write-Host "[+] Khoi dong Uvicorn Server"
Write-Host "======================================"
Write-Host ""
Write-Host "Backend URL: http://localhost:8000"
Write-Host "API Docs:    http://localhost:8000/docs"
Write-Host ""
Write-Host "Nhan Ctrl+C de dung server"
Write-Host ""

& $venvPython -m uvicorn main:app --reload
