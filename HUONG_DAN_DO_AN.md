# TÀI LIỆU HƯỚNG DẪN ĐỒ ÁN: HỆ THỐNG PHÒNG NGỪA ĐỘT QUỴ VÀ BỆNH TIM MẠCH (SMART HEALTHCARE PLATFORM)

Tài liệu này được biên soạn nhằm mục đích hướng dẫn chi tiết toàn bộ về đồ án, từ công nghệ sử dụng, dữ liệu phân tích, chi tiết từng tính năng đến cách thức cài đặt và vận hành hệ thống. Tài liệu này sẽ giúp nhóm dễ dàng nắm bắt toàn bộ dự án.

---

## 1. THÔNG TIN CHUNG VỀ ĐỀ TÀI

- **Tên đề tài:** Hệ Thống Chăm Sóc Sức Khỏe Thông Minh Chuyên Sâu Phòng Ngừa Đột Quỵ & Bệnh Tim Mạch (Smart Preventive Health / Smart Healthcare Platform)
- **Mục tiêu:** Xây dựng một nền tảng hỗ trợ người dùng (đặc biệt là người cao tuổi) theo dõi sức khỏe, dự đoán nguy cơ mắc bệnh tim mạch và đột quỵ dựa trên Machine Learning. Hệ thống tích hợp sâu trợ lý ảo AI (Gemini) để tư vấn sức khỏe, theo dõi camera giám sát, hỗ trợ gọi cấp cứu SOS với bản đồ thời gian thực, và phân tích chế độ dinh dưỡng qua hình ảnh.

---

## 2. NGÔN NGỮ VÀ CÔNG NGHỆ SỬ DỤNG

Hệ thống được chia làm 2 phần chính: Backend (Máy chủ xử lý & AI) và Frontend (Giao diện người dùng).

### 2.1. Backend (Máy Chủ & Trí Tuệ Nhân Tạo)
- **Ngôn ngữ chính:** Python (phiên bản 3.10+)
- **Framework API:** FastAPI (Xây dựng các RESTful APIs nhanh chóng và hiệu năng cao)
- **Cơ sở dữ liệu:** MySQL 8.0+ (Sử dụng `mysql-connector-python` để kết nối)
- **Machine Learning:** `scikit-learn`, `pandas`, `joblib`.
  - Dùng thuật toán **Random Forest Classifier** gồm 100 cây quyết định để dự đoán rủi ro bệnh tim mạch.
  - Dùng **Isolation Forest** để phát hiện các chỉ số sức khỏe dị thường.
- **Trí Tuệ Nhân Tạo (LLM & Vision):** Tích hợp **Google Gemini API** (model `gemini-flash-latest`). Đặc biệt khai thác mạnh tính năng **Gemini Vision** để đọc hình ảnh camera và nhận diện hình ảnh món ăn, cùng với xử lý ngôn ngữ tự nhiên làm Bác sĩ AI.
- **Bảo mật:** `bcrypt` (Băm mật khẩu người dùng).

### 2.2. Frontend (Giao Diện Người Dùng)
- **Ngôn ngữ chính:** JavaScript (JSX)
- **Thư viện UI:** React (chạy trên nền Vite giúp build cực nhanh)
- **Tạo kiểu (Styling):** Tailwind CSS (Tùy chỉnh giao diện thân thiện, font chữ lớn 16px+ và nút bấm lớn 44px+ tối ưu cho người cao tuổi)
- **Bản đồ & Định vị:** `react-leaflet`, `leaflet`, Geolocation API (Xử lý bản đồ và tìm kiếm vị trí bệnh viện).
- **Biểu đồ:** `recharts` (Vẽ biểu đồ lịch sử sức khỏe, BMI và xu hướng rủi ro).
- **Nhận diện giọng nói:** Web Speech API (Hỗ trợ nhập liệu bằng giọng nói tiếng Việt).
- **Gọi API:** Axios.

---

## 3. DỮ LIỆU (DATA) SỬ DỤNG LÀ GÌ VÀ NHƯ THẾ NÀO?

Hệ thống sử dụng hai luồng dữ liệu chính: Dữ liệu huấn luyện Machine Learning và Dữ liệu vận hành hệ thống (Database).

### 3.1. Dữ liệu huấn luyện AI (Dataset)
- **Tên dataset:** Heart Disease Health Indicators Dataset (BRFSS 2015) - Lấy từ Kaggle.
- **Bản chất dữ liệu:** Đây là bộ dữ liệu Hệ thống Giám sát Yếu tố Nguy cơ Hành vi (BRFSS) năm 2015 của Hoa Kỳ, chứa hơn 200,000 bản ghi dữ liệu thực tế về các chỉ số sức khỏe của bệnh nhân.
- **Cách sử dụng:** Dữ liệu này được đưa vào thuật toán Random Forest để học từ 11 đặc trưng (Features) như: Huyết áp, Cholesterol, BMI, Hút thuốc, Tiểu đường, Hoạt động thể chất... Mô hình sau đó dự đoán % rủi ro bị bệnh tim và đột quỵ.

### 3.2. Dữ liệu hệ thống (MySQL Database)
Cơ sở dữ liệu có tên `healthcare_db` gồm các bảng chính:
- **users:** Lưu thông tin tài khoản, email, mật khẩu đã mã hóa.
- **health_records:** Lưu lại lịch sử đo của người dùng (11 chỉ số) và kết quả phần trăm rủi ro trả về từ AI.
- **chat_logs:** Lưu trữ lịch sử tin nhắn hỏi đáp giữa người dùng và Bác sĩ AI.

---

## 4. PHÂN TÍCH CHI TIẾT TỪNG TÍNH NĂNG (MODULES)

Dự án sở hữu một hệ sinh thái tính năng vô cùng phong phú và tiên tiến:

### 4.1. Đăng nhập & Đăng ký (Authentication)
- **Chi tiết:** Giao diện login thân thiện. Mật khẩu người dùng nhập vào sẽ được Backend mã hóa bằng `bcrypt` trước khi lưu. (Tài khoản test mặc định: `test@test.com` / `123456`).

### 4.2. Tầm soát rủi ro tim mạch & đột quỵ (Risk Assessment & Dashboard)
- **Chi tiết:** Người dùng nhập 11 chỉ số y tế. Dữ liệu nạp vào mô hình Random Forest (`heart_risk_model.pkl`) để trả về xác suất rủi ro (Thấp <30%, Trung bình 30-60%, Cao >60%).
- Hỗ trợ gửi kết quả này sang Gemini API để AI tư vấn thêm lời khuyên dựa trên mức độ rủi ro.

### 4.3. Giải thích AI (XAI - Explainable AI)
- **Chi tiết:** Thay vì chỉ báo kết quả "Rủi ro 70%", tính năng XAI sẽ phân tích ngược lại xem yếu tố nào (Ví dụ: Huyết áp cao hay Hút thuốc) đang đóng góp nhiều nhất vào tỷ lệ phần trăm đó. Giúp cả bệnh nhân và bác sĩ hiểu được quyết định của Machine Learning, tăng tính minh bạch.

### 4.4. Đánh giá nhanh đột quỵ (FAST Test)
- **Chi tiết:** Module riêng biệt giúp người dùng thực hiện bài kiểm tra tiêu chuẩn quốc tế F.A.S.T (Face - Arm - Speech - Time) để nhận biết nhanh chóng và kịp thời các dấu hiệu của cơn đột quỵ.

### 4.5. Camera giám sát thông minh (Smart Surveillance)
- **Chi tiết:** Đây là tính năng đột phá, mô phỏng camera theo dõi người cao tuổi. Khi phát hiện sự cố (như Té ngã, Méo miệng/Liệt mặt - dấu hiệu đột quỵ), hình ảnh sẽ được chụp và gửi thẳng lên **Gemini Vision API**. Gemini sẽ đóng vai trò bác sĩ cấp cứu, phân tích hình ảnh và trả về các bước sơ cứu khẩn cấp ngay lập tức.

### 4.6. Bác sĩ AI (Gemini Chat)
- **Chi tiết:** Trợ lý ảo sử dụng sức mạnh của **Google Gemini API**. AI đóng vai trò là một bác sĩ tận tâm, đưa ra lời khuyên y tế qua việc chat bằng văn bản hoặc nhận diện giọng nói tiếng Việt (Web Speech API).

### 4.7. Phân tích dinh dưỡng bằng Hình ảnh & Text (Diet Analyzer)
- **Chi tiết:** Nhập mô tả món ăn hoặc **Tải hình ảnh món ăn lên**. Hình ảnh được gửi qua mô hình Gemini Vision API. AI sẽ nhận diện món ăn trong ảnh, phân tích lượng Calo, Cholesterol, Muối, Đường... và đánh giá mức độ an toàn của bữa ăn đó đối với bệnh nhân tim mạch/đột quỵ.

### 4.8. Bản đồ Khẩn cấp (SOS Map)
- **Chi tiết:** Nút SOS to có hiệu ứng nhấp nháy. Dùng React-Leaflet và Geolocation để vẽ bản đồ vị trí thực tế, đồng thời tính toán khoảng cách để gợi ý 3 bệnh viện gần nhất, kèm các số gọi khẩn (115, 113, 114).

### 4.9. Lịch sử & Thống kê (History)
- **Chi tiết:** Dùng thư viện Recharts để vẽ "Biểu đồ đường" xu hướng rủi ro tim mạch qua các ngày, và "Biểu đồ cột" chỉ số BMI, giúp theo dõi sức khỏe tổng quan.

---

## 5. HƯỚNG DẪN CÀI ĐẶT VÀ KHỞI CHẠY (SETUP GUIDE)

### BƯỚC 1: CÀI ĐẶT PHẦN MỀM YÊU CẦU
Máy tính cần phải có:
1. **Python 3.10+** (Nhớ tick "Add Python to PATH" khi cài).
2. **Node.js 16+** (Tải bản LTS trên trang chủ Node.js).
3. **MySQL 8.0+** (Cài MySQL Server và nhớ mật khẩu root).

### BƯỚC 2: CẤU HÌNH DATABASE
1. Mở MySQL.
2. Chạy file `schema.sql` (nằm trong thư mục `backend/`) để tạo database `healthcare_db` và các bảng.

### BƯỚC 3: CẤU HÌNH BIẾN MÔI TRƯỜNG & MODEL AI
1. Vào thư mục `backend/`, mở file `.env`. Điền đúng `DB_PASSWORD` của MySQL.
2. **CỰC KỲ QUAN TRỌNG:** Phải có `GEMINI_API_KEY=...` hợp lệ trong file `.env` để các tính năng AI nhận diện hình ảnh và chat hoạt động được.
3. Đảm bảo có file `heart_disease_health_indicators_BRFSS2015.csv` trong `backend/`.

### BƯỚC 4: KHỞI CHẠY BACKEND (Mở 1 cửa sổ Terminal mới)
Mở Terminal, cd vào `backend/` và chạy:
```bash
# 1. Tạo và kích hoạt môi trường ảo (Virtual Environment)
python -m venv venv
venv\Scripts\activate      # Lệnh cho Windows

# 2. Cài đặt các thư viện Python
pip install -r requirements.txt

# 3. Huấn luyện mô hình Machine Learning (CHỈ CẦN CHẠY 1 LẦN ĐẦU TIÊN)
python train_model.py      
# -> Bước này sẽ mất tầm 15-30 giây, tạo ra file heart_risk_model.pkl và anomaly_detector.pkl

# 4. Chạy Server FastAPI
uvicorn main:app --reload
```
-> Báo `Uvicorn running on http://127.0.0.1:8000` là thành công. **(Tuyệt đối KHÔNG đóng Terminal này).**

### BƯỚC 5: KHỞI CHẠY FRONTEND (Mở 1 cửa sổ Terminal khác)
Mở Terminal mới, cd vào `frontend/` và chạy:
```bash
npm install
npm run dev
```
-> Trình duyệt sẽ tự động mở trang web ở `http://localhost:5173`.

### BƯỚC 6: BẮT ĐẦU SỬ DỤNG VÀ TEST
- Dùng tài khoản **test@test.com / 123456** để đăng nhập.
- **Lưu ý test lỗi:** Nếu tính năng Nhận diện dinh dưỡng / Camera SOS / Chat không phản hồi (báo lỗi 500), hãy kiểm tra ngay lại `GEMINI_API_KEY` trong file `.env`.

---
**File hướng dẫn này chứa tất cả những gì thiết yếu nhất của dự án. Chúc nhóm bảo vệ thành công!**
