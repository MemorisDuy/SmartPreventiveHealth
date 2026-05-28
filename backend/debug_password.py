import mysql.connector
import bcrypt

conn = mysql.connector.connect(
    host='localhost',
    user='root',
    password='',
    database='smartpreventivehealth'
)
cursor = conn.cursor(dictionary=True)

# Lấy test user
cursor.execute('SELECT * FROM users WHERE email=%s', ('test@test.com',))
user = cursor.fetchone()

if user:
    print(f'Email: {user["email"]}')
    print(f'Full Name: {user["full_name"]}')
    print(f'Password Hash: {user["password_hash"]}')
    print(f'Hash type: {type(user["password_hash"])}')
    print(f'Hash length: {len(user["password_hash"])}')
    
    # Test bcrypt verification
    password = '123456'
    try:
        hash_bytes = user['password_hash'].encode('utf-8')
        print(f'\nHash bytes: {hash_bytes}')
        result = bcrypt.checkpw(password.encode('utf-8'), hash_bytes)
        print(f'Password verification: {result}')
    except Exception as e:
        print(f'\nVerification error: {e}')
else:
    print('No user found')

conn.close()
