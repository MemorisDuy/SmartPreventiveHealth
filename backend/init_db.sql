CREATE DATABASE IF NOT EXISTS healthcare_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE healthcare_db;

CREATE TABLE users (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE health_records (
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_user_date (user_id, created_at)
);

CREATE TABLE chat_logs (
  chat_id INT PRIMARY KEY AUTO_INCREMENT,
  session_id VARCHAR(50),
  user_id INT NOT NULL,
  user_message TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_user_date (user_id, created_at)
);

CREATE TABLE emergency_contacts (
  contact_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  name VARCHAR(255),
  phone VARCHAR(20),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

INSERT INTO users (full_name, email, password_hash) VALUES 
('Nguyen Van A', 'test@test.com', '$2b$12$Ci.PxQ7VvWKBKlS8T7GFxOlYWVxMfJE1iBP0bQVXZQGW6JqN8K6PG');
