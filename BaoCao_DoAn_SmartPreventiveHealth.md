# BÁO CÁO ĐỒ ÁN MÔN HỌC: TRÍ TUỆ NHÂN TẠO

---

## **TÊN ĐỀ TÀI:**

# HỆ THỐNG CHĂM SÓC SỨC KHỎE THÔNG MINH CHUYÊN SÂU PHÒNG NGỪA ĐỘT QUỴ & BỆNH TIM MẠCH
## (Smart Preventive Health Platform)

---

**Giảng viên hướng dẫn:** [GHI TÊN THẦY/CÔ]

**Nhóm:** 13

**Thành viên nhóm:**

| STT | Họ và tên | MSSV | Vai trò |
|-----|-----------|------|---------|
| 1 | [Họ tên TV1] | [MSSV] | Nhóm trưởng |
| 2 | [Họ tên TV2] | [MSSV] | Thành viên |
| 3 | [Họ tên TV3] | [MSSV] | Thành viên |
| 4 | [Họ tên TV4] | [MSSV] | Thành viên |

**Năm học:** 2025 – 2026

---
---

# MỤC LỤC

1. [Phân công công việc cho các thành viên nhóm](#1-phân-công-công-việc-cho-các-thành-viên-nhóm)
2. [Phân tích bài toán](#2-phân-tích-bài-toán)
   - 2.1. Mục đích bài toán
   - 2.2. Bối cảnh và thực trạng
   - 2.3. Cách tiếp cận và giải pháp
   - 2.4. Công nghệ sử dụng
   - 2.5. Cơ sở dữ liệu
   - 2.6. Đóng góp mới so với các chương trình/ứng dụng đã có
3. [Các thuật toán sử dụng](#3-các-thuật-toán-sử-dụng)
   - 3.1. Thuật toán Random Forest Classifier (Pseudocode)
   - 3.2. Thuật toán Isolation Forest – Anomaly Detection (Pseudocode)
   - 3.3. Tích hợp Large Language Model – Hệ thống AI Fallback đa tầng (Pseudocode)
   - 3.4. Thuật toán Haversine – Tính khoảng cách địa lý (Pseudocode)
   - 3.5. Sơ đồ kiến trúc tổng thể hệ thống
4. [Một số giao diện và kết quả chạy chương trình](#4-một-số-giao-diện-và-kết-quả-chạy-chương-trình)
5. [Phụ lục](#5-phụ-lục)
6. [Tài liệu tham khảo](#6-tài-liệu-tham-khảo)

---
---

# 1. PHÂN CÔNG CÔNG VIỆC CHO CÁC THÀNH VIÊN NHÓM

| STT | Thành viên | Công việc được phân công | Tỷ lệ đóng góp |
|-----|------------|--------------------------|-----------------|
| 1 | [Họ tên TV1 – Nhóm trưởng] | - Thiết kế kiến trúc tổng thể hệ thống (Backend + Frontend) <br> - Xây dựng FastAPI Backend (các endpoint: register, login, predict, chat, history) <br> - Huấn luyện mô hình Machine Learning (Random Forest, Isolation Forest) <br> - Tích hợp Google Gemini API (Chatbot + Vision) <br> - Quản lý Database MySQL <br> - Viết báo cáo & thuyết trình | [??]% |
| 2 | [Họ tên TV2] | - Xây dựng giao diện Frontend React (Dashboard, Risk Assessment, XAI Page) <br> - Thiết kế UI/UX thân thiện người cao tuổi (font 16px+, nút 44px+) <br> - Tích hợp biểu đồ Recharts (biểu đồ đường xu hướng rủi ro, biểu đồ cột BMI) <br> - Xây dựng component XAI (Explainable AI) hiển thị Feature Importance | [??]% |
| 3 | [Họ tên TV3] | - Xây dựng module Camera Giám sát Thông minh (Smart Surveillance) <br> - Tích hợp Gemini Vision API phân tích hình ảnh camera <br> - Xây dựng module Bản đồ SOS khẩn cấp (React-Leaflet + Geolocation) <br> - Xây dựng tính năng gửi Email cảnh báo tự động (SMTP) <br> - Kiểm thử hệ thống | [??]% |
| 4 | [Họ tên TV4] | - Xây dựng module Phân tích Dinh dưỡng (Diet Analyzer – Text + Hình ảnh) <br> - Xây dựng module Bác sĩ AI Chat (tích hợp Web Speech API giọng nói tiếng Việt) <br> - Xây dựng module FAST Test (đánh giá nhanh đột quỵ) <br> - Xây dựng trang Lịch sử & Thống kê (History Page) <br> - Thu thập và xử lý dataset BRFSS 2015 | [??]% |

> **Ghi chú:** Bảng phân công trên là mẫu tham khảo. Các bạn tự điền tên, MSSV, và điều chỉnh công việc phù hợp với thực tế phân công trong nhóm.

---
---

# 2. PHÂN TÍCH BÀI TOÁN

## 2.1. Mục đích bài toán

Bệnh tim mạch và đột quỵ là hai trong số những nguyên nhân gây tử vong hàng đầu tại Việt Nam và trên toàn thế giới. Theo thống kê của Tổ chức Y tế Thế giới (WHO), mỗi năm có khoảng **17.9 triệu người tử vong** do bệnh tim mạch, chiếm **31% tổng số ca tử vong toàn cầu**. Tại Việt Nam, số ca đột quỵ ngày càng tăng và xu hướng trẻ hóa, ảnh hưởng nghiêm trọng đến sức khỏe cộng đồng.

**Mục tiêu chính** của đề tài là xây dựng một **nền tảng web ứng dụng Trí tuệ Nhân tạo (AI)** toàn diện, giúp:

1. **Dự đoán nguy cơ** mắc bệnh tim mạch và đột quỵ dựa trên 11 chỉ số y tế thực tế bằng thuật toán Machine Learning (Random Forest).
2. **Phát hiện dị thường** trong các chỉ số sức khỏe bằng Isolation Forest (Anomaly Detection).
3. **Giải thích kết quả AI** (Explainable AI – XAI) giúp người dùng hiểu được lý do tại sao AI đưa ra mức rủi ro cụ thể.
4. **Tư vấn sức khỏe thông minh 24/7** thông qua Bác sĩ AI (Google Gemini), hỗ trợ chat văn bản và nhận diện giọng nói tiếng Việt.
5. **Giám sát camera thông minh** phát hiện sự cố (té ngã, méo miệng – dấu hiệu đột quỵ) và tự động gửi cảnh báo khẩn cấp qua email.
6. **Phân tích dinh dưỡng** bằng văn bản và hình ảnh (Gemini Vision), đánh giá tác động bữa ăn đến sức khỏe tim mạch.
7. **Hỗ trợ cấp cứu SOS** với bản đồ thời gian thực, định vị GPS và tìm bệnh viện gần nhất.
8. **Đánh giá nhanh đột quỵ** bằng bài test F.A.S.T (Face – Arm – Speech – Time) theo chuẩn quốc tế.
9. **Theo dõi lịch sử** sức khỏe dài hạn với biểu đồ trực quan.

**Đối tượng sử dụng:** Mọi lứa tuổi, đặc biệt tối ưu cho **người cao tuổi** với giao diện chữ to, nút bấm lớn, thân thiện.

---

## 2.2. Bối cảnh và thực trạng

Hiện nay, các giải pháp phòng ngừa bệnh tim mạch và đột quỵ tại Việt Nam phần lớn vẫn còn nhiều hạn chế:

- **Thiếu hệ thống cảnh báo sớm:** Người dân chủ yếu phát hiện bệnh khi đã ở giai đoạn nặng.
- **Chi phí khám tầm soát cao:** Các xét nghiệm y tế chuyên sâu tốn kém, không phải ai cũng tiếp cận được.
- **Thiếu tư vấn y tế thường xuyên:** Người bệnh khó gặp bác sĩ thường xuyên để tư vấn phòng ngừa.
- **Người cao tuổi khó tiếp cận công nghệ:** Các ứng dụng y tế hiện có thường có giao diện phức tạp, chữ nhỏ, không thân thiện.
- **Không có hệ thống giám sát tự động:** Khi người cao tuổi sống một mình, rủi ro té ngã hoặc đột quỵ mà không ai biết là rất cao.

---

## 2.3. Cách tiếp cận và giải pháp

Hệ thống SmartPreventiveHealth được thiết kế theo **kiến trúc Client-Server**, chia thành 2 phần chính:

**Backend (Máy chủ – Python/FastAPI):**
- Xử lý nghiệp vụ AI/ML: Huấn luyện và triển khai mô hình dự đoán rủi ro (Random Forest, Isolation Forest).
- Tích hợp Google Gemini API: Chatbot, phân tích hình ảnh, nhận diện giọng nói.
- Quản lý cơ sở dữ liệu MySQL: Lưu trữ thông tin người dùng, lịch sử đo, lịch sử chat.
- Hệ thống fallback đa tầng: Gemini → OpenRouter → Groq (đảm bảo AI luôn sẵn sàng).

**Frontend (Giao diện – React/Vite):**
- 11 trang giao diện responsive, tối ưu cho cả desktop và mobile.
- Thiết kế UI thân thiện người cao tuổi (font ≥16px, nút bấm ≥44px).
- Tích hợp Web Speech API cho nhập liệu bằng giọng nói tiếng Việt.
- Biểu đồ tương tác Recharts và bản đồ Leaflet.

**Luồng xử lý chính của bài toán:**

```
Người dùng nhập 11 chỉ số y tế
       ↓
Backend nhận request qua FastAPI
       ↓
Random Forest Model predict_proba()  →  Xác suất rủi ro (%)
Isolation Forest predict()           →  Phát hiện dị thường (Có/Không)
       ↓
Phân loại: Thấp (<30%) | Trung bình (30-60%) | Cao (>60%)
       ↓
Gemini AI tư vấn lời khuyên dựa trên kết quả
       ↓
Lưu kết quả vào MySQL + Trả kết quả về Frontend
       ↓
Frontend hiển thị: Mức rủi ro + Biểu đồ XAI + Lời khuyên AI
```

---

## 2.4. Công nghệ sử dụng

### 2.4.1. Backend (Máy chủ & Trí tuệ nhân tạo)

| Công nghệ | Phiên bản | Mục đích |
|-----------|-----------|----------|
| Python | 3.10+ | Ngôn ngữ lập trình chính |
| FastAPI | Mới nhất | Framework API tốc độ cao, hỗ trợ async |
| MySQL | 8.0+ | Cơ sở dữ liệu quan hệ |
| mysql-connector-python | Mới nhất | Kết nối Python ↔ MySQL (Connection Pool) |
| scikit-learn | Mới nhất | Machine Learning (Random Forest, Isolation Forest) |
| pandas | Mới nhất | Xử lý và phân tích dữ liệu |
| joblib | Mới nhất | Serialize/Deserialize mô hình ML (.pkl) |
| google-generativeai | Mới nhất | Tích hợp Google Gemini API (Text + Vision) |
| bcrypt | Mới nhất | Băm mật khẩu (Hash Password) |
| Pillow (PIL) | Mới nhất | Xử lý hình ảnh cho Gemini Vision |
| python-dotenv | Mới nhất | Quản lý biến môi trường (.env) |
| uvicorn | Mới nhất | ASGI Server chạy FastAPI |

### 2.4.2. Frontend (Giao diện người dùng)

| Công nghệ | Phiên bản | Mục đích |
|-----------|-----------|----------|
| React | 18 | Thư viện xây dựng giao diện UI |
| Vite | Mới nhất | Build tool siêu nhanh (thay thế Webpack) |
| Tailwind CSS | Mới nhất | Styling framework (utility-first) |
| React Router DOM | v6 | Điều hướng SPA (Single Page Application) |
| Axios | Mới nhất | HTTP Client gọi API Backend |
| Recharts | Mới nhất | Thư viện biểu đồ (Line Chart, Bar Chart) |
| React-Leaflet | Mới nhất | Bản đồ tương tác (OpenStreetMap) |
| Web Speech API | Browser | Nhận diện giọng nói tiếng Việt (vi-VN) |
| Geolocation API | Browser | Lấy vị trí GPS người dùng |

### 2.4.3. Dữ liệu huấn luyện AI

- **Tên dataset:** Heart Disease Health Indicators Dataset (BRFSS 2015) – Trung tâm CDC Hoa Kỳ
- **Nguồn:** Kaggle
- **Quy mô:** Hơn **200,000 bản ghi** dữ liệu thực tế về chỉ số sức khỏe bệnh nhân
- **Phân chia:** Train 80% – Test 20% (Stratified Split, random_state=42)

**11 Features (Đặc trưng) đầu vào cho mô hình:**

| STT | Feature | Mô tả | Giá trị |
|-----|---------|--------|---------|
| 1 | HighBP | Huyết áp cao | 0 (Không) / 1 (Có) |
| 2 | HighChol | Cholesterol cao | 0 / 1 |
| 3 | BMI | Chỉ số khối lượng cơ thể | 15.0 – 60.0 |
| 4 | Smoker | Hút thuốc | 0 / 1 |
| 5 | Diabetes | Tiểu đường | 0 / 1 / 2 |
| 6 | PhysActivity | Hoạt động thể chất | 0 / 1 |
| 7 | Fruits | Ăn trái cây hàng ngày | 0 / 1 |
| 8 | Veggies | Ăn rau hàng ngày | 0 / 1 |
| 9 | HvyAlcoholConsump | Uống rượu nhiều | 0 / 1 |
| 10 | Age | Nhóm tuổi | 1 – 13 |
| 11 | Sex | Giới tính | 0 (Nữ) / 1 (Nam) |

**Target (Nhãn):** `HeartDiseaseorAttack` – 0 (Không có rủi ro) / 1 (Có rủi ro)

---

## 2.5. Cơ sở dữ liệu

### 2.5.1. Sơ đồ quan hệ (ERD)

```
┌──────────────┐       ┌──────────────────┐
│    users     │       │  health_records  │
├──────────────┤       ├──────────────────┤
│ user_id  PK  │──┐    │ record_id    PK  │
│ full_name    │  │    │ user_id      FK  │──┐
│ email    UK  │  ├───>│ HighBP, HighChol │  │
│ password_hash│  │    │ BMI, Smoker, ... │  │
│ created_at   │  │    │ risk_percentage  │  │
└──────────────┘  │    │ risk_level       │  │
                  │    │ is_anomaly       │  │
                  │    │ created_at       │  │
                  │    └──────────────────┘  │
                  │                          │
                  │    ┌──────────────────┐  │
                  │    │   chat_logs      │  │
                  │    ├──────────────────┤  │
                  ├───>│ chat_id      PK  │  │
                  │    │ session_id       │  │
                  │    │ user_id      FK  │──┘
                  │    │ user_message     │
                  │    │ ai_response      │
                  │    │ created_at       │
                  │    └──────────────────┘
                  │
                  │    ┌──────────────────┐
                  │    │emergency_contacts│
                  │    ├──────────────────┤
                  └───>│ contact_id   PK  │
                       │ user_id      FK  │
                       │ contact_name     │
                       │ phone_number     │
                       │ latitude         │
                       │ longitude        │
                       └──────────────────┘
```

### 2.5.2. Mô tả chi tiết các bảng

**Bảng `users` – Thông tin người dùng:**

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|-----|---------------|-----------|-------|
| user_id | INT | PRIMARY KEY, AUTO_INCREMENT | ID người dùng |
| full_name | VARCHAR(100) | NOT NULL | Họ và tên |
| email | VARCHAR(100) | UNIQUE, NOT NULL | Email đăng nhập |
| password_hash | VARCHAR(255) | NOT NULL | Mật khẩu đã mã hóa bcrypt |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Thời điểm tạo tài khoản |

**Bảng `health_records` – Lịch sử đo chỉ số sức khỏe:**

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|-----|---------------|-----------|-------|
| record_id | INT | PRIMARY KEY, AUTO_INCREMENT | ID bản ghi |
| user_id | INT | FOREIGN KEY → users | ID người dùng |
| HighBP, HighChol | INT | | Huyết áp cao, Cholesterol cao |
| BMI | FLOAT | | Chỉ số khối cơ thể |
| Smoker, Diabetes | INT | | Hút thuốc, Tiểu đường |
| PhysActivity, Fruits, Veggies | INT | | Vận động, Trái cây, Rau |
| HvyAlcoholConsump | INT | | Uống rượu nhiều |
| Age, Sex | INT | | Nhóm tuổi, Giới tính |
| risk_percentage | FLOAT | | Phần trăm rủi ro tim mạch |
| risk_level | VARCHAR(50) | | Mức: Thấp / Trung bình / Cao |
| is_anomaly | TINYINT | DEFAULT 0 | Kết quả Isolation Forest (0/1) |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Thời điểm đo |

**Bảng `chat_logs` – Lịch sử chat với Bác sĩ AI:**

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|-----|---------------|-----------|-------|
| chat_id | INT | PRIMARY KEY, AUTO_INCREMENT | ID tin nhắn |
| session_id | VARCHAR(50) | | ID phiên chat (UUID) |
| user_id | INT | FOREIGN KEY → users | ID người dùng |
| user_message | TEXT | NOT NULL | Tin nhắn người dùng |
| ai_response | TEXT | NOT NULL | Phản hồi từ AI |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Thời điểm gửi |

**Bảng `emergency_contacts` – Liên hệ khẩn cấp:**

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|-----|---------------|-----------|-------|
| contact_id | INT | PRIMARY KEY, AUTO_INCREMENT | ID liên hệ |
| user_id | INT | FOREIGN KEY → users | ID người dùng |
| contact_name | VARCHAR(100) | | Tên người liên hệ |
| phone_number | VARCHAR(20) | | Số điện thoại |
| latitude | DECIMAL(10,8) | | Vĩ độ |
| longitude | DECIMAL(11,8) | | Kinh độ |

---

## 2.6. Đóng góp mới so với các chương trình/ứng dụng đã có

So sánh hệ thống SmartPreventiveHealth với các ứng dụng y tế hiện có trên thị trường:

| Tính năng | Ứng dụng y tế thông thường (Google Fit, Apple Health, các app khám online) | **SmartPreventiveHealth (Đề tài của nhóm)** |
|-----------|------------------------------------------|-------------------------------------------|
| Dự đoán rủi ro Tim mạch & Đột quỵ bằng ML | ❌ Không có (chỉ ghi nhận chỉ số) | ✅ **Random Forest 100 cây** trên dataset BRFSS 2015 (200k+ bản ghi thực tế) |
| Giải thích AI (XAI) | ❌ Không có | ✅ **Feature Importance Chart** – Hiển thị yếu tố nào đóng góp nhiều nhất vào mức rủi ro |
| Phát hiện dị thường (Anomaly Detection) | ❌ Không có | ✅ **Isolation Forest** – Cảnh báo khi chỉ số sức khỏe bất thường |
| Camera giám sát phát hiện Đột quỵ/Té ngã | ❌ Không có | ✅ **Gemini Vision API** phân tích hình ảnh camera, tự động gửi email cảnh báo |
| Phân tích Dinh dưỡng bằng Hình ảnh | ❌ Chỉ nhập tay | ✅ **Gemini Vision** nhận diện món ăn từ ảnh, phân tích Calo/Cholesterol/Muối |
| Bác sĩ AI Chat với Giọng nói | ❌ Chỉ chat text | ✅ **Web Speech API** hỗ trợ giọng nói tiếng Việt (vi-VN) |
| Bài test FAST đánh giá nhanh đột quỵ | ❌ Không có | ✅ **Module FAST Test** theo tiêu chuẩn quốc tế |
| Bản đồ SOS + Gửi email cảnh báo | ❌ Chỉ gọi điện cơ bản | ✅ **React-Leaflet + Geolocation** + Email SOS tự động kèm tọa độ GPS |
| Hệ thống AI fallback đa tầng | ❌ Không có | ✅ **Gemini → OpenRouter → Groq** – AI luôn sẵn sàng |
| Giao diện tối ưu cho Người cao tuổi | ❌ Giao diện phức tạp | ✅ **Font ≥16px, nút ≥44px**, thiết kế đơn giản |

**Tóm lại, 5 đóng góp mới quan trọng nhất:**

1. **Kết hợp Machine Learning (Random Forest) và Generative AI (Gemini)** trong cùng một nền tảng sức khỏe – điều mà hầu hết ứng dụng y tế hiện tại chưa làm được.
2. **Explainable AI (XAI)** – Không chỉ dự đoán mà còn giải thích rõ ràng cho người dùng hiểu tại sao mình có nguy cơ cao/thấp.
3. **Camera giám sát thông minh** kết hợp AI Vision phát hiện sự cố (té ngã/đột quỵ) và **tự động gửi email cảnh báo khẩn cấp** cho người thân.
4. **Phân tích dinh dưỡng bằng hình ảnh** (chụp ảnh món ăn → AI nhận diện và đánh giá tác động tim mạch).
5. **Hệ thống fallback AI đa tầng** (Gemini → OpenRouter → Groq) đảm bảo dịch vụ AI không bao giờ gián đoạn.

---
---

# 3. CÁC THUẬT TOÁN SỬ DỤNG

## 3.1. Thuật toán Random Forest Classifier

### 3.1.1. Giới thiệu

Random Forest (Rừng ngẫu nhiên) là một thuật toán học máy thuộc nhóm **Ensemble Learning** (Học kết hợp), sử dụng cho bài toán **phân loại (Classification)**. Trong đề tài này, Random Forest được dùng để **phân loại nguy cơ mắc bệnh tim mạch** dựa trên 11 đặc trưng y tế.

**Nguyên lý hoạt động:** Xây dựng nhiều cây quyết định (Decision Trees) độc lập trên các tập dữ liệu con ngẫu nhiên (Bootstrap Sampling), sau đó tổng hợp kết quả theo nguyên tắc **bỏ phiếu đa số** (Majority Voting).

### 3.1.2. Pseudocode

```
ALGORITHM: Random Forest Classifier
════════════════════════════════════════════════════════════════
INPUT:  D = {(x₁,y₁), (x₂,y₂), ..., (xₙ,yₙ)}  // Tập dữ liệu huấn luyện
                                                    // (200,000+ bản ghi BRFSS 2015)
        T = 100                                    // Số lượng cây quyết định
        m = √(11) ≈ 3                             // Số features chọn ngẫu nhiên tại mỗi nút

OUTPUT: Ensemble model H(x) = {h₁, h₂, ..., h₁₀₀}

════ GIAI ĐOẠN HUẤN LUYỆN ════

1.  FOR t = 1 TO T DO:                           // Lặp 100 lần (100 cây)
2.      Dₜ ← BootstrapSample(D)
        // Lấy mẫu ngẫu nhiên CÓ hoàn lại từ D (cùng kích thước n)

3.      hₜ ← TrainDecisionTree(Dₜ, m):
        //   Tại mỗi nút phân chia:
        //   a) Chọn ngẫu nhiên m features (không phải tất cả 11)
        //   b) Với mỗi feature, tìm ngưỡng split tối ưu theo Gini Impurity:
        //         Gini(S) = 1 - Σ(pᵢ²)
        //      trong đó pᵢ là tỷ lệ class i trong tập S
        //   c) Chọn feature + ngưỡng cho Gini thấp nhất
        //   d) Chia tập dữ liệu thành 2 nhánh con
        //   e) Phát triển cây đến khi nút thuần khiết hoặc đạt điều kiện dừng

4.  END FOR

════ GIAI ĐOẠN DỰ ĐOÁN (Khi người dùng nhập 11 chỉ số) ════

5.  FUNCTION Predict(x_new):
6.      FOR t = 1 TO 100 DO:
7.          votes[t] ← hₜ.predict(x_new)         // Mỗi cây bỏ phiếu: 0 hoặc 1
8.      END FOR
9.      RETURN MajorityVote(votes)                 // Nhãn có nhiều phiếu nhất
10. END FUNCTION

════ TÍNH XÁC SUẤT RỦI RO (%) ════

11. FUNCTION PredictRiskProbability(x_new):
12.     count_positive ← 0
13.     FOR t = 1 TO 100 DO:
14.         IF hₜ.predict(x_new) == 1 THEN:       // Nếu cây dự đoán "Có rủi ro"
15.             count_positive ← count_positive + 1
16.         END IF
17.     END FOR
18.     risk_probability ← (count_positive / 100) × 100  // Tỷ lệ % rủi ro
19.     RETURN risk_probability
20. END FUNCTION

════ PHÂN LOẠI MỨC ĐỘ RỦI RO ════

21. FUNCTION ClassifyRiskLevel(risk_probability):
22.     IF risk_probability < 30 THEN:
23.         RETURN "Thấp"                           // Tình trạng tốt
24.     ELSE IF risk_probability ≤ 60 THEN:
25.         RETURN "Trung bình"                     // Cần chú ý
26.     ELSE:
27.         RETURN "Cao"                            // Cần gặp bác sĩ ngay
28.     END IF
29. END FUNCTION
```

### 3.1.3. Cấu hình cụ thể trong mã nguồn

```python
# File: backend/train_model.py
model = RandomForestClassifier(
    n_estimators=100,     # 100 cây quyết định
    random_state=42,      # Seed cố định để kết quả tái tạo được
    n_jobs=-1,            # Sử dụng tất cả CPU cores (huấn luyện song song)
)
model.fit(X_train, y_train)

# File: backend/main.py – Dự đoán khi người dùng gửi request
risk_prob = rf_model.predict_proba(input_data)[0][1] * 100
```

> **📌 [CHÈN ẢNH 1]:** Chụp ảnh kết quả chạy `python train_model.py` trên Terminal. Ảnh cần hiển thị: số bản ghi (200,000+), Accuracy, Classification Report (Precision/Recall/F1), Confusion Matrix, Top 5 Feature Importance.

---

## 3.2. Thuật toán Isolation Forest (Anomaly Detection)

### 3.2.1. Giới thiệu

Isolation Forest là thuật toán phát hiện dị thường dựa trên nguyên lý: **các điểm dữ liệu bất thường dễ bị "cô lập" hơn** so với các điểm bình thường khi chia ngẫu nhiên không gian dữ liệu.

**Mục đích trong hệ thống:** Phát hiện trường hợp chỉ số sức khỏe bất thường (ví dụ: BMI quá cao kết hợp nhiều yếu tố rủi ro), cảnh báo người dùng rằng kết quả đo nằm **ngoài phân phối bình thường**.

### 3.2.2. Pseudocode

```
ALGORITHM: Isolation Forest (Anomaly Detection)
════════════════════════════════════════════════════════════════
INPUT:  X = tập dữ liệu huấn luyện (200,000+ bản ghi, 11 features)
        contamination = 0.05    // 5% dữ liệu được coi là dị thường
        n_trees = 100           // Số cây cô lập

OUTPUT: Mô hình phát hiện dị thường

════ GIAI ĐOẠN HUẤN LUYỆN ════

1.  FOR i = 1 TO n_trees DO:
2.      Xᵢ ← RandomSubsample(X, size=256)    // Lấy mẫu con ngẫu nhiên 256 điểm
3.      treeᵢ ← BuildIsolationTree(Xᵢ):

4.          FUNCTION BuildIsolationTree(data, depth=0):
5.              IF |data| ≤ 1 OR depth ≥ max_depth THEN:
6.                  RETURN LeafNode(size = |data|)    // Nút lá
7.              END IF

8.              q ← RandomFeature(data)              // Chọn 1 feature ngẫu nhiên
                                                      // Ví dụ: chọn "BMI"
9.              p ← RandomSplitValue(min(data[q]), max(data[q]))
                                                      // Giá trị chia ngẫu nhiên
                                                      // Ví dụ: BMI = 28.5
10.             data_left  ← {x ∈ data : x[q] < p}   // Nhóm BMI < 28.5
11.             data_right ← {x ∈ data : x[q] ≥ p}   // Nhóm BMI ≥ 28.5

12.             RETURN InternalNode(
                    feature = q,
                    split_value = p,
                    left  = BuildIsolationTree(data_left,  depth+1),
                    right = BuildIsolationTree(data_right, depth+1)
                )
13.         END FUNCTION

14. END FOR

════ GIAI ĐOẠN DỰ ĐOÁN ════

15. FUNCTION IsAnomaly(x_new):
16.     FOR i = 1 TO n_trees DO:
17.         pathLength[i] ← PathLength(x_new, treeᵢ)
            // Đếm số bước chia (depth) cần để cô lập x_new
            // Điểm BẤT THƯỜNG → ít bước → path ngắn
            // Điểm BÌNH THƯỜNG → nhiều bước → path dài
18.     END FOR

19.     avgPathLength ← Average(pathLength)
20.     anomalyScore  ← 2^(- avgPathLength / c(n))
        // c(n) = hằng số chuẩn hóa theo kích thước mẫu n

21.     IF anomalyScore > threshold THEN:
22.         RETURN -1                                // DỊ THƯỜNG (Anomaly)
23.     ELSE:
24.         RETURN  1                                // BÌNH THƯỜNG (Normal)
25.     END IF
26. END FUNCTION
```

### 3.2.3. Cấu hình cụ thể trong mã nguồn

```python
# File: backend/train_model.py
iso_forest = IsolationForest(contamination=0.05, random_state=42)
iso_forest.fit(X_train)

# File: backend/main.py – Kiểm tra khi người dùng gửi chỉ số
anomaly_score = iso_forest.predict(input_data)[0]
is_anomaly = True if anomaly_score == -1 else False
```

---

## 3.3. Tích hợp Large Language Model (LLM) – Hệ thống AI Fallback đa tầng

### 3.3.1. Giới thiệu

Google Gemini là mô hình ngôn ngữ lớn đa phương thức (multimodal) của Google DeepMind, hỗ trợ xử lý **văn bản, hình ảnh, âm thanh và video**. Hệ thống tích hợp Gemini vào nhiều module:

| Module | Cách sử dụng Gemini | Loại input |
|--------|---------------------|------------|
| Bác sĩ AI Chat | Xử lý ngôn ngữ tự nhiên, tư vấn y tế tiếng Việt | Text |
| Phân tích Dinh dưỡng | Nhận diện món ăn từ ảnh, phân tích dinh dưỡng | Text + Image |
| Camera Giám sát | Phân tích ảnh camera phát hiện té ngã/đột quỵ | Image (Vision) |
| Lời khuyên sức khỏe | Tạo lời khuyên cá nhân hóa dựa trên kết quả tầm soát | Text |
| Nhận diện giọng nói | Trích xuất lời nói từ video (FAST Test) | Video/Audio |
| Tư vấn nhịp tim | Hướng dẫn sơ cứu khi nhịp tim bất thường | Text |

### 3.3.2. Pseudocode – Hệ thống AI Fallback đa tầng

```
ALGORITHM: Multi-Layer AI Fallback System
════════════════════════════════════════════════════════════════
INPUT:  user_request     // Câu hỏi/hình ảnh từ người dùng
        api_keys = [key₁, key₂, ..., keyₙ]   // Danh sách Gemini API keys

OUTPUT: ai_response      // Phản hồi từ AI (đảm bảo luôn có kết quả)

════ TẦNG 1: GOOGLE GEMINI (Ưu tiên cao nhất) ════

1.  FOR i = 1 TO |api_keys| DO:
2.      TRY:
3.          ConfigureAPI(api_keys[i])
4.          response ← GeminiModel.generate_content(user_request)
5.          IF response ≠ NULL AND response.text ≠ "" THEN:
6.              RETURN response.text            // ✅ Thành công
7.          END IF
8.      CATCH QuotaError (429 / RESOURCE_EXHAUSTED):
9.          PRINT "⚠️ Key #i hết quota, chuyển sang key tiếp theo..."
10.         CONTINUE                            // Thử key tiếp
11.     CATCH OtherError:
12.         BREAK                               // Lỗi khác → thử fallback
13.     END TRY
14. END FOR

════ TẦNG 2: OPENROUTER (Free models miễn phí) ════

15. TRY:
16.     // Thử lần lượt các model miễn phí:
17.     models ← ['meta-llama/llama-3.3-70b-instruct:free',
                   'google/gemma-4-31b-it:free',
                   'nousresearch/hermes-3-llama-3.1-405b:free']
18.     FOR EACH model IN models DO:
19.         response ← OpenRouterAPI.call(model, user_request)
20.         IF response ≠ NULL THEN:
21.             RETURN response                  // ✅ Thành công
22.         END IF
23.     END FOR
24. CATCH Error:
25.     PRINT "❌ OpenRouter thất bại..."
26. END TRY

════ TẦNG 3: GROQ (LLaMA 3.3 70B Versatile) ════

27. TRY:
28.     response ← GroqAPI.chat(
              model = "llama-3.3-70b-versatile",
              messages = [{role: "user", content: user_request}]
         )
29.     RETURN response                          // ✅ Thành công
30. CATCH Error:
31.     PRINT "❌ Groq thất bại..."
32. END TRY

════ TẦNG 4: FALLBACK TĨNH (Lời khuyên y tế dự phòng) ════

33. // Khi TẤT CẢ API đều thất bại → trả về lời khuyên y tế có sẵn
34. response ← STATIC_MEDICAL_ADVICE[risk_level]
35. RETURN response                              // ✅ Luôn có kết quả
```

---

## 3.4. Thuật toán Haversine – Tính khoảng cách địa lý

### 3.4.1. Mục đích

Sử dụng trong module **Bản đồ SOS Khẩn cấp** để tính khoảng cách giữa vị trí GPS hiện tại của người dùng và các bệnh viện, từ đó tìm ra **3 bệnh viện gần nhất**.

### 3.4.2. Pseudocode

```
ALGORITHM: Haversine Distance + Find Nearest Hospitals
════════════════════════════════════════════════════════════════
INPUT:  (lat₁, lon₁)       // Tọa độ GPS người dùng
        (lat₂, lon₂)       // Tọa độ GPS bệnh viện

OUTPUT: distance (km)       // Khoảng cách theo đường chim bay

════ CÔNG THỨC HAVERSINE ════

1.  R ← 6371                                // Bán kính Trái Đất (km)
2.  Δlat ← toRadians(lat₂ - lat₁)
3.  Δlon ← toRadians(lon₂ - lon₁)
4.  a ← sin²(Δlat/2) + cos(toRadians(lat₁)) × cos(toRadians(lat₂)) × sin²(Δlon/2)
5.  c ← 2 × atan2(√a, √(1-a))
6.  distance ← R × c
7.  RETURN distance

════ TÌM 3 BỆNH VIỆN GẦN NHẤT ════

8.  FUNCTION FindNearestHospitals(user_location, hospital_list, top_k=3):
9.      distances ← []
10.     FOR EACH hospital IN hospital_list DO:
11.         d ← HaversineDistance(user_location, hospital.coordinates)
12.         distances.APPEND( (hospital, d) )
13.     END FOR
14.     distances.SORT_BY(distance, ascending=TRUE)
15.     RETURN distances[0 : top_k]             // Trả về 3 bệnh viện gần nhất
16. END FUNCTION
```

---

## 3.5. Sơ đồ kiến trúc tổng thể hệ thống

```
┌─────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React + Vite + Tailwind CSS)          │
│                                                                       │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────────────┐   │
│  │ Dashboard │ │ Chat AI  │ │ SOS Map   │ │ Diet Analyzer        │   │
│  │ + Risk    │ │ + Voice  │ │ + Leaflet │ │ + Image Upload       │   │
│  │ + XAI     │ │ + History│ │ + Email   │ │ + Gemini Vision      │   │
│  └─────┬─────┘ └────┬─────┘ └─────┬─────┘ └────────┬─────────────┘   │
│        │            │             │                │               │
│  ┌─────┴─────┐ ┌────┴────┐ ┌─────┴────┐ ┌────────┴────────────┐  │
│  │ FAST Test │ │ History │ │ Camera   │ │ Login / Register    │  │
│  │           │ │ Charts  │ │ Surveill.│ │ (bcrypt auth)       │  │
│  └───────────┘ └─────────┘ └──────────┘ └─────────────────────┘  │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ Axios HTTP Requests (REST API)
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BACKEND (FastAPI + Python 3.10+)                │
│                                                                       │
│  ┌─────────────────────────────┐  ┌──────────────────────────────┐  │
│  │   Machine Learning Engine   │  │     AI Engine (LLM/Vision)   │  │
│  │  ┌───────────────────────┐  │  │  ┌─────────────────────────┐ │  │
│  │  │ Random Forest (100)   │  │  │  │ Gemini API (Tầng 1)     │ │  │
│  │  │ → predict_proba()     │  │  │  │ → Text + Vision         │ │  │
│  │  └───────────────────────┘  │  │  ├─────────────────────────┤ │  │
│  │  ┌───────────────────────┐  │  │  │ OpenRouter (Tầng 2)     │ │  │
│  │  │ Isolation Forest      │  │  │  │ → Llama 3.3 / Gemma 4   │ │  │
│  │  │ → Anomaly Detection   │  │  │  ├─────────────────────────┤ │  │
│  │  └───────────────────────┘  │  │  │ Groq (Tầng 3)           │ │  │
│  └─────────────────────────────┘  │  │ → LLaMA 3.3 70B         │ │  │
│                                    │  └─────────────────────────┘ │  │
│                                    └──────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │                    REST API Endpoints (14+)                    │   │
│  │  POST /api/register       POST /api/login                     │   │
│  │  POST /api/predict        POST /api/chat                      │   │
│  │  POST /api/analyze-meal   POST /api/emergency-alert           │   │
│  │  POST /api/health-advice  POST /api/heart-rate-advice         │   │
│  │  POST /api/send-emergency-email                               │   │
│  │  GET  /api/history/{id}   GET  /api/health                    │   │
│  │  GET  /api/chat/sessions/{id}                                 │   │
│  └───────────────────────────────────────────────────────────────┘   │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ mysql-connector-python (Connection Pool)
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DATABASE (MySQL 8.0)                             │
│  ┌─────────────┐ ┌─────────────────┐ ┌────────────┐ ┌─────────────┐ │
│  │    users    │ │ health_records  │ │  chat_logs │ │  emergency  │ │
│  │             │ │                 │ │            │ │  _contacts  │ │
│  │ user_id  PK │ │ record_id   PK  │ │ chat_id PK │ │ contact_id  │ │
│  │ full_name   │ │ user_id     FK  │ │ session_id │ │ user_id  FK │ │
│  │ email    UK │ │ 11 features     │ │ user_id FK │ │ name        │ │
│  │ pw_hash     │ │ risk_%          │ │ message    │ │ phone       │ │
│  │ created_at  │ │ risk_level      │ │ ai_resp    │ │ lat / lon   │ │
│  │             │ │ is_anomaly      │ │ created_at │ │             │ │
│  └─────────────┘ └─────────────────┘ └────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

> **📌 [CHÈN ẢNH 2]:** Có thể vẽ lại sơ đồ kiến trúc trên bằng công cụ Draw.io hoặc Lucidchart cho đẹp hơn, rồi chèn ảnh vào file Word.

---
---

# 4. MỘT SỐ GIAO DIỆN VÀ KẾT QUẢ CHẠY CHƯƠNG TRÌNH

> **HƯỚNG DẪN CHÈN ẢNH:** Dưới đây liệt kê chi tiết các ảnh chụp màn hình cần chèn. Mỗi mục ghi rõ **cần chụp gì**, **thao tác gì trước khi chụp**, **chụp ở đâu**.

---

## 4.1. Trang chủ (Home Page)

> **📌 [CHÈN ẢNH 3 – Trang chủ Desktop]:**
> - Mở trình duyệt → Truy cập `http://localhost:5173`
> - Chụp toàn bộ trang chủ trên máy tính (hiển thị banner, các tính năng nổi bật, nút Đăng nhập/Đăng ký)
> - Nên chụp full-page (cuộn hết trang)

> **📌 [CHÈN ẢNH 4 – Trang chủ Mobile]:**
> - Mở DevTools (F12) → Chọn chế độ responsive mobile (iPhone hoặc Samsung)
> - Chụp giao diện mobile responsive của trang chủ

---

## 4.2. Đăng nhập & Đăng ký

> **📌 [CHÈN ẢNH 5 – Trang Đăng nhập]:**
> - Truy cập `http://localhost:5173/login`
> - Chụp toàn bộ form đăng nhập (email, mật khẩu, nút đăng nhập, link đăng ký)
> - **Lưu ý:** Thể hiện rõ font chữ to, nút bấm lớn (thân thiện người cao tuổi)

> **📌 [CHÈN ẢNH 6 – Trang Đăng ký]:**
> - Truy cập `http://localhost:5173/register`
> - Chụp form đăng ký (họ tên, email, mật khẩu, xác nhận mật khẩu)

---

## 4.3. Dashboard – Tổng quan sức khỏe

> **📌 [CHÈN ẢNH 7 – Dashboard sau khi đăng nhập]:**
> - Đăng nhập bằng `test@test.com / 123456`
> - Chụp trang Dashboard tổng quan (hiển thị menu điều hướng, các card tính năng)

---

## 4.4. Tầm soát rủi ro Tim mạch & Đột quỵ (Risk Assessment)

> **📌 [CHÈN ẢNH 8 – Form nhập 11 chỉ số]:**
> - Truy cập `/risk-assessment`
> - Chụp form nhập liệu 11 chỉ số y tế
> - **Gợi ý:** Điền sẵn dữ liệu mẫu trước khi chụp cho đẹp

> **📌 [CHÈN ẢNH 9 – Kết quả dự đoán rủi ro THẤP]:**
> - Nhập chỉ số tốt: BMI=22, không hút thuốc, có vận động, ăn rau trái cây
> - Nhấn "Phân Tích Nguy Cơ"
> - Chụp kết quả: phần trăm rủi ro thấp, mức "Thấp", lời khuyên AI

> **📌 [CHÈN ẢNH 10 – Kết quả dự đoán rủi ro CAO]:**
> - Nhập chỉ số xấu: BMI=35, huyết áp cao, cholesterol cao, hút thuốc, tiểu đường
> - Nhấn "Phân Tích Nguy Cơ"
> - Chụp kết quả: phần trăm rủi ro cao, mức "Cao", cảnh báo đỏ, lời khuyên AI

---

## 4.5. Giải thích AI (XAI – Explainable AI)

> **📌 [CHÈN ẢNH 11 – Biểu đồ Feature Importance]:**
> - Truy cập `/xai` (sau khi đã có kết quả dự đoán)
> - Chụp biểu đồ hiển thị mức độ ảnh hưởng của từng yếu tố (HighBP, BMI, Age, v.v.)
> - **Lưu ý:** Đây là điểm nhấn quan trọng – thể hiện tính "Explainable" của AI

---

## 4.6. Đánh giá nhanh đột quỵ (FAST Test)

> **📌 [CHÈN ẢNH 12 – Giao diện FAST Test]:**
> - Truy cập `/fast-test`
> - Chụp giao diện bài test F.A.S.T (4 bước: Face – Arm – Speech – Time)

> **📌 [CHÈN ẢNH 13 – Kết quả FAST Test]:**
> - Hoàn thành bài test → Chụp kết quả đánh giá

---

## 4.7. Bác sĩ AI Chat

> **📌 [CHÈN ẢNH 14 – Giao diện Chat với Bác sĩ AI]:**
> - Truy cập `/chat`
> - Nhập câu hỏi: "Tôi bị huyết áp cao, nên ăn gì để giảm?"
> - Chụp: tin nhắn người dùng + phản hồi AI + nút micro + danh sách phiên chat

> **📌 [CHÈN ẢNH 15 – Chat bằng giọng nói]:**
> - Nhấn nút micro 🎤 → Nói câu hỏi bằng tiếng Việt
> - Chụp khi đang nhận diện giọng nói (hiển thị text được nhận diện)

---

## 4.8. Phân tích Dinh dưỡng (Diet Analyzer)

> **📌 [CHÈN ẢNH 16 – Phân tích bằng text]:**
> - Truy cập `/diet-analyzer`
> - Nhập: "Cơm gà xối mỡ" hoặc "Bún bò Huế"
> - Nhấn "Phân tích"
> - Chụp kết quả: Bảng dinh dưỡng (Calo, Protein, Fat, Carb, Sodium) + Đánh giá tác động tim mạch + Lời khuyên

> **📌 [CHÈN ẢNH 17 – Phân tích bằng hình ảnh]:**
> - Upload ảnh chụp một món ăn thực tế (tô phở, đĩa cơm)
> - Nhấn "Phân tích"
> - Chụp kết quả: AI nhận diện tên món ăn từ ảnh + phân tích dinh dưỡng + đánh giá tim mạch

---

## 4.9. Camera Giám sát Thông minh (Smart Surveillance)

> **📌 [CHÈN ẢNH 18 – Giao diện Camera Giám sát]:**
> - Truy cập `/smart-surveillance`
> - Cho phép truy cập webcam
> - Chụp: khung camera, nút phát hiện (Té ngã / Méo miệng), trạng thái giám sát, ô nhập email liên hệ

> **📌 [CHÈN ẢNH 19 – Kết quả phát hiện sự cố]:**
> - Nhấn nút "Phát hiện Té ngã" hoặc "Phát hiện Méo miệng"
> - Chụp: Ảnh chụp từ camera + Lời khuyên sơ cứu từ Gemini AI + Thông báo gửi email

> **📌 [CHÈN ẢNH 20 – Email cảnh báo khẩn cấp nhận được]:**
> - Mở hộp thư email nhận được
> - Chụp nội dung email cảnh báo (ảnh camera, hướng dẫn sơ cứu, thời gian phát hiện)

---

## 4.10. Bản đồ SOS Khẩn cấp (SOS Map)

> **📌 [CHÈN ẢNH 21 – Giao diện SOS Map]:**
> - Truy cập `/sos-map`
> - Cho phép truy cập GPS
> - Chụp: Nút SOS lớn (hiệu ứng pulse), bản đồ Leaflet hiển thị vị trí hiện tại

> **📌 [CHÈN ẢNH 22 – Kết quả sau khi nhấn SOS]:**
> - Nhấn nút SOS
> - Chụp: Bản đồ + marker bệnh viện gần nhất + Danh sách 3 bệnh viện (tên, khoảng cách, SĐT) + Số khẩn cấp (115, 113, 114)

> **📌 [CHÈN ẢNH 23 – Email SOS gửi cho người thân]:**
> - Nhập email người thân → Nhấn "Gửi cảnh báo"
> - Chụp email SOS nhận được (tọa độ GPS, link Google Maps, danh sách bệnh viện)

---

## 4.11. Lịch sử & Thống kê (History)

> **📌 [CHÈN ẢNH 24 – Trang Lịch sử & Biểu đồ]:**
> - Truy cập `/history` (cần có ít nhất 3-5 lần đo trước đó)
> - Chụp toàn bộ trang:
>   - 4 thẻ thống kê (Tổng lần đo, Rủi ro TB, Rủi ro cao nhất, Rủi ro thấp nhất)
>   - Biểu đồ đường (Line Chart) – Xu hướng rủi ro qua các ngày
>   - Biểu đồ cột (Bar Chart) – Chỉ số BMI
>   - Bảng chi tiết (Ngày, BMI, Huyết áp, Cholesterol, Rủi ro %)

---

## 4.12. Backend – API Documentation & Kết quả chạy

> **📌 [CHÈN ẢNH 25 – FastAPI Swagger UI]:**
> - Truy cập `http://localhost:8000/docs`
> - Chụp trang Swagger UI hiển thị toàn bộ API endpoints (tên, phương thức GET/POST, mô tả)

> **📌 [CHÈN ẢNH 26 – Terminal Backend đang chạy]:**
> - Chụp Terminal PowerShell khi chạy `uvicorn main:app --reload`
> - Thể hiện: thông báo load model thành công, Gemini API key sẵn sàng, server running

---

## 4.13. Kết quả huấn luyện mô hình Machine Learning

> **📌 [CHÈN ẢNH 27 – Kết quả chạy train_model.py]:**
> - Chạy `python train_model.py` trong Terminal
> - Chụp kết quả:
>   - Số bản ghi dữ liệu (200,000+)
>   - 11 features đã chọn
>   - Phân chia Train/Test (80/20)
>   - **Accuracy** (Độ chính xác)
>   - **Classification Report** (Precision, Recall, F1-Score cho từng class)
>   - **Confusion Matrix** (True Positive, True Negative, False Positive, False Negative)
>   - **Top 5 Feature Importance** (5 yếu tố quan trọng nhất ảnh hưởng đến kết quả)

---
---

# 5. PHỤ LỤC

## 5.1. Cấu trúc thư mục dự án

```
SmartHealthcare/
├── backend/                             # FastAPI Backend (Python)
│   ├── main.py                         # Server API chính (~1,941 dòng code)
│   ├── train_model.py                  # Huấn luyện ML model (Random Forest + Isolation Forest)
│   ├── init_db.sql                     # Database schema (tạo bảng)
│   ├── smartpreventivehealth.sql       # Database schema (bản đầy đủ)
│   ├── requirements.txt                # Python dependencies
│   ├── .env                            # Biến môi trường (API keys, DB config)
│   ├── heart_risk_model.pkl            # Random Forest model (sau khi train)
│   ├── anomaly_detector.pkl            # Isolation Forest model (sau khi train)
│   └── heart_disease_health_indicators_BRFSS2015.csv  # Dataset CDC
│
├── frontend/                            # React Frontend (Vite)
│   ├── src/
│   │   ├── App.jsx                     # Main app + React Router (11 routes)
│   │   ├── main.jsx                    # Entry point
│   │   ├── index.css                   # Global styles (Tailwind)
│   │   ├── api/
│   │   │   └── axios.js               # API client config (Axios interceptors)
│   │   ├── context/
│   │   │   └── SurveillanceContext.jsx # Context cho Camera Giám sát
│   │   ├── components/                 # 16 React Components
│   │   │   ├── Navbar.jsx              # Thanh điều hướng
│   │   │   ├── SmartSurveillance.jsx   # Camera giám sát thông minh
│   │   │   ├── FASTTestComponent.jsx   # FAST Test component
│   │   │   ├── ResultDashboard.jsx     # Dashboard kết quả tầm soát
│   │   │   ├── XAIChart.jsx            # Biểu đồ Explainable AI
│   │   │   ├── XAIFeatureCard.jsx      # Card hiển thị Feature Importance
│   │   │   ├── AiAdvice.jsx            # Lời khuyên AI
│   │   │   ├── Footer.jsx              # Footer trang web
│   │   │   ├── PublicHeader.jsx        # Header trang public
│   │   │   └── ErrorBoundary.jsx       # Xử lý lỗi React
│   │   └── pages/                      # 11 React Pages
│   │       ├── HomePage.jsx            # Trang chủ
│   │       ├── LoginPage.jsx           # Đăng nhập
│   │       ├── RegisterPage.jsx        # Đăng ký
│   │       ├── DashboardPage.jsx       # Dashboard tổng quan
│   │       ├── RiskAssessmentPage.jsx  # Tầm soát rủi ro
│   │       ├── XAIPage.jsx             # Explainable AI
│   │       ├── FastTestPage.jsx        # FAST Test
│   │       ├── ChatPage.jsx            # Chat Bác sĩ AI
│   │       ├── DietAnalyzerPage.jsx    # Phân tích dinh dưỡng
│   │       ├── SOSMapPage.jsx          # Bản đồ SOS
│   │       └── HistoryPage.jsx         # Lịch sử & Thống kê
│   ├── package.json                    # Dependencies (React, Vite, Tailwind, ...)
│   ├── vite.config.js                  # Cấu hình Vite
│   ├── tailwind.config.js              # Cấu hình Tailwind CSS
│   └── index.html                      # HTML template
│
└── README.md                            # Tài liệu hướng dẫn tổng quan
```

## 5.2. Hướng dẫn cài đặt và khởi chạy

### Yêu cầu hệ thống:
- Python 3.10+ (tick "Add Python to PATH" khi cài)
- Node.js 16+ (bản LTS)
- MySQL 8.0+
- API Key: Google Gemini API (bắt buộc cho tính năng AI)

### Các bước cài đặt:

**Bước 1: Tạo Database**
```sql
mysql -u root < backend/smartpreventivehealth.sql
```

**Bước 2: Cấu hình Backend**
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
# Sửa file .env: điền DB_PASSWORD và GEMINI_API_KEYS
```

**Bước 3: Huấn luyện ML Model (chỉ cần chạy 1 lần đầu tiên)**
```bash
python train_model.py
# → Tạo ra: heart_risk_model.pkl + anomaly_detector.pkl
```

**Bước 4: Chạy Backend Server**
```bash
uvicorn main:app --reload
# → Server chạy tại: http://localhost:8000
# → API Docs (Swagger): http://localhost:8000/docs
```

**Bước 5: Chạy Frontend (mở Terminal mới)**
```bash
cd frontend
npm install
npm run dev
# → Frontend chạy tại: http://localhost:5173
```

**Bước 6: Đăng nhập test**
- Email: `test@test.com`
- Password: `123456`

## 5.3. Thống kê dự án

| Hạng mục | Số lượng |
|----------|----------|
| Tổng số file Backend | ~20 files |
| Tổng số file Frontend | ~30 files |
| Dòng code Backend (main.py) | ~1,941 dòng |
| Dòng code Frontend (tổng) | ~3,500+ dòng |
| Số React Components | 16 components |
| Số React Pages | 11 pages |
| Số API Endpoints | 14+ endpoints |
| Số bảng Database | 4 bảng |
| Kích thước Dataset huấn luyện | 200,000+ bản ghi |
| Số External APIs tích hợp | 4 (Gemini, OpenRouter, Groq, OpenStreetMap) |

## 5.4. Source code

Source code đầy đủ của dự án được lưu trữ trên GitHub:
- **Repository:** [GHI LINK GITHUB CỦA NHÓM]

---
---

# 6. TÀI LIỆU THAM KHẢO

[1] CDC – Behavioral Risk Factor Surveillance System (BRFSS), "Heart Disease Health Indicators Dataset 2015," [Online]. Available: https://www.cdc.gov/brfss/index.html

[2] A. Teboul, "Heart Disease Health Indicators Dataset," Kaggle, 2021. [Online]. Available: https://www.kaggle.com/datasets/alexteboul/heart-disease-health-indicators-dataset

[3] L. Breiman, "Random Forests," *Machine Learning*, vol. 45, no. 1, pp. 5–32, 2001.

[4] F. T. Liu, K. M. Ting, and Z.-H. Zhou, "Isolation Forest," in *2008 Eighth IEEE International Conference on Data Mining*, pp. 413–422, 2008.

[5] Google DeepMind, "Gemini API Documentation," [Online]. Available: https://ai.google.dev/docs

[6] S. Ramírez, "FastAPI – Modern, fast web framework for building APIs with Python," [Online]. Available: https://fastapi.tiangolo.com/

[7] Meta AI, "React – A JavaScript library for building user interfaces," [Online]. Available: https://react.dev/

[8] F. Pedregosa et al., "Scikit-learn: Machine Learning in Python," *Journal of Machine Learning Research*, vol. 12, pp. 2825–2830, 2011.

[9] Evan You, "Vite – Next Generation Frontend Tooling," [Online]. Available: https://vitejs.dev/

[10] Leaflet Contributors, "React-Leaflet – React components for Leaflet maps," [Online]. Available: https://react-leaflet.js.org/

[11] W3C, "Web Speech API Specification," [Online]. Available: https://wicg.github.io/speech-api/

[12] Groq Inc., "Groq API Documentation," [Online]. Available: https://console.groq.com/docs

[13] OpenRouter, "OpenRouter API Documentation," [Online]. Available: https://openrouter.ai/docs

[14] Tổ chức Y tế Thế giới (WHO), "Cardiovascular Diseases (CVDs) – Fact Sheet," [Online]. Available: https://www.who.int/news-room/fact-sheets/detail/cardiovascular-diseases-(cvds)

[15] American Stroke Association, "F.A.S.T. Warning Signs of Stroke," [Online]. Available: https://www.stroke.org/en/about-stroke/stroke-symptoms

---
---

> ## 📌 BẢNG TỔNG KẾT: 27 ẢNH CẦN CHÈN VÀO BÁO CÁO
>
> | STT | Tên ảnh | Vị trí chèn | Cách chụp |
> |-----|---------|-------------|-----------|
> | 1 | Kết quả train_model.py | Mục 3.1 | Terminal: `python train_model.py` → Chụp Accuracy, Report, Matrix |
> | 2 | Sơ đồ kiến trúc hệ thống | Mục 3.5 | Vẽ bằng Draw.io/Lucidchart theo sơ đồ ASCII |
> | 3 | Trang chủ Desktop | Mục 4.1 | Browser: `localhost:5173` |
> | 4 | Trang chủ Mobile | Mục 4.1 | DevTools F12 → Responsive Mode |
> | 5 | Trang Đăng nhập | Mục 4.2 | Browser: `/login` |
> | 6 | Trang Đăng ký | Mục 4.2 | Browser: `/register` |
> | 7 | Dashboard tổng quan | Mục 4.3 | Đăng nhập → Vào Dashboard |
> | 8 | Form nhập 11 chỉ số | Mục 4.4 | Browser: `/risk-assessment` → Điền data mẫu |
> | 9 | Kết quả rủi ro THẤP | Mục 4.4 | Nhập chỉ số tốt → Nhấn Phân tích |
> | 10 | Kết quả rủi ro CAO | Mục 4.4 | Nhập chỉ số xấu → Nhấn Phân tích |
> | 11 | Biểu đồ XAI Feature Importance | Mục 4.5 | Browser: `/xai` |
> | 12 | Giao diện FAST Test | Mục 4.6 | Browser: `/fast-test` |
> | 13 | Kết quả FAST Test | Mục 4.6 | Hoàn thành test → Chụp kết quả |
> | 14 | Chat AI (gõ text) | Mục 4.7 | Browser: `/chat` → Gõ câu hỏi y tế |
> | 15 | Chat AI (giọng nói) | Mục 4.7 | Nhấn 🎤 → Nói tiếng Việt → Chụp |
> | 16 | Phân tích dinh dưỡng (text) | Mục 4.8 | Browser: `/diet-analyzer` → Nhập tên món |
> | 17 | Phân tích dinh dưỡng (ảnh) | Mục 4.8 | Upload ảnh món ăn → Chụp kết quả AI |
> | 18 | Camera Giám sát | Mục 4.9 | Browser: `/smart-surveillance` → Bật webcam |
> | 19 | Kết quả phát hiện sự cố | Mục 4.9 | Nhấn nút phát hiện → Chụp AI sơ cứu |
> | 20 | Email cảnh báo camera | Mục 4.9 | Mở hộp thư → Chụp email cảnh báo |
> | 21 | SOS Map (trước khi nhấn) | Mục 4.10 | Browser: `/sos-map` → Bật GPS |
> | 22 | SOS Map (sau khi nhấn SOS) | Mục 4.10 | Nhấn SOS → Chụp bản đồ + bệnh viện |
> | 23 | Email SOS gửi người thân | Mục 4.10 | Chụp email SOS nhận được |
> | 24 | Lịch sử & Biểu đồ | Mục 4.11 | Browser: `/history` (cần 3+ lần đo) |
> | 25 | Swagger UI | Mục 4.12 | Browser: `localhost:8000/docs` |
> | 26 | Terminal Backend | Mục 4.12 | Terminal chạy `uvicorn main:app --reload` |
> | 27 | Kết quả train model (chi tiết) | Mục 4.13 | Terminal: `python train_model.py` |

---

**--- HẾT BÁO CÁO ---**
