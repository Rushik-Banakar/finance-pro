import sqlite3

conn = sqlite3.connect('money_manager.db')
cursor = conn.cursor()
cursor.execute("SELECT id, username, email FROM users;")
rows = cursor.fetchall()
for r in rows:
    print(f"ID: {r[0]}, Username: {r[1]}, Email: {r[2]}")
conn.close()
