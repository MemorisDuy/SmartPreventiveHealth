# 📖 Hướng Dẫn Chi Tiết - Khởi Chạy Hệ Thống

## 🎯 Mục Tiêu
Hườbng dẫn đầy đủ để khởi chạy hệ thống SmartPreventiveHealth trên máy tính của bạn.

---

## ✅ Yêu Cầu Trước Tiên

### Cài Đặt Phần Mềm Cần Thiết

#### 1. Python 3.10+
```bash
# Download từ: https://www.python.org/downloads/
# Khi cài đặt, chọn "Add Python to PATH"

# Kiểm tra version
python --version
```

#### 2. Node.js 16+
```bash
# Download từ: https://nodejs.org/
# Khi cài đặt, npm sẽ được cài tự động

# Kiểm tra version
node --version
npm --version
```

#### 3. MySQL 8.0+
```bash
# Download từ: https://dev.mysql.com/downloads/mysql/
# Hoặc dùng Windows Subsystem for Linux (WSL)

# Kiểm tra
mysql --version

# Khởi động MySQL service (Windows)
# Hoặc chạy: mysqld
```

#### 4. Git (tuỳ chọn, để clone dự án)
```bash
# Download từ: https://git-scm.com/
```

---

## 🏗️ Phần 1: Chuẩn Bị Backend

### Bước 1: Tạo thư mục và vào thư mục backend

```bash
# Windows
cd g:\dow111\trituenhantao\SmartHealthcare\backend

# macOS/Linux
cd /path/to/SmartHealthcare/backend
```

### Bước 2: Tạo Virtual Environment

```bash
# Tạo venv
python -m venv venv

# Kích hoạt venv
# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

# Nếu thành công, prompt sẽ hiện "(venv)"
```

### Bước 3: Cài Đặt Dependencies

```bash
# Cập nhật pip trước (tuỳ chọn)
pip install --upgrade pip

# Cài đặt từ requirements.txt
pip install -r requirements.txt

# Kiểm tra
pip list
# Sẽ thấy: fastapi, uvicorn, mysql-connector-python, groq, bcrypt, v.v.
```

### Bước 4: Cấu Hình Database

#### 4a. Tạo Database
```bash
# Mở MySQL command line
mysql -u root -p

# Nhập mật khẩu (nếu có)
```

```sql
-- Trong MySQL shell
SOURCE schema.sql;

-- Hoặc copy-paste toàn bộ nội dung schema.sql vào đây

-- Kiểm tra
SHOW DATABASES;
USE healthcare_db;
SHOW TABLES;
```

#### 4b. Tạo File .env
```bash
# Sao chép từ .env (đã có sẵn)
# Hoặc tạo file mới: .env



### Bước 5: Tải Dữ Liệu BRFSS2015

```bash
# Download file CSV từ Kaggle:
# https://www.kaggle.com/datasets/alexteboul/heart-disease-health-indicators-dataset

# Giải nén và copy file "heart_disease_health_indicators_BRFSS2015.csv" vào thư mục backend/
# Hoặc điều chỉnh đường dẫn trong train_model.py
```

### Bước 6: Huấn Luyện ML Model

```bash
# Chắc chắn rằng venv được kích hoạt

python train_model.py

# Output sẽ hiện:
# [BƯỚC 1] Đang tải dữ liệu...
# ✓ Tải dữ liệu thành công!
# ...
# ✓ Mô hình Heart Risk Random Forest đã tải thành công!
# ✓ Đã lưu thành công file 'heart_risk_model.pkl'!

# Kiểm tra file được tạo
ls -la heart_risk_model.pkl
# hoặc (Windows)
dir heart_risk_model.pkl
```

### Bước 7: Chạy Backend Server

```bash
# Chắc chắn venv đang hoạt động
# Chạy server
uvicorn main:app --reload

# Output sẽ hiện:
# Uvicorn running on http://127.0.0.1:8000
# ✓ FastAPI Server đã khởi động thành công!

# Kiểm tra:
# - Mở browser: http://localhost:8000/docs
# - Sẽ thấy Swagger UI với tất cả endpoints
```

---

## 🎨 Phần 2: Chuẩn Bị Frontend

### Bước 1: Mở Terminal Mới (hoặc Tab Mới)

```bash
# KHÔNG đóng terminal Backend, hãy mở terminal mới
cd g:\dow111\trituenhantao\SmartHealthcare\frontend
```

### Bước 2: Cài Đặt Dependencies

```bash
# Cài npm packages
npm install

# Hoặc dùng yarn
yarn install

# Output cuối cùng sẽ hiện:
# added XXX packages
```

### Bước 3: Chạy Dev Server

```bash
# Chạy development server
npm run dev

# Output sẽ hiện:
# ➜  Local:   http://127.0.0.1:5173/
# ➜  press h to show help

# Browser sẽ tự mở http://localhost:5173
```

---

## ✅ Kiểm Tra Hệ Thống

### 1. Kiểm Tra Backend
```bash
# Mở browser hoặc Postman
# GET http://localhost:8000/api/health

# Sẽ nhận response:
{
  "status": "ok",
  "model_loaded": true,
  "timestamp": "2024-01-15T10:30:00"
}
```

### 2. Kiểm Tra Frontend
```bash
# Browser đã mở http://localhost:5173
# Sẽ thấy màn hình Login
# Đăng nhập bằng:
# - Email: test@test.com
# - Mật khẩu: 123456
```

### 3. Kiểm Tra Database
```bash
# Từ MySQL shell
mysql -u root -p
USE healthcare_db;

# Kiểm tra các bảng
SHOW TABLES;
SELECT * FROM users;
SELECT * FROM health_records;
```

---

## 🧪 Thử Nghiệm Các Tính Năng

### 1. Thử Dashboard
1. Đăng nhập
2. Quay lại Dashboard
3. Điền 11 chỉ số y tế
4. Nhấn "Phân Tích Nguy Cơ"
5. Xem kết quả % rủi ro

### 2. Thử Chat AI
1. Quay lại Chat
2. Nhập câu hỏi: "Tôi có huyết áp cao, nên ăn gì?"
3. Xem Bác sĩ AI trả lời

### 3. Thử Bản Đồ SOS
1. Quay lại SOS
2. Nhấn nút SOS lớn
3. Cho phép truy cập GPS
4. Xem bản đồ với vị trí

### 4. Thử Phân Tích Dinh Dưỡng
1. Quay lại Dinh Dưỡng
2. Nhập: "Tô phở bò, ly cà phê đá"
3. Nhấn "Phân Tích"
4. Xem kết quả

### 5. Xem Lịch Sử
1. Quay lại Lịch Sử
2. Xem biểu đồ xu hướng rủi ro
3. Xem chi tiết các lần đo

---

## 🛑 Dừng Hệ Thống

### Dừng Backend
```bash
# Trong terminal Backend
Ctrl + C

# Output sẽ hiện:
# Shutting down
# Shutdown complete
```

### Dừng Frontend
```bash
# Trong terminal Frontend
Ctrl + C

# Hoặc đóng browser tab
```

### Deactivate Virtual Environment (tuỳ chọn)
```bash
# Trong thư mục backend
deactivate
```

---

## ⚠️ Các Lỗi Thường Gặp

### Lỗi 1: "mysql-connector-python not found"
```bash
# Giải pháp:
pip install mysql-connector-python
```

### Lỗi 2: "CORS error"
```bash
# Backend đã cấu hình CORS
# Kiểm tra axios.js, baseURL phải là: http://localhost:8000
```

### Lỗi 3: "Model not found"
```bash
# Giải pháp: Chạy train_model.py trước
python train_model.py
```

### Lỗi 4: "Port 8000 already in use"
```bash
# Giải pháp: Dùng port khác
uvicorn main:app --reload --port 8001
# Sau đó cập nhật axios baseURL
```

### Lỗi 5: "Port 5173 already in use"
```bash
# Giải pháp:
npm run dev -- --port 5174
```

---

## 📦 Build Cho Production

### Build Frontend
```bash
cd frontend
npm run build

# Sẽ tạo thư mục dist/ với file production-ready
# Upload dist/ lên web server
```

### Deploy Backend
```bash
# Cài Gunicorn
pip install gunicorn

# Chạy với Gunicorn
gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker

# Hoặc dùng Docker (tạo Dockerfile)
```

---

## 📚 Tài Liệu Bổ Sung

- FastAPI: https://fastapi.tiangolo.com/
- React: https://react.dev/
- Tailwind CSS: https://tailwindcss.com/
- Recharts: https://recharts.org/
- MySQL: https://dev.mysql.com/doc/

---

## ✨ Chúc Mừng!

Nếu bạn thấy cả Backend và Frontend chạy thành công, **xin chúc mừng! 🎉**

Hệ thống SmartPreventiveHealth đã sẵn sàng sử dụng!

---

**Nếu gặp vấn đề, hãy kiểm tra:**
1. ✓ Tất cả software đã được cài đặt
2. ✓ MySQL service đang chạy
3. ✓ Port 8000 và 5173 không bị chiếm dụng
4. ✓ File .env đã được cấu hình đúng
5. ✓ ML model (heart_risk_model.pkl) đã được huấn luyện
