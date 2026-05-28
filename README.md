# ❤️ SmartPreventiveHealth

**Nền tảng AI Phòng Chống Bệnh Tim mạch & Đột quỵ - Dành cho Toàn Lứa Tuổi**

---

## 🎯 Giới Thiệu Dự Án

Một ứng dụng web tích hợp AI dành cho mọi lứa tuổi, giúp:
- 📊 **Phát hiện rủi ro Tim mạch & Đột quỵ** bằng Machine Learning
- 🤖 **Tư vấn sức khỏe 24/7** qua Bác sĩ AI (Groq LLaMA)
- 🗺️ **Định vị cấp cứu** bằng bản đồ tương tác
- 🍽️ **Phân tích dinh dưỡng** bằng giọng nói
- 📈 **Theo dõi lịch sử** sức khỏe

---

## 🛠️ Công Nghệ Sử Dụng

### Backend
- **FastAPI** - Framework API tốc độ cao
- **Python 3.10+** - Ngôn ngữ lập trình
- **MySQL** - Cơ sở dữ liệu relational
- **scikit-learn** - Machine Learning (Random Forest)
- **Groq API** - LLaMA 3.3 70B Chatbot

### Frontend
- **React 18** - UI Framework
- **Vite** - Build tool siêu nhanh
- **Tailwind CSS** - Styling
- **Recharts** - Biểu đồ dữ liệu
- **React-Leaflet** - Bản đồ tương tác
- **Web Speech API** - Nhập giọng nói

---

## 📋 Cấu Trúc Dự Án

```
SmartHealthcare/
├── backend/                    # FastAPI Backend
│   ├── main.py                # API endpoints chính
│   ├── train_model.py         # Huấn luyện ML model
│   ├── schema.sql             # Database schema
│   ├── requirements.txt        # Dependencies
│   ├── .env                   # Cấu hình môi trường
│   └── heart_risk_model.pkl   # Mô hình ML (sau khi train)
│
└── frontend/                  # React Frontend (Vite)
    ├── src/
    │   ├── App.jsx           # Main app component
    │   ├── main.jsx          # Entry point
    │   ├── index.css         # Global styles
    │   ├── api/
    │   │   └── axios.js      # API client config
    │   ├── pages/
    │   │   ├── LoginPage.jsx
    │   │   ├── DashboardPage.jsx
    │   │   ├── ChatPage.jsx
    │   │   ├── SOSMapPage.jsx
    │   │   ├── DietAnalyzerPage.jsx
    │   │   └── HistoryPage.jsx
    │   └── components/
    │       └── Navbar.jsx
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    └── index.html
```

---

## 🚀 Hướng Dẫn Khởi Chạy

### Bước 1️⃣: Chuẩn Bị Môi Trường

#### Cài Đặt MySQL
```bash
# Windows (nếu chưa có MySQL)
# Download từ: https://dev.mysql.com/downloads/mysql/

# Khởi động MySQL service
mysql -u root
```

#### Cài Đặt Python Virtual Environment
```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

### Bước 2️⃣: Tạo Database
```bash
mysql -u root < schema.sql
```

### Bước 3️⃣: Cài Đặt Backend
```bash
cd backend

# Cài dependencies
pip install -r requirements.txt

# Copy .env.example thành .env và điền thông tin
# Điều chỉnh trong .env:
# - DB_HOST=localhost
# - DB_USER=root
# - DB_PASSWORD=<mật khẩu MySQL của bạn>
# - GROQ_API_KEY=<your_groq_api_key>
```

### Bước 4️⃣: Huấn Luyện ML Model
```bash
# Tải file BRFSS2015 CSV (nếu chưa có)
# Link: https://www.kaggle.com/datasets/alexteboul/heart-disease-health-indicators-dataset

# Chạy training
python train_model.py

# Sẽ tạo ra file: heart_risk_model.pkl
```

### Bước 5️⃣: Chạy Backend Server
```bash
# Từ thư mục backend/
uvicorn main:app --reload

# Server chạy ở: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Bước 6️⃣: Cài Đặt Frontend
```bash
cd frontend

# Cài dependencies
npm install

# Chạy dev server
npm run dev

# Frontend chạy ở: http://localhost:5173
```

---

## 📱 Cách Sử Dụng

### Đăng Nhập
- **Email test:** `test@test.com`
- **Mật khẩu:** `123456`

### Dashboard (📋 Đo Khám)
1. Điền 11 chỉ số y tế (huyết áp, cholesterol, BMI, v.v.)
2. Nhấn "Phân Tích Nguy Cơ"
3. Xem kết quả % rủi ro Tim mạch & Đột quỵ

### Chat AI (💬 Hỏi Bác sĩ)
- Nhập câu hỏi hoặc nhấn 🎤 để nói
- Bác sĩ AI sẽ trả lời trong 3-4 câu

### Bản Đồ SOS (🆘 GỌI CẤP CỨU)
1. Nhấn nút SOS lớn
2. Cho phép truy cập GPS
3. Xem 3 bệnh viện gần nhất
4. Gọi 115 ngay

### Phân Tích Dinh Dưỡng (🍽️ Dinh dưỡng)
- Nhập hoặc nói tên món ăn vừa ăn
- AI phân tích tác động đến tim mạch

### Lịch Sử (📈 Lịch sử)
- Xem biểu đồ xu hướng rủi ro
- Tra cứu chi tiết các lần đo

---

## 🔑 Các API Endpoint

| Method | Endpoint | Mô Tả |
|--------|----------|-------|
| POST | `/api/register` | Đăng ký tài khoản |
| POST | `/api/login` | Đăng nhập |
| POST | `/api/predict` | Dự đoán rủi ro |
| POST | `/api/chat` | Chat với Bác sĩ AI |
| GET | `/api/history/{user_id}` | Lấy lịch sử |
| GET | `/api/health` | Health check |

---

## 🔐 Bảo Mật

- ✓ Password hashed bằng bcrypt
- ✓ CORS được cấu hình
- ✓ Biến môi trường không được commit
- ✓ API keys được lưu an toàn trong .env

---

## 🐛 Troubleshooting

### Lỗi "Cannot connect to database"
```bash
# Kiểm tra MySQL service đang chạy
# Windows: Services > MySQL
# macOS: System Preferences > MySQL
```

### Lỗi "Model not loaded"
```bash
# Chạy train_model.py trước
python train_model.py
```

### Lỗi "CORS error"
```bash
# Backend đã bật CORS cho localhost:5173
# Kiểm tra URL trong axios.js
```

---

## 📞 Hỗ Trợ

### Thông Tin Liên Hệ Khẩn Cấp
- 🆘 Cấp cứu Y tế: **115**
- 🚓 Cảnh sát: **113**
- 🚒 Cứu hỏa: **114**

---

## 📄 Giấy Phép

© 2024 SmartPreventiveHealth. Tất cả quyền được bảo lưu.

---

## 👨‍💻 Author

**Healthcare Development Team**

---

## 📚 Tài Liệu Tham Khảo

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [scikit-learn Machine Learning](https://scikit-learn.org/)
- [Groq API](https://www.groq.com/)
- [BRFSS CDC Dataset](https://www.cdc.gov/brfss/index.html)

---

**Chúc bạn sử dụng hệ thống thành công! ❤️**
