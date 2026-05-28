import mysql.connector
from mysql.connector import Error

try:
    # Kết nối tới MySQL server (không cần database)
    conn = mysql.connector.connect(
        host='localhost',
        user='root',
        password=''
    )
    
    cursor = conn.cursor()
    
    # Tạo database
    cursor.execute("CREATE DATABASE IF NOT EXISTS smartpreventivehealth CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    print("✓ Database created")
    
    # Sử dụng database
    cursor.execute("USE smartpreventivehealth")
    
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
    if conn.is_connected():
        cursor.close()
        conn.close()
