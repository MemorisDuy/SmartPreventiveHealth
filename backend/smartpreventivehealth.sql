-- Tạo database healthcare_db với UTF-8
CREATE DATABASE IF NOT EXISTS healthcare_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE healthcare_db;

-- Bảng users: lưu thông tin người dùng
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng health_records: lưu các lần đo chỉ số y tế
CREATE TABLE health_records (
    record_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    HighBP INT,
    HighChol INT,
    BMI FLOAT,
    Smoker INT,
    Diabetes INT,
    PhysActivity INT,
    Fruits INT,
    Veggies INT,
    HvyAlcoholConsump INT,
    Age INT,
    Sex INT,
    risk_percentage FLOAT,
    risk_level VARCHAR(50),
    is_anomaly TINYINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user_date (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng chat_logs: lưu lịch sử chat với bác sĩ AI
CREATE TABLE chat_logs (
    chat_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    user_message TEXT,
    ai_response TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user_date (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng emergency_contacts: lưu liên hệ khẩn cấp
CREATE TABLE emergency_contacts (
    contact_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    contact_name VARCHAR(100),
    phone_number VARCHAR(20),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Thêm user test mặc định
-- Mật khẩu test: 123456 (sẽ được thay thế bằng bcrypt ở backend)
-- Tạm thời dùng placeholder, backend sẽ tạo user với bcrypt
INSERT INTO users (full_name, email, password_hash) 
VALUES ('Nguyen Van A', 'test@test.com', '$2b$12$eImiTXuWVxfM37uY4JANjEUTqWPf/KqpKT68dqtH3C');
