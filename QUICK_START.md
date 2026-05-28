# 🚀 Hướng Dẫn Khởi Động Nhanh

## 🎯 3 Cách Khởi Động Hệ Thống

### ✨ Cách 1: Khởi Động Bằng Script (Đơn Giản Nhất)

#### Windows - Dùng PowerShell
```powershell
# 1. Mở PowerShell tại thư mục SmartHealthcare
# 2. Chạy lệnh này:
.\startup.ps1

# 3. Chọn menu:
#    1 = Backend chỉ
#    2 = Frontend chỉ
#    3 = Cả hai (Khuyến nghị)
#    4 = Thoát
```

#### Windows - Dùng Command Prompt
```cmd
# 1. Mở cmd.exe tại thư mục SmartHealthcare
# 2. Chạy:
startup.bat

# 3. Chọn menu như trên
```

#### macOS/Linux
```bash
cd SmartHealthcare
chmod +x startup.ps1
pwsh ./startup.ps1
```

---

### 📋 Cách 2: Khởi Động Từng Phần Riêng

#### Backend (Terminal 1)
```powershell
# Windows PowerShell
.\start_backend.ps1

# Hoặc chạy trực tiếp
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

#### Frontend (Terminal 2)
```powershell
# Windows PowerShell
.\start_frontend.ps1

# Hoặc chạy trực tiếp
cd frontend
npm install
npm run dev
```

---

### 🔧 Cách 3: Khởi Động Thủ Công (Chi Tiết)

#### Bước 1: Backend
```bash
cd backend

# Tạo virtual environment (lần đầu)
python -m venv venv

# Kích hoạt
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# Cài dependencies (lần đầu)
pip install -r requirements.txt

# Kiểm tra .env
# Chỉnh sửa: DB_HOST, DB_USER, DB_PASSWORD, GROQ_API_KEY

# Tạo database (lần đầu)
mysql -u root < schema.sql

# Huấn luyện model (lần đầu)
python train_model.py

# Chạy server
uvicorn main:app --reload
```

#### Bước 2: Frontend
```bash
# Terminal mới
cd frontend

# Cài packages (lần đầu)
npm install

# Chạy dev server
npm run dev
```

---

## ✅ Kiểm Tra Hệ Thống

### Backend Chạy Thành Công?
```
✓ Browser: http://localhost:8000/docs
✓ Sẽ thấy Swagger UI với các API endpoints
```

### Frontend Chạy Thành Công?
```
✓ Browser: http://localhost:5173
✓ Sẽ thấy màn hình Login
✓ Đăng nhập: test@test.com / 123456
```

---

## 🆘 Khắc Phục Sự Cố

### Lỗi: "Virtual Environment not found"
```powershell
# Tạo venv
cd backend
python -m venv venv
```

### Lỗi: "Module not found"
```bash
# Cài lại dependencies
pip install -r requirements.txt
```

### Lỗi: "MySQL not running"
```bash
# Khởi động MySQL service
# Windows: Control Panel > Services > MySQL
# macOS: mysql.server start
# Linux: sudo systemctl start mysql
```

### Lỗi: "Port 8000 already in use"
```bash
# Dùng port khác
uvicorn main:app --reload --port 8001
# Sau đó cập nhật axios baseURL
```

### Lỗi: "npm command not found"
```bash
# Download Node.js từ: https://nodejs.org/
```

---

## 📊 Trạng Thái Hệ Thống

| Component | Port | URL | Status |
|-----------|------|-----|--------|
| Backend API | 8000 | http://localhost:8000 | ✅ Running |
| API Docs | 8000 | http://localhost:8000/docs | ✅ Available |
| Frontend | 5173 | http://localhost:5173 | ✅ Running |
| MySQL | 3306 | localhost | ✅ Connected |

---

## 🎯 Workflow

```
1. Chạy script startup.ps1 hoặc startup.bat
   ↓
2. Chọn "3" (Backend + Frontend)
   ↓
3. Backend khởi động (mất ~5 giây)
   ↓
4. Frontend khởi động (mất ~10 giây)
   ↓
5. Browser tự mở http://localhost:5173
   ↓
6. Đăng nhập: test@test.com / 123456
   ↓
7. Sử dụng các tính năng ✨
```

---

## 💡 Mẹo Nhanh

### Khởi động lần tiếp theo
```
# Chỉ cần chạy startup.ps1 hoặc startup.bat
# Virtual environment & npm packages đã được cài
```

### Dừng server
```
Nhấn: Ctrl + C (trong cửa sổ terminal)
```

### Cập nhật code
```
# Frontend: Vite sẽ auto hot reload khi bạn sửa file
# Backend: FastAPI sẽ auto reload (--reload)
```

### Xóa cache
```powershell
# Xóa cache npm
npm cache clean --force

# Xóa cache Python
cd backend
Remove-Item -Recurse __pycache__
```

---

## 🔐 Tài Khoản Test

| Field | Value |
|-------|-------|
| Email | test@test.com |
| Password | 123456 |

---

## 📝 Lệnh Hữu Ích

```bash
# Cài lại dependencies (Backend)
pip install --upgrade -r requirements.txt

# Cài lại dependencies (Frontend)
npm install --save-dev

# Build Frontend cho production
npm run build

# Kiểm tra phiên bản Node
node --version

# Kiểm tra phiên bản Python
python --version

# Liệt kê MySQL databases
mysql -u root -p -e "SHOW DATABASES;"

# Kiểm tra health API
curl http://localhost:8000/api/health
```

---

## 🎉 Hoàn Thành!

Bạn đã sẵn sàng khởi động SmartPreventiveHealth!

**Chạy ngay:** `.\startup.ps1` hoặc `startup.bat`

❤️ Chúc bạn sử dụng thành công!
