import mysql.connector

try:
    conn = mysql.connector.connect(
        host='localhost',
        user='root',
        password='',
        database='smartpreventivehealth'
    )
    cursor = conn.cursor()
    cursor.execute("ALTER TABLE chat_logs ADD COLUMN session_id VARCHAR(50);")
    conn.commit()
    print("Added session_id successfully")
except Exception as e:
    print(f"Error: {e}")
finally:
    if 'conn' in locals() and conn.is_connected():
        cursor.close()
        conn.close()
