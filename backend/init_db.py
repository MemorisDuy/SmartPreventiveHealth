# GHI CHÚ VẤN ĐÁP:
# File này khởi tạo cấu trúc database MySQL cho hệ thống.
# Vai trò:
# - Tạo database và các bảng cần thiết để lưu tài khoản người dùng,
#   lịch sử tầm soát sức khỏe, lịch sử tư vấn AI và thông tin liên hệ khẩn cấp.
# - Đây không phải module AI, nhưng là tầng lưu trữ giúp hệ thống có dữ liệu theo từng người dùng.
# Khi thầy hỏi dữ liệu lưu ở đâu:
# - Thông tin user nằm trong bảng users.
# - Kết quả dự đoán nằm trong bảng health_records.
# - Lịch sử chatbot nằm trong bảng chat_logs.
# - Thông tin liên hệ khẩn cấp nằm trong bảng emergency_contacts.

import os
import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "healthcare_db")

conn = None
cursor = None

try:
    # Kết nối tới MySQL server (không cần database)
    conn = mysql.connector.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD
    )
    
    cursor = conn.cursor()
    
    # Tạo database (đồng bộ tên DB với main.py và init_db.sql)
    cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    print(f"✓ Database '{DB_NAME}' created/verified")
    
    # Sử dụng database
    cursor.execute(f"USE `{DB_NAME}`")
    
    # Tạo bảng users
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
          user_id INT PRIMARY KEY AUTO_INCREMENT,
          full_name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("✓ Table users created")
    
    # Tạo bảng health_records
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS health_records (
          record_id INT PRIMARY KEY AUTO_INCREMENT,
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
        )
    """)
    print("✓ Table health_records created")
    
    # Tạo bảng chat_logs
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_logs (
          chat_id INT PRIMARY KEY AUTO_INCREMENT,
          session_id VARCHAR(50),
          user_id INT NOT NULL,
          user_message TEXT NOT NULL,
          ai_response TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
          INDEX idx_user_date (user_id, created_at)
        )
    """)
    print("✓ Table chat_logs created")
    
    # Tạo bảng emergency_contacts
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS emergency_contacts (
          contact_id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          name VARCHAR(255),
          phone VARCHAR(20),
          latitude DECIMAL(10,8),
          longitude DECIMAL(11,8),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        )
    """)
    print("✓ Table emergency_contacts created")
    
    # Chèn test user
    cursor.execute("""
        INSERT IGNORE INTO users (full_name, email, password_hash) VALUES 
        ('Nguyen Van A', 'test@test.com', '$2b$12$PiiivnQ1c/9.1LnGGDcZ9e8Jat.jHQLXMyDgnybcXHxLjNLmXNUOi')
    """)
    print("✓ Test user inserted")
    
    conn.commit()
    print("\n✅ Database initialized successfully!")
    
except Error as e:
    print(f"❌ Error: {e}")
finally:
    if conn and conn.is_connected():
        if cursor:
            cursor.close()
        conn.close()
