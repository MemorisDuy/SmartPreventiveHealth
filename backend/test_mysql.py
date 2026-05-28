import mysql.connector

# Test kết nối MySQL với các password khác nhau
configs = [
    {'password': '', 'desc': 'Không có password'},
    {'password': '240704', 'desc': 'Password: 240704'},
    {'password': 'root', 'desc': 'Password: root'},
]

for config in configs:
    try:
        conn = mysql.connector.connect(
            host='localhost',
            user='root',
            password=config['password'],
            database='smartpreventivehealth'
        )
        print(f"✓ Thành công! {config['desc']}")
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users LIMIT 1")
        result = cursor.fetchone()
        print(f"  User: {result}")
        conn.close()
        break
    except mysql.connector.Error as e:
        print(f"✗ Thất bại - {config['desc']}: {e.msg}")
